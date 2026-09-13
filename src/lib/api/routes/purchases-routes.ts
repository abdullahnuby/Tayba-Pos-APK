// Purchases (supplier invoices) and purchase returns.
import { getDb, query } from '../../db/client'
import { completePurchase } from '../../services/purchaseService'
import { returnPurchase } from '../../services/returnsService'
import { jsonResponse, body, type RouteCtx } from '../shared'

export async function handlePurchasesRoutes(ctx: RouteCtx): Promise<Response | null> {
  const { req, u, p, method, user } = ctx
  if(p==='/purchase-returns' && method==='GET'){ const db=await getDb(); return jsonResponse({items:query<any>(db,'SELECT pr.*,p.invoice_no invoiceNo,s.name supplierName FROM purchase_returns pr JOIN purchases p ON p.id=pr.purchase_id JOIN suppliers s ON s.id=pr.supplier_id ORDER BY pr.date DESC LIMIT 100')}) }
  const purId=p.match(/^\/purchases\/([^/]+)$/); if(purId&&method==='GET'){const db=await getDb();const r=query<any>(db,'SELECT p.*,s.name supplierName FROM purchases p JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=?',[purId[1]])[0];if(!r)return jsonResponse({error:'غير موجود'},404);return jsonResponse({...r,items:query<any>(db,'SELECT i.*,v.sku,v.size,v.color,pr.name product_name FROM purchase_items i JOIN product_variants v ON v.id=i.variant_id JOIN products pr ON pr.id=v.product_id WHERE i.purchase_id=?',[purId[1]])})}
  if(p==='/purchases' && method==='GET'){
    const db=await getDb()
    const purchases=query<any>(db,'SELECT pu.*,su.name supplierName FROM purchases pu LEFT JOIN suppliers su ON su.id=pu.supplier_id ORDER BY pu.date DESC LIMIT 100')
    const itemsByPurchase=new Map<string,any[]>()
    const itemRows=query<any>(db,`SELECT pi.*,v.sku variant_sku,v.size variant_size,v.color variant_color,p.id product_id,p.name product_name
      FROM purchase_items pi JOIN product_variants v ON v.id=pi.variant_id JOIN products p ON p.id=v.product_id
      ORDER BY pi.purchase_id,pi.id`)
    for(const r of itemRows){
      const arr=itemsByPurchase.get(r.purchase_id) || []
      arr.push({id:r.id,variantId:r.variant_id,quantity:Number(r.quantity||0),unitCost:Number(r.unit_cost||0),total:Number(r.total||0),
        enteredQuantity:r.entered_quantity==null?null:Number(r.entered_quantity),unit:r.unit||null,unitFactor:r.unit_factor==null?null:Number(r.unit_factor),
        variant:{sku:r.variant_sku,size:r.variant_size||null,color:r.variant_color||null,product:{id:r.product_id,name:r.product_name}}})
      itemsByPurchase.set(r.purchase_id,arr)
    }
    return jsonResponse({items:purchases.map((r:any)=>({...r,date:r.date||r.created_at||null,createdAt:r.created_at||r.date||null,
      supplier:r.supplier_id?{id:r.supplier_id,name:r.supplierName||'بدون مورد'}:null,items:itemsByPurchase.get(r.id)||[]}))})
  }
  if(p==='/purchases' && method==='POST'){const b=await body(req);const db=await getDb();const paymentMethod=b.paymentMethod||'cash';const paid=Number(b.paid||0);let registerSessionId=b.registerSessionId||null;if(paid>0&&paymentMethod==='cash'&&!registerSessionId){registerSessionId=query<any>(db,"SELECT id FROM register_sessions WHERE user_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1",[user!.id])[0]?.id||null;}if(paid>0&&paymentMethod==='cash'&&!registerSessionId)return jsonResponse({error:'يلزم وجود وردية مفتوحة لدفع الشراء نقدًا'},400);return jsonResponse(await completePurchase({userId:user!.id,registerSessionId,supplierId:b.supplierId,lines:(b.items||[]).map((x:any)=>({variantId:x.variantId,quantity:Number(x.quantity||0),unitCost:Number(x.unitCost||0),enteredQuantity:x.enteredQuantity,unit:x.unit,unitFactor:x.unitFactor})),discount:Number(b.discount||0),paid,taxRate:Number(b.taxRate||0),paymentMethod,notes:b.notes,idempotencyKey:b.idempotencyKey || req.headers.get('Idempotency-Key') || undefined}))}
  const pum=p.match(/^\/purchases\/([^/]+)$/);if(pum&&method==='GET'){
    const db=await getDb()
    const r=query<any>(db,'SELECT pu.*,su.name supplierName FROM purchases pu LEFT JOIN suppliers su ON su.id=pu.supplier_id WHERE pu.id=?',[pum[1]])[0]
    if(!r)return jsonResponse({error:'غير موجود'},404)
    const itemRows=query<any>(db,`SELECT pi.*,v.sku variant_sku,v.size variant_size,v.color variant_color,p.id product_id,p.name product_name
      FROM purchase_items pi JOIN product_variants v ON v.id=pi.variant_id JOIN products p ON p.id=v.product_id WHERE pi.purchase_id=? ORDER BY pi.id`,[pum[1]])
    return jsonResponse({...r,date:r.date||r.created_at||null,createdAt:r.created_at||r.date||null,
      supplier:r.supplier_id?{id:r.supplier_id,name:r.supplierName||'بدون مورد'}:null,
      items:itemRows.map((x:any)=>({id:x.id,variantId:x.variant_id,quantity:Number(x.quantity||0),unitCost:Number(x.unit_cost||0),total:Number(x.total||0),
        enteredQuantity:x.entered_quantity==null?null:Number(x.entered_quantity),unit:x.unit||null,unitFactor:x.unit_factor==null?null:Number(x.unit_factor),
        variant:{sku:x.variant_sku,size:x.variant_size||null,color:x.variant_color||null,product:{id:x.product_id,name:x.product_name}}}))})
  } if(pum&&method==='PATCH'){const b=await body(req);if(b.action==='void'){if(user!.role==='cashier')return jsonResponse({error:'الكاشير لا يملك إلغاء المشتريات'},403);return jsonResponse(await (await import('../../services/purchaseService')).voidPurchase({userId:user!.id,purchaseId:pum[1],reason:b.voidReason||'إلغاء'}))}return jsonResponse({error:'إجراء غير معروف'},400)}
  if(p==='/purchase-returns'&&method==='POST'){if(user!.role==='cashier')return jsonResponse({error:'الكاشير لا يملك صلاحية مرتجعات الشراء'},403);const b=await body(req);const lines=(b.items||[]).map((x:any)=>({variantId:x.variantId,quantity:Number(x.quantity||0),purchaseItemId:x.purchaseItemId}));if(lines.some((x:any)=>x.purchaseItemId&&!x.variantId)){const db=await getDb();for(const x of lines){if(x.purchaseItemId&&!x.variantId)x.variantId=query<any>(db,'SELECT variant_id FROM purchase_items WHERE id=? AND purchase_id=?',[x.purchaseItemId,b.purchaseId])[0]?.variant_id}}return jsonResponse(await returnPurchase({userId:user!.id,purchaseId:b.purchaseId,supplierId:b.supplierId,refundMethod:b.refundMethod||b.paymentMethod||'credit',idempotencyKey:b.idempotencyKey || req.headers.get('Idempotency-Key') || undefined,lines:lines.map((x:any)=>({variantId:x.variantId,quantity:x.quantity})),reason:b.reason,notes:b.notes}))}

  return null
}
