import { query, run, withTransaction } from '../db/client'
import { applyStockDelta } from '../repositories/inventory'
import type { Database } from 'sql.js'
import { v4 as uuid } from 'uuid'
import type { CartLine, PaymentMethod } from '../types'
import { enqueueSync } from '../sync/queue'
import { mapEntity } from '../sync/mapper'
import { addCustomerDebit, addCustomerCredit, addCash } from '../accounting'
import { checkLocalSalePrice } from '../pricing'

export interface CompleteSaleInput { userId:string; registerSessionId:string; customerId?:string|null; cart:Array<CartLine & {lineTotal?:number}>; discount:number; paid:number; paymentMethod:PaymentMethod; notes?:string; managerApproved?:boolean; role?:'admin'|'manager'|'cashier'; status?:'completed'|'draft'; date?:string; idempotencyKey?:string }
export interface CompletedSale { id:string; invoiceNo:string; total:number; change:number; status:'completed'|'draft'; paid:number; paymentMethod:PaymentMethod }

function roundMoney(value:number){ return Math.round((Number(value)||0)*100 + Number.EPSILON) / 100 }

function nextDocumentNo(db:Database,type:'SALE'){const d=new Date();const key=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;const row=query<{current_value:number}>(db,'SELECT current_value FROM document_sequences WHERE document_type=? AND date_key=?',[type,key])[0];const n=(row?.current_value??0)+1;run(db,`INSERT INTO document_sequences(document_type,date_key,current_value) VALUES(?,?,?) ON CONFLICT(document_type,date_key) DO UPDATE SET current_value=excluded.current_value`,[type,key,n]);return `${key}${String(n).padStart(4,'0')}`}

