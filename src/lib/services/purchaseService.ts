import { v4 as uuid } from 'uuid'
import type { Database } from 'sql.js'
import { query, run, withTransaction } from '../db/client'
import { applyStockDelta } from '../repositories/inventory'
import { enqueueSync } from '../sync/queue'
import { mapEntity } from '../sync/mapper'
import { addSupplierCredit, addSupplierDebit, addCash } from '../accounting'
import type { PaymentMethod } from '../types'
import { toCents, fromCents } from '../money'

export interface PurchaseLine { variantId:string; quantity:number; unitCost:number; enteredQuantity?:number; unit?:string; unitFactor?:number }
export interface CompletePurchaseInput { userId:string; registerSessionId?:string|null; supplierId:string; lines:PurchaseLine[]; discount?:number; taxRate?:number; paid:number; paymentMethod?:PaymentMethod; notes?:string; idempotencyKey?:string }

function nextDocumentNo(db:Database,type:'PURCHASE'){const d=new Date();const key=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;const row=query<{current_value:number}>(db,'SELECT current_value FROM document_sequences WHERE document_type=? AND date_key=?',[type,key])[0];const n=(row?.current_value??0)+1;run(db,`INSERT INTO document_sequences(document_type,date_key,current_value) VALUES(?,?,?) ON CONFLICT(document_type,date_key) DO UPDATE SET current_value=excluded.current_value`,[type,key,n]);return `${key}${String(n).padStart(4,'0')}`}

export async function completePurchase(input:CompletePurchaseInput){
  if(!input.lines.length)throw new Error('فاتورة الشراء فارغة')
  if(input.paid<0)throw new Error('المدفوع غير صحيح')
  const paymentMethod=input.paymentMethod??'cash'
  if(!['cash','card','transfer','credit'].includes(paymentMethod))throw new Error('طريقة الدفع غير صحيحة')
  if(paymentMethod==='credit' && input.paid>0)throw new Error('الشراء الآجل لا يسجل دفعة مقدمة')
  return withTransaction(db=>{
    if(input.idempotencyKey){const prior=query<any>(db,'SELECT id,invoice_no,total,paid FROM purchases WHERE idempotency_key=? LIMIT 1',[input.idempotencyKey])[0];if(prior)return {id:prior.id,invoiceNo:prior.invoice_no,total:Number(prior.total),due:Math.max(0,Number(prior.total)-Number(prior.paid))}}
    if(!query(db,'SELECT id FROM suppliers WHERE id=?',[input.supplierId])[0])throw new Error('المورد غير موجود')
    const lines=new Map<string,PurchaseLine>()
    for(const l of input.lines){
      if(!Number.isInteger(l.quantity)||l.quantity<=0)throw new Error('كمية شراء غير صحيحة')
      if(l.unitCost<0)throw new Error('تكلفة الشراء غير صحيحة')
      const factor=Math.max(1,Number(l.unitFactor)||1)
      const unitKey=String(l.unit||'piece')
      const costKey=toCents(l.unitCost)
      const key=`${l.variantId}:${unitKey}:${factor}:${costKey}`
      const old=lines.get(key)
      lines.set(key,old?{...old,quantity:old.quantity+l.quantity}:({...l,unitFactor:factor}))
    }
    let subtotalCents=0
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
      const normalizedKey=`${l.variantId}:${String(l.unit||'piece')}:${factor}:${toCents(l.unitCost)}`
      normalized.set(normalizedKey, normalizedLine)
      subtotalCents += toCents(enteredQuantity * Number(l.unitCost))
    }
    const roundedSubtotal=fromCents(subtotalCents)
    const discountCents=Math.max(0,toCents(input.discount??0))
    const discount=fromCents(discountCents)
    const taxRate=Math.max(0,input.taxRate??0)
    const taxableCents=Math.max(0,subtotalCents-discountCents)
    const taxAmountCents=Math.round(taxableCents*(taxRate/100))
    const taxAmount=fromCents(taxAmountCents)
    const totalCents=taxableCents+taxAmountCents
    const total=fromCents(totalCents)
    const paidCents=toCents(input.paid)
    if(paidCents>totalCents)throw new Error('المدفوع أكبر من الإجمالي')
    const id=uuid(), invoiceNo=nextDocumentNo(db,'PURCHASE')
    run(db,`INSERT INTO purchases(id,invoice_no,supplier_id,register_session_id,subtotal,discount,tax_rate,tax_amount,total,paid,status,notes,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,'completed',?,?)`,[id,invoiceNo,input.supplierId,input.registerSessionId??null,roundedSubtotal,discount,taxRate,taxAmount,total,fromCents(paidCents),input.notes??null,input.idempotencyKey??null])
    for(const l of normalized.values()){
      const factor = Math.max(1, Number(l.unitFactor)||1)
      const enteredQuantity = Number(l.enteredQuantity ?? (l.quantity/factor))
      const itemTotal = fromCents(toCents(enteredQuantity * Number(l.unitCost)))
      const baseUnitCost = fromCents(toCents(Number(l.unitCost)/factor))
      run(db,`INSERT INTO purchase_items(id,purchase_id,variant_id,quantity,unit_cost,total,entered_quantity,unit,unit_factor) VALUES(?,?,?,?,?,?,?,?,?)`,[uuid(),id,l.variantId,l.quantity,baseUnitCost,itemTotal,enteredQuantity,l.unit??'piece',factor])
      applyStockDelta(db,{variantId:l.variantId,quantityChange:l.quantity,type:'PURCHASE',referenceType:'purchase',referenceId:id})
      const old=query<{quantity:number;cost_price:number}>(db,'SELECT quantity,cost_price FROM product_variants WHERE id=?',[l.variantId])[0]!; const oldQty=Math.max(0,old.quantity-l.quantity); const newQty=old.quantity; const weighted=(newQty>0?((oldQty*old.cost_price)+(l.quantity*baseUnitCost))/newQty:baseUnitCost); run(db,"UPDATE product_variants SET cost_price=?,updated_at=datetime('now') WHERE id=?",[weighted,l.variantId])
    }
    const due=fromCents(totalCents-paidCents)
    if(due>0){run(db,"UPDATE suppliers SET balance=balance+?,updated_at=datetime('now') WHERE id=?",[due,input.supplierId]);addSupplierCredit(db,input.supplierId,due,'purchase',id,'مستحق للمورد')}
    if(paidCents>0&&input.registerSessionId&&paymentMethod==='cash') addCash(db,{sessionId:input.registerSessionId,userId:input.userId,type:'PURCHASE',referenceType:'purchase',referenceId:id,amountOut:fromCents(paidCents),note:'دفع شراء نقدي'})
    if(paidCents>0){const pid=uuid();run(db,`INSERT INTO supplier_payments(id,supplier_id,purchase_id,amount,method,notes,idempotency_key,register_session_id) VALUES(?,?,?,?,?,?,?,?)`,[pid,input.supplierId,id,fromCents(paidCents),paymentMethod,'دفعة أثناء إنشاء فاتورة شراء',`purchase-payment:${id}`,input.registerSessionId??null]);enqueueSync(db,{entityType:'supplier_payment',entityId:pid,operation:'create',payload:mapEntity(db,'supplier_payment',pid)})}
    run(db,`INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`,[uuid(),input.userId,'CREATE','purchase',id,JSON.stringify({invoiceNo,total,paid:fromCents(paidCents)})])
    enqueueSync(db,{entityType:'purchase',entityId:id,operation:'create',payload:mapEntity(db,'purchase',id)})
    return {id,invoiceNo,total,due}
  })
}

