import { v4 as uuid } from 'uuid'
import { query, run, withTransaction } from '../db/client'
import { applyStockDelta } from '../repositories/inventory'
import { enqueueSync } from '../sync/queue'
import type { Database } from 'sql.js'
import type { PaymentMethod } from '../types'
import { mapEntity } from '../sync/mapper'
import { addCustomerCredit, addSupplierDebit, addCash } from '../accounting'

export interface SaleReturnLine { saleItemId:string; variantId:string; quantity:number }
export interface PurchaseReturnLine { variantId:string; quantity:number }
function nextNo(db:Database,type:'SALE_RETURN'|'PURCHASE_RETURN'){const d=new Date();const key=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;const row=query<{current_value:number}>(db,'SELECT current_value FROM document_sequences WHERE document_type=? AND date_key=?',[type,key])[0];const n=(row?.current_value??0)+1;run(db,`INSERT INTO document_sequences(document_type,date_key,current_value) VALUES(?,?,?) ON CONFLICT(document_type,date_key) DO UPDATE SET current_value=excluded.current_value`,[type,key,n]);return `${key}${String(n).padStart(4,'0')}`}

export async function returnSale(input:{userId:string;saleId:string;customerId?:string|null;lines:SaleReturnLine[];refundMethod?:PaymentMethod;reason?:string;notes?:string;idempotencyKey?:string}){
 return withTransaction(db=>{
  if(!input.lines.length)throw new Error('لم يتم اختيار أصناف للمرتجع')
  if(input.idempotencyKey){ const prior=query<{id:string;return_no:string;total:number}>(db,'SELECT id,return_no,total FROM sale_returns WHERE notes LIKE ? LIMIT 1',[`%[idem:${input.idempotencyKey}]%`])[0]; if(prior) return {id:prior.id,returnNo:prior.return_no,total:Number(prior.total),refundMethod:input.refundMethod??'cash'} }
  const sale=query<{id:string;customer_id:string|null;status:string}>(db,'SELECT id,customer_id,status FROM sales WHERE id=?',[input.saleId])[0];if(!sale||sale.status!=='completed')throw new Error('الفاتورة غير صالحة للمرتجع')
  const map=new Map<string,SaleReturnLine>();for(const l of input.lines){if(!Number.isInteger(l.quantity)||l.quantity<=0)throw new Error('كمية مرتجع غير صحيحة');const old=map.get(l.saleItemId);map.set(l.saleItemId,old?{...old,quantity:old.quantity+l.quantity}:({...l}))}
  let total=0;const rows:{id:string;variantId:string;qty:number;unitPrice:number}[]=[]
  for(const l of map.values()){
   const row=query<{id:string;variant_id:string;quantity:number;unit_price:number}>(db,'SELECT id,variant_id,quantity,unit_price FROM sale_items WHERE id=? AND sale_id=?',[l.saleItemId,input.saleId])[0];if(!row)throw new Error('بند الفاتورة غير موجود')
   if(row.variant_id!==l.variantId)throw new Error('الصنف لا يطابق بند الفاتورة')
   const already=query<{q:number}>(db,"SELECT COALESCE(SUM(quantity),0) q FROM sale_return_items WHERE sale_item_id=?",[row.id])[0]?.q??0
   if(already+l.quantity>row.quantity)throw new Error('كمية المرتجع تتجاوز الكمية المباعة')
   total+=row.unit_price*l.quantity;rows.push({id:row.id,variantId:row.variant_id,qty:l.quantity,unitPrice:row.unit_price})
  }
  const id=uuid(), no=nextNo(db,'SALE_RETURN'), customerId=input.customerId??sale.customer_id??null, refund=input.refundMethod??'cash', noteText=`${input.notes??''}${input.idempotencyKey?` [idem:${input.idempotencyKey}]`:''}`.trim()||null
  run(db,`INSERT INTO sale_returns(id,return_no,sale_id,customer_id,subtotal,total,reason,notes,status,refund_method) VALUES(?,?,?,?,?,?,?,?, 'completed',?)`,[id,no,input.saleId,customerId,total,total,input.reason??null,noteText,refund])
  for(const r of rows){run(db,`INSERT INTO sale_return_items(id,sale_return_id,sale_item_id,variant_id,quantity,unit_price,total) VALUES(?,?,?,?,?,?,?)`,[uuid(),id,r.id,r.variantId,r.qty,r.unitPrice,r.qty*r.unitPrice]);applyStockDelta(db,{variantId:r.variantId,quantityChange:r.qty,type:'SALE_RETURN',referenceType:'sale_return',referenceId:id})}
  if(refund==='credit'){ if(!customerId) throw new Error('المرتجع الآجل يحتاج عميل'); run(db,"UPDATE customers SET balance=balance-?,updated_at=datetime('now') WHERE id=?",[total,customerId]); addCustomerCredit(db,customerId,total,'sale_return',id,'خصم مرتجع من مديونية العميل') }
  else if(refund==='cash'){ const session=query<{id:string}>(db,"SELECT id FROM register_sessions WHERE status='open' ORDER BY opened_at DESC LIMIT 1")[0]; if(!session)throw new Error('يلزم وجود وردية مفتوحة لرد النقد'); addCash(db,{sessionId:session.id,userId:input.userId,type:'SALE_RETURN',referenceType:'sale_return',referenceId:id,amountOut:total,note:'رد مرتجع نقدي'}) }
  run(db,`INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`,[uuid(),input.userId,'CREATE','sale_return',id,JSON.stringify({returnNo:no,saleId:input.saleId,total})])
  enqueueSync(db,{entityType:'sale_return',entityId:id,operation:'create',payload:mapEntity(db,'sale_return',id)})
  return {id,returnNo:no,total,refundMethod:refund}
 })
}