export async function completeSale(input:CompleteSaleInput):Promise<CompletedSale>{
 if(!input.cart.length)throw new Error('الفاتورة فارغة')
 if(input.discount<0)throw new Error('الخصم غير صحيح')
 if(input.paymentMethod==='credit'&&!input.customerId)throw new Error('البيع الآجل يحتاج عميل')
 return withTransaction(db=>{
  const status=input.status??'completed'
  const session=query<any>(db,"SELECT id,user_id FROM register_sessions WHERE id=? AND status='open'",[input.registerSessionId])[0]
  if(status==='completed'&&!session)throw new Error('لا توجد وردية مفتوحة')
  if(status==='completed'&&input.role==='cashier'&&session.user_id!==input.userId)throw new Error('لا يمكن للكاشير استخدام وردية كاشير آخر')
  if(input.idempotencyKey){const existing=query<{id:string;invoice_no:string;total:number;change:number;paid:number;payment_method:PaymentMethod;status:'completed'|'draft'}>(db,'SELECT id,invoice_no,total,change,paid,payment_method,status FROM sales WHERE idempotency_key=? LIMIT 1',[input.idempotencyKey])[0];if(existing)return {id:existing.id,invoiceNo:existing.invoice_no,total:existing.total,change:existing.change,status:existing.status,paid:existing.paid??0,paymentMethod:existing.payment_method??'cash'}}
  const merged=new Map<string,CartLine & {lineTotal?:number}>(); for(const line of input.cart){if(!Number.isInteger(line.quantity)||line.quantity<=0)throw new Error('كمية غير صحيحة');const priceKey=Math.round((Number(line.price)||0)*100);const key=`${line.variantId}:${priceKey}`;const prev=merged.get(key);if(prev){const previousTotal=prev.lineTotal != null ? Number(prev.lineTotal) : Number(prev.price)*prev.quantity;const nextTotal=line.lineTotal != null ? Number(line.lineTotal) : Number(line.price)*line.quantity;merged.set(key,{...prev,quantity:prev.quantity+line.quantity,lineTotal:roundMoney(previousTotal+nextTotal)})}else{merged.set(key,{...line,lineTotal:line.lineTotal == null ? roundMoney(Number(line.price)*line.quantity) : roundMoney(Number(line.lineTotal))})}}
  let subtotalCents=0; const variantCache=new Map<string,{quantity:number;cost_price:number;sell_price:number;name:string;sku:string}>()
  for(const line of merged.values()){const row=query<any>(db,'SELECT pv.quantity,pv.cost_price,pv.sell_price,p.name,pv.sku FROM product_variants pv JOIN products p ON p.id=pv.product_id WHERE pv.id=?',[line.variantId])[0];if(!row)throw new Error(`الصنف غير موجود: ${line.sku}`);variantCache.set(line.variantId,row); if(status==='completed'&&row.quantity<line.quantity)throw new Error(`المخزون غير كافٍ لـ ${row.name} (${row.sku})`); if(status==='completed'){const priceCheck=checkLocalSalePrice(db,line.variantId,line.price,input.role??'cashier',!!input.managerApproved);if(!priceCheck.ok)throw new Error(priceCheck.error||'السعر غير مسموح')} subtotalCents += line.lineTotal != null ? Math.round((Number(line.lineTotal)||0)*100) : Math.round((Number(line.price)||0)*100)*line.quantity}
  const discountCents=Math.max(0,Math.round((Number(input.discount)||0)*100));
  if(status==='completed' && input.role==='cashier' && !input.managerApproved && discountCents>Math.round(subtotalCents*0.05)) throw new Error('خصم الكاشير يتجاوز 5% ويحتاج موافقة المدير')
  const paidCents=Math.max(0,Math.round((Number(input.paid)||0)*100));
  if(discountCents>subtotalCents)throw new Error('الخصم أكبر من الإجمالي')
  if(status==='draft'){if(paidCents>0)throw new Error('المسودة لا تسجل دفعة');}
  const totalCents=Math.max(0,subtotalCents-discountCents);
  if(status==='completed'&&input.paymentMethod!=='credit'&&paidCents<totalCents) throw new Error('المبلغ المدفوع أقل من الإجمالي')
  if(status==='completed'&&input.paymentMethod!=='credit'&&paidCents<totalCents&&!input.customerId)throw new Error('الدفع الجزئي يحتاج عميل')
  const subtotal=roundMoney(subtotalCents/100); const discount=roundMoney(discountCents/100); const paid=roundMoney(paidCents/100); const total=roundMoney(totalCents/100);
  const effectivePaid=input.paymentMethod==='credit'?0:Math.min(paidCents,totalCents)/100;
  const change=input.paymentMethod==='credit'?0:roundMoney(Math.max(0,paidCents-totalCents)/100)
  const receivable=input.paymentMethod==='credit'?total:roundMoney(Math.max(0,totalCents-paidCents)/100)
  const saleId=uuid(), invoiceNo=nextDocumentNo(db,'SALE'), notes=`${input.notes??''}${input.idempotencyKey?` [idem:${input.idempotencyKey}]`:''}`.trim()||null
  run(db,`INSERT INTO sales(id,invoice_no,user_id,customer_id,register_session_id,date,subtotal,discount,total,paid,change,payment_method,status,notes,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[saleId,invoiceNo,input.userId,input.customerId??null,input.registerSessionId,input.date??new Date().toISOString(),subtotal,discount,total,effectivePaid,change,input.paymentMethod,status,notes,input.idempotencyKey??null])
  for(const line of merged.values()){const v=variantCache.get(line.variantId)!; run(db,`INSERT INTO sale_items(id,sale_id,variant_id,quantity,unit_price,unit_cost,total) VALUES(?,?,?,?,?,?,?)`,[uuid(),saleId,line.variantId,line.quantity,line.price,v.cost_price,roundMoney(line.lineTotal != null ? Number(line.lineTotal) : line.price*line.quantity)]); if(status==='completed') applyStockDelta(db,{variantId:line.variantId,quantityChange:-line.quantity,type:'SALE',referenceType:'sale',referenceId:saleId})}
  if(status==='completed'){
   if(receivable>0&&input.customerId){run(db,"UPDATE customers SET balance=balance+?,updated_at=datetime('now') WHERE id=?",[receivable,input.customerId]);addCustomerDebit(db,input.customerId,receivable,'sale',saleId,'مستحق من الفاتورة')}
   if(input.paymentMethod==='cash'&&input.paid>0&&session){ const retainedCash=Math.min(input.paid,total); addCash(db,{sessionId:session.id,userId:input.userId,type:'SALE',referenceType:'sale',referenceId:saleId,amountIn:retainedCash,note:'تحصيل بيع نقدي'}) }
   run(db,`INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`,[uuid(),input.userId,'CREATE','sale',saleId,JSON.stringify({invoiceNo,total,paid:effectivePaid,paymentMethod:input.paymentMethod,managerApproved:!!input.managerApproved})])
   enqueueSync(db,{entityType:'sale',entityId:saleId,operation:'create',payload:mapEntity(db,'sale',saleId)})
  } else {run(db,`INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`,[uuid(),input.userId,'CREATE','sale',saleId,JSON.stringify({invoiceNo,status:'draft'})])}
  return {id:saleId,invoiceNo,total,change,status,paid:effectivePaid,paymentMethod:input.paymentMethod}
 })
}

export async function voidSale(input:{userId:string;saleId:string;reason:string}) {
 return withTransaction(db=>{
  const sale=query<any>(db,'SELECT * FROM sales WHERE id=?',[input.saleId])[0]
  if(!sale) throw new Error('الفاتورة غير موجودة')
  if(sale.status!=='completed') throw new Error('يمكن إلغاء الفواتير المكتملة فقط')
  const items=query<any>(db,'SELECT * FROM sale_items WHERE sale_id=?',[input.saleId])
  for(const item of items) applyStockDelta(db,{variantId:item.variant_id,quantityChange:item.quantity,type:'SALE_RETURN',referenceType:'sale_void',referenceId:input.saleId})
  if(sale.customer_id){ const receivable=Math.max(0,Number(sale.total)-Number(sale.paid)); if(receivable){run(db,"UPDATE customers SET balance=MAX(0,balance-?),updated_at=datetime('now') WHERE id=?",[receivable,sale.customer_id]); addCustomerCredit(db,sale.customer_id,receivable,'sale_void',input.saleId,'عكس مديونية فاتورة ملغاة')} }
  if(sale.payment_method==='cash'&&Number(sale.paid)>0){ const session=query<any>(db,"SELECT id FROM register_sessions WHERE id=? AND status='open'",[sale.register_session_id])[0] || query<any>(db,"SELECT id FROM register_sessions WHERE status='open' ORDER BY opened_at DESC LIMIT 1")[0]; if(!session) throw new Error('لا توجد وردية مفتوحة لتسجيل عكس النقد لهذه الفاتورة'); addCash(db,{sessionId:session.id,userId:input.userId,type:'SALE_VOID',referenceType:'sale',referenceId:input.saleId,amountOut:Number(sale.paid),note:'عكس تحصيل بيع ملغى'}) }
  run(db,"UPDATE sales SET status='voided',void_reason=? WHERE id=?",[input.reason||'إلغاء',input.saleId])
  run(db,'INSERT INTO audit_logs(id,user_id,action,entity,entity_id,before_json,after_json) VALUES(?,?,?,?,?,?,?)',[uuid(),input.userId,'VOID','sale',input.saleId,JSON.stringify({status:'completed'}),JSON.stringify({status:'voided',reason:input.reason})])
  enqueueSync(db,{entityType:'sale',entityId:input.saleId,operation:'void',payload:mapEntity(db,'sale',input.saleId)})
  return {ok:true,id:input.saleId,status:'voided'}
 })
}

export async function resumeSale(input:{userId:string;saleId:string}) {
 return withTransaction(db=>{
  const sale=query<any>(db,'SELECT * FROM sales WHERE id=?',[input.saleId])[0]
  if(!sale||sale.status!=='draft') throw new Error('يمكن استئناف الفواتير المسودة فقط')
  const session=query<{id:string}>(db,"SELECT id FROM register_sessions WHERE id=? AND status='open'",[sale.register_session_id])[0]
  if(!session) throw new Error('لا توجد وردية مفتوحة لاستئناف الفاتورة')
  const items=query<any>(db,'SELECT * FROM sale_items WHERE sale_id=?',[input.saleId])
  for(const item of items){const stock=query<{quantity:number}>(db,'SELECT quantity FROM product_variants WHERE id=?',[item.variant_id])[0];if(!stock||Number(stock.quantity)<Number(item.quantity))throw new Error('المخزون الحالي غير كافٍ لاستئناف الفاتورة')}
  for(const item of items) applyStockDelta(db,{variantId:item.variant_id,quantityChange:-item.quantity,type:'SALE',referenceType:'sale',referenceId:input.saleId})
  const receivable=Math.max(0,Number(sale.total)-Number(sale.paid))
  if(receivable>0&&sale.customer_id){run(db,"UPDATE customers SET balance=balance+?,updated_at=datetime('now') WHERE id=?",[receivable,sale.customer_id]);addCustomerDebit(db,sale.customer_id,receivable,'sale',input.saleId,'استحقاق فاتورة مستأنفة')}
  if(sale.payment_method==='cash'&&Number(sale.paid)>0)addCash(db,{sessionId:session.id,userId:input.userId,type:'SALE',referenceType:'sale',referenceId:input.saleId,amountIn:Math.min(Number(sale.paid),Number(sale.total)),note:'تحصيل فاتورة مستأنفة'})
  run(db,"UPDATE sales SET status='completed' WHERE id=?",[input.saleId])
  run(db,'INSERT INTO audit_logs(id,user_id,action,entity,entity_id,before_json,after_json) VALUES(?,?,?,?,?,?,?)',[uuid(),input.userId,'UPDATE','sale',input.saleId,JSON.stringify({status:'draft'}),JSON.stringify({status:'completed'})])
  enqueueSync(db,{entityType:'sale',entityId:input.saleId,operation:'resume',payload:mapEntity(db,'sale',input.saleId)})
  return query<any>(db,'SELECT * FROM sales WHERE id=?',[input.saleId])[0]
 })
}
