import { v4 as uuid } from 'uuid'
import type { Database } from 'sql.js'
import { query, run, withTransaction } from '../db/client'
import { applyStockDelta } from '../repositories/inventory'
import { enqueueSync } from '../sync/queue'
import { mapEntity } from '../sync/mapper'
import { addSupplierCredit, addCash } from '../accounting'
import type { PaymentMethod } from '../types'

export interface PurchaseLine { variantId:string; quantity:number; unitCost:number; enteredQuantity?:number; unit?:string; unitFactor?:number }
export interface CompletePurchaseInput { userId:string; registerSessionId?:string|null; supplierId:string; lines:PurchaseLine[]; discount?:number; taxRate?:number; paid:number; paymentMethod?:PaymentMethod; notes?:string }

function nextDocumentNo(db:Database,type:'PURCHASE'){const d=new Date();const key=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;const row=query<{current_value:number}>(db,'SELECT current_value FROM document_sequences WHERE document_type=? AND date_key=?',[type,key])[0];const n=(row?.current_value??0)+1;run(db,`INSERT INTO document_sequences(document_type,date_key,current_value) VALUES(?,?,?) ON CONFLICT(document_type,date_key) DO UPDATE SET current_value=excluded.current_value`,[type,key,n]);return `${key}${String(n).padStart(4,'0')}`}

export async function completePurchase(input:CompletePurchaseInput){
  if(!input.lines.length)throw new Error('فاتورة الشراء فارغة')
  if(input.paid<0)throw new Error('المدفوع غير صحيح')
  const paymentMethod=input.paymentMethod??'cash'
  if(!['cash','card','transfer','credit'].includes(paymentMethod))throw new Error('طريقة الدفع غير صحيحة')
  if(paymentMethod==='credit' && input.paid>0)throw new Error('الشراء الآجل لا يسجل دفعة مقدمة')
  return withTransaction(db=>{
    if(!query(db,'SELECT id FROM suppliers WHERE id=?',[input.supplierId])[0])throw new Error('المورد غير موجود')
    const lines=new Map<string,PurchaseLine>()
    for(const l of input.lines){if(!Number.isInteger(l.quantity)||l.quantity<=0)throw new Error('كمية شراء غير صحيحة');if(l.unitCost<0)throw new Error('تكلفة الشراء غير صحيحة');const old=lines.get(l.variantId);lines.set(l.variantId,old?{...old,quantity:old.quantity+l.quantity}:({...l}))}
    let subtotal=0
    const normalized = new Map<string, PurchaseLine>()
    for(const l of lines.values()){
      if(!query(db,'SELECT id FROM product_variants WHERE id=?',[l.variantId])[0])throw new Error('الصنف غير موجود')
      const factor = Math.max(1, Number(l.unitFactor)||1)
      const enteredQuantity = Number.isFinite(Number(l.enteredQuantity)) && Number(l.enteredQuantity)>0
        ? Number(l.enteredQuantity)
        : l.quantity / factor
      const baseQuantity = Number.isInteger(l.quantity) && l.quantity>0 ? l.quantity : Math.round(enteredQuantity*factor)
      const baseUnitCost = Number(l.unitCost) / factor
      if(!Number.isInteger(baseQuantity) || baseQuantity<=0 || !Number.isFinite(baseUnitCost) || baseUnitCost<0)throw new Error('بيانات شراء غير صحيحة')
      const normalizedLine = {...l, quantity:baseQuantity, enteredQuantity, unitFactor:factor, unitCost:Number(l.unitCost)}
      normalized.set(l.variantId, normalizedLine)
      subtotal += enteredQuantity * Number(l.unitCost)
    }
    const roundedSubtotal=Math.round(subtotal*100)/100
    const discount=Math.max(0,input.discount??0), taxRate=Math.max(0,input.taxRate??0), taxable=Math.max(0,roundedSubtotal-discount), taxAmount=Math.round(taxable*(taxRate/100)*100)/100, total=Math.round((taxable+taxAmount)*100)/100
    if(input.paid>total)throw new Error('المدفوع أكبر من الإجمالي')
    const id=uuid(), invoiceNo=nextDocumentNo(db,'PURCHASE')
    run(db,`INSERT INTO purchases(id,invoice_no,supplier_id,subtotal,discount,tax_rate,tax_amount,total,paid,status,notes) VALUES(?,?,?,?,?,?,?,?,?,'completed',?)`,[id,invoiceNo,input.supplierId,roundedSubtotal,discount,taxRate,taxAmount,total,input.paid,input.notes??null])
    for(const l of normalized.values()){
      const factor = Math.max(1, Number(l.unitFactor)||1)
      const enteredQuantity = Number(l.enteredQuantity ?? (l.quantity/factor))
      const itemTotal = Math.round((enteredQuantity * Number(l.unitCost))*100)/100
      const baseUnitCost = Math.round((Number(l.unitCost)/factor)*100)/100
      run(db,`INSERT INTO purchase_items(id,purchase_id,variant_id,quantity,unit_cost,total,entered_quantity,unit,unit_factor) VALUES(?,?,?,?,?,?,?,?,?)`,[uuid(),id,l.variantId,l.quantity,baseUnitCost,itemTotal,enteredQuantity,l.unit??'piece',factor])
      applyStockDelta(db,{variantId:l.variantId,quantityChange:l.quantity,type:'PURCHASE',referenceType:'purchase',referenceId:id})
      const old=query<{quantity:number;cost_price:number}>(db,'SELECT quantity,cost_price FROM product_variants WHERE id=?',[l.variantId])[0]!; const oldQty=Math.max(0,old.quantity-l.quantity); const newQty=old.quantity; const weighted=(newQty>0?((oldQty*old.cost_price)+(l.quantity*baseUnitCost))/newQty:baseUnitCost); run(db,"UPDATE product_variants SET cost_price=?,updated_at=datetime('now') WHERE id=?",[weighted,l.variantId])
    }
    const due=total-input.paid
    if(due>0){run(db,"UPDATE suppliers SET balance=balance+?,updated_at=datetime('now') WHERE id=?",[due,input.supplierId]);addSupplierCredit(db,input.supplierId,due,'purchase',id,'مستحق للمورد')}
    if(input.paid>0&&input.registerSessionId&&paymentMethod==='cash') addCash(db,{sessionId:input.registerSessionId,userId:input.userId,type:'PURCHASE',referenceType:'purchase',referenceId:id,amountOut:input.paid,note:'دفع شراء نقدي'})
    if(input.paid>0){const pid=uuid();run(db,`INSERT INTO supplier_payments(id,supplier_id,purchase_id,amount,method,notes) VALUES(?,?,?,?,?,?)`,[pid,input.supplierId,id,input.paid,paymentMethod,'دفعة أثناء إنشاء فاتورة شراء']);enqueueSync(db,{entityType:'supplier_payment',entityId:pid,operation:'create',payload:mapEntity(db,'supplier_payment',pid)})}
    run(db,`INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`,[uuid(),input.userId,'CREATE','purchase',id,JSON.stringify({invoiceNo,total,paid:input.paid})])
    enqueueSync(db,{entityType:'purchase',entityId:id,operation:'create',payload:mapEntity(db,'purchase',id)})
    return {id,invoiceNo,total,due}
  })
}