export async function returnPurchase(input:{userId:string;purchaseId:string;supplierId:string;lines:PurchaseReturnLine[];refundMethod?:PaymentMethod;reason?:string;notes?:string;idempotencyKey?:string}){
 return withTransaction(db=>{
  if(!input.lines.length)throw new Error('لم يتم اختيار أصناف للمرتجع')
  if(input.idempotencyKey){ const prior=query<{id:string;return_no:string;total:number}>(db,'SELECT id,return_no,total FROM purchase_returns WHERE notes LIKE ? LIMIT 1',[`%[idem:${input.idempotencyKey}]%`])[0]; if(prior) return {id:prior.id,returnNo:prior.return_no,total:Number(prior.total),refundMethod:input.refundMethod??'credit'} }
  const purchase=query<{id:string;supplier_id:string;status:string}>(db,'SELECT id,supplier_id,status FROM purchases WHERE id=?',[input.purchaseId])[0];if(!purchase||purchase.status!=='completed'||purchase.supplier_id!==input.supplierId)throw new Error('فاتورة الشراء غير صالحة')
  let total=0;const rows:{variantId:string;qty:number;cost:number}[]=[]
  for(const l of input.lines){if(!Number.isInteger(l.quantity)||l.quantity<=0)throw new Error('كمية مرتجع غير صحيحة');const row=query<{variant_id:string;quantity:number;unit_cost:number}>(db,`SELECT variant_id,quantity,unit_cost FROM purchase_items WHERE purchase_id=? AND variant_id=? LIMIT 1`,[input.purchaseId,l.variantId])[0];if(!row)throw new Error('الصنف غير موجود في فاتورة الشراء');const already=query<{q:number}>(db,"SELECT COALESCE(SUM(quantity),0) q FROM purchase_return_items pri JOIN purchase_returns pr ON pr.id=pri.purchase_return_id WHERE pr.purchase_id=? AND pri.variant_id=?",[input.purchaseId,l.variantId])[0]?.q??0;if(already+l.quantity>row.quantity)throw new Error('كمية المرتجع تتجاوز الكمية المشتراة');total+=row.unit_cost*l.quantity;rows.push({variantId:l.variantId,qty:l.quantity,cost:row.unit_cost})}
  const id=uuid(),no=nextNo(db,'PURCHASE_RETURN'),refund=input.refundMethod??'credit',noteText=`${input.notes??''}${input.idempotencyKey?` [idem:${input.idempotencyKey}]`:''}`.trim()||null
  run(db,`INSERT INTO purchase_returns(id,return_no,purchase_id,supplier_id,total,reason,notes,status) VALUES(?,?,?,?,?,?,?,'completed')`,[id,no,input.purchaseId,input.supplierId,total,input.reason??null,noteText])
  for(const r of rows){run(db,`INSERT INTO purchase_return_items(id,purchase_return_id,variant_id,quantity,unit_cost,total) VALUES(?,?,?,?,?,?)`,[uuid(),id,r.variantId,r.qty,r.cost,r.qty*r.cost]);applyStockDelta(db,{variantId:r.variantId,quantityChange:-r.qty,type:'PURCHASE_RETURN',referenceType:'purchase_return',referenceId:id})}
  run(db,"UPDATE suppliers SET balance=balance-?,updated_at=datetime('now') WHERE id=?",[total,input.supplierId]); addSupplierDebit(db,input.supplierId,total,'purchase_return',id,'خصم مرتجع مشتريات'); if(refund==='cash'){const session=query<{id:string}>(db,"SELECT id FROM register_sessions WHERE status='open' ORDER BY opened_at DESC LIMIT 1")[0];if(!session)throw new Error('يلزم وجود وردية مفتوحة لرد النقد للمورد');addCash(db,{sessionId:session.id,userId:input.userId,type:'PURCHASE_RETURN',referenceType:'purchase_return',referenceId:id,amountIn:total,note:'رد نقدي من المورد'})} else if(!['credit','card','transfer'].includes(refund)) throw new Error('طريقة رد غير صحيحة')
  run(db,`INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`,[uuid(),input.userId,'CREATE','purchase_return',id,JSON.stringify({returnNo:no,purchaseId:input.purchaseId,total})])
  enqueueSync(db,{entityType:'purchase_return',entityId:id,operation:'create',payload:mapEntity(db,'purchase_return',id)})
  return {id,returnNo:no,total,refundMethod:refund}
 })
}