export async function voidPurchase(input:{userId:string;purchaseId:string;reason:string}) {
 return withTransaction(db=>{
  const purchase=query<any>(db,'SELECT * FROM purchases WHERE id=?',[input.purchaseId])[0]
  if(!purchase||purchase.status==='voided') throw new Error('الفاتورة غير موجودة أو ملغاة')
  const items=query<any>(db,'SELECT * FROM purchase_items WHERE purchase_id=?',[input.purchaseId])
  for(const item of items){ const stock=query<any>(db,'SELECT quantity FROM product_variants WHERE id=?',[item.variant_id])[0]; if(!stock || Number(stock.quantity)<Number(item.quantity)) throw new Error('لا يمكن إلغاء الشراء: المخزون الحالي أقل من الكمية التي ستُسحب'); applyStockDelta(db,{variantId:item.variant_id,quantityChange:-item.quantity,type:'PURCHASE_RETURN',referenceType:'purchase_void',referenceId:input.purchaseId}) }
  const due=Math.max(0,Number(purchase.total)-Number(purchase.paid))
  if(due) { run(db,"UPDATE suppliers SET balance=MAX(0,balance-?),updated_at=datetime('now') WHERE id=?",[due,purchase.supplier_id]); addSupplierDebit(db,purchase.supplier_id,due,'purchase_void',input.purchaseId,'عكس مديونية فاتورة شراء ملغاة') }
  if(Number(purchase.paid)>0){
    const payments=query<{method:string;amount:number}>(
      db,
      'SELECT method,amount FROM supplier_payments WHERE purchase_id=?',
      [input.purchaseId]
    )
    const cashRefund=payments
      .filter((p)=>p.method==='cash')
      .reduce((sum,p)=>sum+Number(p.amount||0),0)

    if(cashRefund>0){
      const session=query<any>(
        db,
        "SELECT id FROM register_sessions WHERE id=? AND status='open'",
        [purchase.register_session_id]
      )[0] || query<any>(
        db,
        "SELECT id FROM register_sessions WHERE status='open' ORDER BY opened_at DESC LIMIT 1"
      )[0]

      if(!session)
        throw new Error('لا توجد وردية مفتوحة لتسجيل عكس الدفع النقدي')

      addCash(db,{
        sessionId:session.id,
        userId:input.userId,
        type:'PURCHASE_VOID',
        referenceType:'purchase',
        referenceId:input.purchaseId,
        amountIn:cashRefund,
        note:'عكس دفع شراء نقدي ملغى'
      })
    }
  }
  run(db,"UPDATE purchases SET status='voided',notes=? WHERE id=?",[input.reason||'إلغاء',input.purchaseId])
  run(db,'INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)',[uuid(),input.userId,'VOID','purchase',input.purchaseId,JSON.stringify({status:'voided',reason:input.reason})])
  enqueueSync(db,{entityType:'purchase',entityId:input.purchaseId,operation:'void',payload:mapEntity(db,'purchase',input.purchaseId)})
  return {ok:true,id:input.purchaseId,status:'voided'}
 })
}
