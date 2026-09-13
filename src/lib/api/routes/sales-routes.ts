// Sales (POS invoices), sale returns, register sessions (shifts), and cash drawer movements.
import { getDb, query, run } from '../../db/client'
import { completeSale } from '../../services/salesService'
import { returnSale } from '../../services/returnsService'
import { openSession, closeSession } from '../../repositories/registerSessions'
import { addCashMovement } from '../../repositories/cashMovements'
import { jsonResponse, body, verifyPin, serializeSaleById, type RouteCtx } from '../shared'

export async function handleSalesRoutes(ctx: RouteCtx): Promise<Response | null> {
  const { req, u, p, method, user } = ctx
  if(p==='/sales' && method==='GET'){ const db=await getDb(); const limit=Math.max(1,Math.min(Number(u.searchParams.get('pageSize')||100),500)); const status=u.searchParams.get('status')||''; const q=String(u.searchParams.get('search')||'').trim(); const from=u.searchParams.get('from')||''; const to=u.searchParams.get('to')||''; const where=["(?='' OR s.status=?)","(?='' OR s.invoice_no LIKE ? OR COALESCE(c.name,'') LIKE ?)","(?='' OR date(s.date)>=date(?))","(?='' OR date(s.date)<=date(?))"]; const params:any[]=[status,status,q,`%${q}%`,`%${q}%`,from,from,to,to]; if(user!.role==='cashier'){where.push('s.user_id=?');params.push(user!.id)} const rows=query<any>(db,`SELECT s.*,s.date date,s.created_at createdAt,c.name customerName,c.phone customerPhone,u.name userName,(SELECT COUNT(*) FROM sale_items i WHERE i.sale_id=s.id) itemsCount FROM sales s LEFT JOIN customers c ON c.id=s.customer_id LEFT JOIN users u ON u.id=s.user_id WHERE ${where.join(' AND ')} ORDER BY s.date DESC LIMIT ${limit}`,params); return jsonResponse({items:rows.map((x:any)=>({...x,customer:x.customerName?{name:x.customerName,phone:x.customerPhone||null}:null,user:x.userName?{name:x.userName}:null,date:x.date||x.createdAt||null}))}) }
  const saleId=p.match(/^\/sales\/([^/]+)$/); if(saleId && method==='PATCH'){const b=await body(req); if(b.action==='void'){if(user!.role==='cashier')return jsonResponse({error:'الكاشير لا يملك إلغاء الفواتير'},403); return jsonResponse(await (await import('../../services/salesService')).voidSale({userId:user!.id,saleId:saleId[1],reason:b.voidReason||'إلغاء'}))} if(b.action==='edit'){if(!['admin','manager'].includes(user!.role))return jsonResponse({error:'صلاحية غير كافية لتعديل الفواتير'},403); return jsonResponse(await (await import('../../services/salesService')).editSale({userId:user!.id,saleId:saleId[1],date:b.date,discount:b.discount,paymentMethod:b.paymentMethod,customerId:b.customerId,items:Array.isArray(b.items)?b.items.map((x:any)=>({variantId:x.variantId,quantity:Number(x.quantity),price:Number(x.price)})):undefined,reason:b.reason}))} if(b.action==='resume'){
      if(!['admin','manager'].includes(user!.role)){ const db=await getDb(); const target=query<any>(db,'SELECT user_id FROM sales WHERE id=?',[saleId[1]])[0]; if(target?.user_id!==user!.id)return jsonResponse({error:'لا تملك صلاحية استئناف هذه الفاتورة'},403) }
      let managerApproved=false
      if(b.managerApproved){
        const db=await getDb()
        const managerName=String(b.managerUsername||'').trim()
        const managerPin=String(b.managerPin||'')
        if(!managerName||!/^\d{4}$/.test(managerPin))return jsonResponse({error:'موافقة المدير تحتاج اسم مستخدم وPIN من 4 أرقام'},400)
        const mr=query<any>(db,'SELECT pin_hash,role FROM users WHERE username=? AND active=1',[managerName])[0]
        if(!mr||!['admin','manager'].includes(mr.role)||!(await verifyPin(managerPin,mr.pin_hash||'')))return jsonResponse({error:'PIN المدير غير صحيح'},403)
        managerApproved=true
      }
      return jsonResponse(await (await import('../../services/salesService')).resumeSale({userId:user!.id,saleId:saleId[1],managerApproved}))
    } return jsonResponse({error:'إجراء غير معروف'},400)}
  if(p==='/register-sessions' && method==='GET'){const db=await getDb();const scope=user!.role==='cashier'?'WHERE rs.user_id=?':'';const scopeParams=user!.role==='cashier'?[user!.id]:[];const rows=query<any>(db,`SELECT rs.*,rs.opened_at openedAt,rs.closed_at closedAt,u.name userName,COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.register_session_id=rs.id AND s.status='completed' AND s.payment_method='cash'),0) cashSales,COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.register_session_id=rs.id AND s.status='completed' AND s.payment_method='card'),0) cardSales,COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.register_session_id=rs.id AND s.status='completed' AND s.payment_method='transfer'),0) transferSales,COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.register_session_id=rs.id AND s.status='completed' AND s.payment_method='credit'),0) creditSales,COALESCE((SELECT COUNT(*) FROM sales s WHERE s.register_session_id=rs.id AND s.status='completed'),0) invoiceCount,COALESCE((SELECT SUM(sr.total) FROM sale_returns sr JOIN sales s ON s.id=sr.sale_id WHERE s.register_session_id=rs.id AND sr.status='completed' AND COALESCE(sr.refund_method,'cash')='cash'),0) cashRefunds FROM register_sessions rs JOIN users u ON u.id=rs.user_id ${scope} ORDER BY rs.opened_at DESC LIMIT ${user!.role==='cashier'?20:50}`,scopeParams);return jsonResponse({items:rows.map((x:any)=>({...x,userId:x.user_id,user:{name:x.userName},openedAt:x.openedAt||null,closedAt:x.closedAt||null,cashSales:Number(x.cashSales||0),cardSales:Number(x.cardSales||0),transferSales:Number(x.transferSales||0),creditSales:Number(x.creditSales||0),invoiceCount:Number(x.invoiceCount||0),cashRefunds:Number(x.cashRefunds||0)}))})}
  if(p==='/register-sessions' && method==='POST'){const b=await body(req);const pin=String(b.pin||'');if(!/^\d{4}$/.test(pin))return jsonResponse({error:'PIN يجب أن يكون 4 أرقام'},400);const db=await getDb();const row=query<any>(db,'SELECT pin_hash FROM users WHERE id=? AND active=1',[user!.id])[0];if(!row||!(await verifyPin(pin,row.pin_hash||'')))return jsonResponse({error:'PIN غير صحيح'},403);return jsonResponse(await openSession(user!.id,Number(b.openingFloat||0)),201)}
  if(p==='/register-sessions' && method==='PATCH'){const b=await body(req);const db=await getDb();const session=query<any>(db,'SELECT user_id FROM register_sessions WHERE id=?',[b.sessionId])[0];if(!session)return jsonResponse({error:'الوردية غير موجودة'},404);if(user!.role==='cashier'&&session.user_id!==user!.id)return jsonResponse({error:'لا تملك صلاحية هذه الوردية'},403);const pin=String(b.pin||'');if(!/^\d{4}$/.test(pin))return jsonResponse({error:'PIN يجب أن يكون 4 أرقام'},400);const row=query<any>(db,'SELECT pin_hash FROM users WHERE id=? AND active=1',[user!.id])[0];if(!row||!(await verifyPin(pin,row.pin_hash||'')))return jsonResponse({error:'PIN غير صحيح'},403);return jsonResponse(await closeSession(String(b.sessionId),Number(b.closingFloat||0)))}
  if(p==='/sales' && method==='POST'){const b=await body(req);let rs=b.registerSessionId; if(!rs){const db=await getDb();rs=query<any>(db,"SELECT id FROM register_sessions WHERE user_id=? AND status='open' ORDER BY opened_at DESC LIMIT 1",[user!.id])[0]?.id} if (b.managerApproved) { const db=await getDb(); const managerName=String(b.managerUsername||'').trim(); const managerPin=String(b.managerPin||''); if(!managerName||!/^\d{4}$/.test(managerPin)) return jsonResponse({error:'موافقة المدير تحتاج اسم مستخدم وPIN من 4 أرقام'},400); const mr=query<any>(db,'SELECT pin_hash,role FROM users WHERE username=? AND active=1',[managerName])[0]; if(!mr||!['admin','manager'].includes(mr.role)||!(await verifyPin(managerPin,mr.pin_hash||''))) return jsonResponse({error:'PIN المدير غير صحيح'},403) }
    const saved=await completeSale({userId:user!.id,registerSessionId:String(rs||''),customerId:b.customerId||null,cart:(b.items||[]).map((x:any)=>({variantId:x.variantId,name:x.name||'',sku:x.sku||'',price:Number(x.unitPrice ?? x.price ?? 0),quantity:Number(x.quantity||0),lineTotal:x.lineTotal == null ? undefined : Number(x.lineTotal),lineTotalCents:x.lineTotalCents == null ? undefined : Number(x.lineTotalCents),unit:x.unit||'piece',factor:Number(x.factor)||1})),discount:Number(b.discount||0),paid:Number(b.paid||0),paymentMethod:b.paymentMethod||'cash',notes:b.notes,role:user!.role,managerApproved:!!b.managerApproved,status:b.status==='draft'?'draft':'completed',date:b.date,idempotencyKey:b.idempotencyKey || req.headers.get('Idempotency-Key') || undefined}); const saleDb=await getDb(); const fullSale=serializeSaleById(saleDb,saved.id); if(!fullSale)return jsonResponse({error:'تم حفظ الفاتورة لكن تعذر تحميل تفاصيلها'},500); return jsonResponse(fullSale)}
  const salem=p.match(/^\/sales\/([^/]+)$/);if(salem&&method==='GET'){
    const db=await getDb()
    const s=query<any>(db,'SELECT * FROM sales WHERE id=?',[salem[1]])[0]
    if(!s)return jsonResponse({error:'not found'},404)
    if(user!.role==='cashier'&&s.user_id!==user!.id)return jsonResponse({error:'لا تملك صلاحية هذه الفاتورة'},403)
    const items=query<any>(db,`SELECT i.id,i.sale_id,i.variant_id,i.quantity,i.unit_price,i.unit_cost,i.total,
      v.sku,v.size,v.color,p.name product_name
      FROM sale_items i
      JOIN product_variants v ON v.id=i.variant_id
      JOIN products p ON p.id=v.product_id
      WHERE i.sale_id=? ORDER BY i.rowid`,[salem[1]]).map((r:any)=>({
        id:r.id,
        saleId:r.sale_id,
        variantId:r.variant_id,
        quantity:Number(r.quantity||0),
        unitPrice:Number(r.unit_price||0),
        unitCost:Number(r.unit_cost||0),
        total:Number(r.total||0),
        variant:{sku:r.sku,size:r.size||null,color:r.color||null,product:{name:r.product_name}},
      }))
    const customer=s.customer_id?query<any>(db,'SELECT name,phone FROM customers WHERE id=?',[s.customer_id])[0]:null
    const returns=query<any>(db,`SELECT sr.id,sr.return_no,sr.total,sr.refund_method,sri.sale_item_id,sri.quantity,sri.unit_price,sri.total line_total
      FROM sale_returns sr
      JOIN sale_return_items sri ON sri.sale_return_id=sr.id
      WHERE sr.sale_id=? AND sr.status='completed'
      ORDER BY sr.date,sr.id`,[salem[1]])
    type ReturnSummary = {
      id: string
      returnNo: string
      total: number
      refundMethod: string
      items: Array<{ saleItemId: string; quantity: number }>
    }
    const returnsById = new Map<string, ReturnSummary>()
    for (const r of returns) {
      let existing = returnsById.get(String(r.id))
      if (!existing) {
        existing = {
          id: String(r.id),
          returnNo: String(r.return_no ?? ''),
          total: Number(r.total || 0),
          refundMethod: String(r.refund_method || 'cash'),
          items: [],
        }
        returnsById.set(String(r.id), existing)
      }
      existing.items.push({
        saleItemId: String(r.sale_item_id),
        quantity: Number(r.quantity || 0),
      })
    }
    return jsonResponse({...s,invoiceNo:s.invoice_no,paymentMethod:s.payment_method,items,returns:[...returnsById.values()],customer:customer?{name:customer.name,phone:customer.phone||null}:null})
  }
  if(p==='/sale-returns'&&method==='GET'){
    if(user!.role==='cashier')return jsonResponse({error:'الكاشير لا يملك صلاحية المرتجعات'},403)
    const db=await getDb()
    const returns=query<any>(db,`SELECT sr.*,s.invoice_no invoiceNo,c.name customerName
      FROM sale_returns sr
      JOIN sales s ON s.id=sr.sale_id
      LEFT JOIN customers c ON c.id=sr.customer_id
      ORDER BY sr.date DESC LIMIT 100`)
    const itemRows=query<any>(db,`SELECT sri.sale_return_id,sri.id,sri.sale_item_id,sri.variant_id,sri.quantity,sri.unit_price,sri.total,
      v.sku,v.size,v.color,p.name product_name
      FROM sale_return_items sri
      JOIN product_variants v ON v.id=sri.variant_id
      JOIN products p ON p.id=v.product_id
      WHERE sri.sale_return_id IN (SELECT id FROM sale_returns ORDER BY date DESC LIMIT 100)
      ORDER BY sri.id`)
    const byReturn=new Map<string,any[]>()
    for(const r of itemRows){
      const arr=byReturn.get(r.sale_return_id)||[]
      arr.push({id:r.id,saleItemId:r.sale_item_id,quantity:Number(r.quantity||0),unitPrice:Number(r.unit_price||0),total:Number(r.total||0),variant:{sku:r.sku,size:r.size||null,color:r.color||null,product:{name:r.product_name}}})
      byReturn.set(r.sale_return_id,arr)
    }
    return jsonResponse({items:returns.map((r:any)=>({...r,returnNo:r.return_no,refundMethod:r.refund_method||'cash',date:r.date||r.created_at||null,sale:{invoiceNo:r.invoiceNo},customer:r.customer_id?{name:r.customerName||''}:null,items:byReturn.get(r.id)||[]}))})
  }
  if(p==='/sale-returns'&&method==='POST'){
    if(!['admin','manager','cashier'].includes(user!.role)) return jsonResponse({error:'لا تملك صلاحية المرتجعات'},403)
    const b=await body(req)
    const saleId=String(b.saleId||'').trim()
    if(!saleId) return jsonResponse({error:'رقم الفاتورة مطلوب'},400)
    const refundMethod=b.refundMethod||b.paymentMethod||'cash'
    if(!['cash','card','credit'].includes(refundMethod)) return jsonResponse({error:'طريقة رد غير صحيحة'},400)
    if(!Array.isArray(b.items)||!b.items.length) return jsonResponse({error:'حدد أصناف المرتجع'},400)
    try {
      let managerApproved=false
      if(b.managerApproved){
        const db=await getDb()
        const managerName=String(b.managerUsername||'').trim()
        const managerPin=String(b.managerPin||'')
        if(!managerName||!/^\d{4}$/.test(managerPin))return jsonResponse({error:'موافقة المدير تحتاج اسم مستخدم وPIN من 4 أرقام'},400)
        const mr=query<any>(db,'SELECT pin_hash,role FROM users WHERE username=? AND active=1',[managerName])[0]
        if(!mr||!['admin','manager'].includes(mr.role)||!(await verifyPin(managerPin,mr.pin_hash||'')))return jsonResponse({error:'PIN المدير غير صحيح'},403)
        managerApproved=true
      }
      const result=await returnSale({
        userId:user!.id,
        role:user!.role,
        managerApproved,
        saleId,
        customerId:b.customerId||null,
        refundMethod,
        idempotencyKey:b.idempotencyKey || req.headers.get('Idempotency-Key') || undefined,
        lines:b.items.map((x:any)=>({
          saleItemId:String(x.saleItemId||''),
          variantId:String(x.variantId||''),
          quantity:Number(x.quantity||0),
        })),
        reason:b.reason,
        notes:b.notes,
      })
      return jsonResponse(result,201)
    } catch(e) {
      console.error('[TAYBA_RETURN_ERROR]', e)
      return jsonResponse({error:e instanceof Error?e.message:'تعذر تنفيذ المرتجع',code:'SALE_RETURN_FAILED'},400)
    }
  }
  if(p==='/cash-movements'&&method==='GET'){if(!['admin','manager'].includes(user!.role))return jsonResponse({error:'صلاحية غير كافية'},403);const db=await getDb();const sid=u.searchParams.get('registerSessionId');return jsonResponse({items:query<any>(db,"SELECT cl.*,u.name user_name FROM cash_ledger cl LEFT JOIN users u ON u.id=cl.user_id WHERE (? IS NULL OR cl.register_session_id=?) ORDER BY cl.created_at DESC LIMIT 200",[sid,sid])})}
  if(p==='/cash-movements'&&method==='POST'){if(!['admin','manager'].includes(user!.role))return jsonResponse({error:'صلاحية غير كافية'},403);const b=await body(req);return jsonResponse(await addCashMovement({userId:user!.id,registerSessionId:String(b.registerSessionId||''),direction:b.direction==='in'?'in':'out',amount:Number(b.amount||0),category:String(b.category||'تسوية نقدية'),note:b.note,idempotencyKey:b.idempotencyKey || req.headers.get('Idempotency-Key') || undefined}),201)}

  return null
}