export async function voidPurchase(input:{userId:string;purchaseId:string;reason:string}) {
 return withTransaction(db=>{
  const purchase=query<any>(db,'SELECT * FROM purchases WHERE id=?',[input.purchaseId])[0]
  if(!purchase||purchase.status==='voided') throw new Error('الفاتورة غير موجودة أو ملغاة')
  const items=query<any>(db,'SELECT * FROM purchase_items WHERE purchase_id=?',[input.purchaseId])
  for(const item of items) applyStockDelta(db,{variantId:item.variant_id,quantityChange:-item.quantity,type:'PURCHASE_RETURN',referenceType:'purchase_void',referenceId:input.purchaseId})
  const due=Math.max(0,Number(purchase.total)-Number(purchase.paid))
  if(due) { run(db,"UPDATE suppliers SET balance=balance-?,updated_at=datetime('now') WHERE id=?",[due,purchase.supplier_id]); }
  if(Number(purchase.paid)>0){ const session=query<any>(db,"SELECT id FROM register_sessions WHERE status='open' ORDER BY opened_at DESC LIMIT 1")[0]; if(session) addCash(db,{sessionId:session.id,userId:input.userId,type:'PURCHASE_VOID',referenceType:'purchase',referenceId:input.purchaseId,amountIn:Number(purchase.paid),note:'عكس دفع شراء ملغى'}) }
  run(db,"UPDATE purchases SET status='voided',notes=? WHERE id=?",[input.reason||'إلغاء',input.purchaseId])
  run(db,'INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)',[uuid(),input.userId,'VOID','purchase',input.purchaseId,JSON.stringify({status:'voided',reason:input.reason})])
  enqueueSync(db,{entityType:'purchase',entityId:input.purchaseId,operation:'void',payload:mapEntity(db,'purchase',input.purchaseId)})
  return {ok:true,id:input.purchaseId,status:'voided'}
 })
}
