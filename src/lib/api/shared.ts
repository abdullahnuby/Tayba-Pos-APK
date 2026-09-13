// Shared helpers used across the local API route modules (src/lib/api/routes/*.ts).
// Kept together because currentUser/serializeSaleById/mapProduct etc. are used by
// nearly every domain and moving them per-domain would just create copies.
import { getDb, query } from '../db/client'
import type { Database } from 'sql.js'
import { fullReports } from '../repositories/reports'

// A user record as returned by currentUser(); null when not logged in.
// role/active are kept loose (not a literal union) because callers pass user!.role
// straight into service functions that expect their own narrower role types —
// this mirrors the implicit `any` the original inline router relied on.
export type ApiUser = { id:string; username:string; name:string; role:any; active:number|boolean } | null

// Everything a route handler needs about the current request.
export interface RouteCtx {
  req: Request
  u: URL
  p: string
  method: string
  user: ApiUser
}

export const SESSION_KEY = 'tayba-offline-session-v1'

type Json = Record<string, any> | any[] | string | number | boolean | null
export function jsonResponse(body: Json, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
export async function body(req: Request) { try { return await req.json() } catch { return {} } }
export function urlOf(input: RequestInfo | URL) { return typeof input === 'string' ? new URL(input, location.origin) : new URL(input instanceof Request ? input.url : input.toString(), location.origin) }
export async function currentUser() {
  const id = localStorage.getItem(SESSION_KEY)
  if (!id) return null
  const db = await getDb()
  return query<any>(db, 'SELECT id,username,name,role,active FROM users WHERE id=? AND active=1', [id])[0] ?? null
}
export function requireRole(user:any, roles?: string[]) { if (!user) return jsonResponse({ error:'غير مصرح' },401); if (roles && !roles.includes(user.role)) return jsonResponse({error:'صلاحية غير كافية'},403); return null }
export async function hashPin(pin:string,salt:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${salt}:${pin}`));return `${salt}:${[...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}`}
export async function verifyPin(pin:string,stored:string){const [salt,hash]=String(stored||'').split(':');if(!salt||!hash)return false;return (await hashPin(pin,salt)).split(':')[1]===hash}
export function randSalt(){return crypto.randomUUID().replaceAll('-','')}
export function serializeSaleById(db:Database, saleId:string){
  const sale=query<any>(db,'SELECT s.*,c.name customerName,c.phone customerPhone FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=?',[saleId])[0]
  if(!sale) return null
  const items=query<any>(db,`SELECT i.*,v.sku,v.size,v.color,p.name product_name
    FROM sale_items i
    JOIN product_variants v ON v.id=i.variant_id
    JOIN products p ON p.id=v.product_id
    WHERE i.sale_id=?
    ORDER BY i.rowid`,[saleId]).map((r:any)=>({
      id:r.id,
      variantId:r.variant_id,
      quantity:Number(r.quantity||0),
      unitPrice:Number(r.unit_price||0),
      unitCost:Number(r.unit_cost||0),
      total:Number(r.total||0),
      variant:{sku:r.sku,size:r.size||null,color:r.color||null,product:{name:r.product_name}},
    }))
  return {
    ...sale,
    invoiceNo:sale.invoice_no,
    customer:sale.customer_id ? {name:sale.customerName||'',phone:sale.customerPhone||null} : null,
    items,
    paymentMethod:sale.payment_method,
  }
}
export function rowToVariant(r:any){ return {id:r.id,sku:r.sku,barcode:r.barcode,size:r.size,color:r.color,material:r.material,costPrice:r.cost_price,sellPrice:r.sell_price,quantity:r.quantity,minQuantity:r.min_quantity,reorderQty:r.reorder_qty,baseUnit:r.base_unit,purchaseUnit:r.purchase_unit,purchaseUnitFactor:r.purchase_unit_factor,saleUnit:r.sale_unit,saleUnitFactor:r.sale_unit_factor,quarterDozenPrice:r.quarter_dozen_price,halfDozenPrice:r.half_dozen_price,dozenPrice:r.dozen_price,product:{id:r.product_id,name:r.product_name}} }
export async function listProductsResponse(u:URL){
 const db=await getDb(); const q=(u.searchParams.get('search')||'').trim().toLowerCase(); const categoryId=u.searchParams.get('categoryId')||''; const page=Math.max(1,Number(u.searchParams.get('page')||1)); const pageSize=Math.max(1,Math.min(Number(u.searchParams.get('pageSize')||50),200));
 const where=['1=1']; const params:any[]=[]; if(q){where.push("(lower(p.name) LIKE ? OR lower(COALESCE(p.description,'')) LIKE ? OR lower(v.sku) LIKE ? OR coalesce(v.barcode,'') LIKE ?)");params.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`)} if(categoryId&&categoryId!=='all'){where.push('p.category_id=?');params.push(categoryId)}
 const ids=query<any>(db,`SELECT DISTINCT p.id FROM products p JOIN product_variants v ON v.product_id=p.id WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC LIMIT ${pageSize} OFFSET ${(page-1)*pageSize}`,params).map(x=>x.id);
 if(!ids.length)return {items:[],total:query<any>(db,`SELECT COUNT(DISTINCT p.id) total FROM products p JOIN product_variants v ON v.product_id=p.id WHERE ${where.join(' AND ')}`,params)[0]?.total||0,page,pageSize};
 const marks=ids.map(()=>'?').join(','); const rows=query<any>(db,`SELECT v.*,p.name product_name,p.description,p.category_id,c.name category_name,p.brand_id,b.name brand_name,p.gender,p.season,p.image FROM product_variants v JOIN products p ON p.id=v.product_id JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id WHERE p.id IN (${marks}) ORDER BY p.created_at DESC,v.size,v.sku`,ids);
 const map=new Map<string,any>(); for(const r of rows){ if(!map.has(r.product_id)) map.set(r.product_id,{id:r.product_id,name:r.product_name,description:r.description,categoryId:r.category_id,category:{id:r.category_id,name:r.category_name},brandId:r.brand_id||null,brand:r.brand_id?{id:r.brand_id,name:r.brand_name}:null,gender:r.gender,season:r.season,material:null,image:r.image,variants:[]}); map.get(r.product_id).variants.push(rowToVariant(r)); }
 const total=query<any>(db,`SELECT COUNT(DISTINCT p.id) total FROM products p JOIN product_variants v ON v.product_id=p.id WHERE ${where.join(' AND ')}`,params)[0]?.total||0; return {items:[...map.values()],total:Number(total),page,pageSize}
}
export async function dashboard(){
 const end=new Date().toISOString().slice(0,10), start=new Date(Date.now()-6*86400000).toISOString().slice(0,10)
 const r=await fullReports(start,end)
 const db=await getDb()
 const todayRows=query<any>(db,"SELECT COALESCE(SUM(total),0) todaySales,COUNT(*) todayInvoices FROM sales WHERE status='completed' AND date(date)=date(?)",[end])[0]||{}
 const low=query<any>(db,'SELECT COUNT(*) c FROM product_variants WHERE quantity>0 AND quantity<=min_quantity')[0]?.c||0
 const out=query<any>(db,'SELECT COUNT(*) c FROM product_variants WHERE quantity<=0')[0]?.c||0
 const lowRows=query<any>(db,"SELECT v.id,p.name,v.sku,v.quantity,v.min_quantity,v.reorder_qty,c.name category FROM product_variants v JOIN products p ON p.id=v.product_id JOIN categories c ON c.id=p.category_id WHERE v.quantity<=v.min_quantity ORDER BY v.quantity LIMIT 12")
 const todayMethodRows=query<any>(db,"SELECT payment_method name,COALESCE(SUM(total),0) value FROM sales WHERE status='completed' AND date(date)=date(?) GROUP BY payment_method",[end]); const todayByMethod={cash:0,card:0,transfer:0}; for(const x of todayMethodRows){if(x.name in todayByMethod)(todayByMethod as any)[x.name]=Number(x.value||0)}
 return {todaySales:Number(todayRows.todaySales||0),todayProfit:Number(r.dailyTrend.at(-1)?.profit||0),todaySalesCount:Number(todayRows.todayInvoices||0),lowStockCount:Number(low),outOfStockCount:Number(out),inventoryValue:Number(r.inventory.cost_value||0),retailValue:Number(r.inventory.retail_value||0),potentialProfit:Number(r.inventory.potential_profit||0),customerBalance:Number(r.customerBalance||0),supplierBalance:Number(r.supplierBalance||0),salesTrend:r.dailyTrend.map(x=>({date:x.date,label:x.date.slice(5),sales:Number(x.sales||0),profit:Number(x.profit||0)})),topProducts:r.bestSelling.slice(0,5),recentSales:query<any>(db,"SELECT s.*,s.date date,s.created_at createdAt,COALESCE(c.name,'عميل نقدي') customerName,(SELECT COUNT(*) FROM sale_items si WHERE si.sale_id=s.id) itemsCount FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.status='completed' ORDER BY s.date DESC LIMIT 8").map((x:any)=>({...x,date:x.date||x.createdAt||null})),lowStockList:lowRows,reorderList:lowRows.map(x=>({...x,suggestedOrder:Math.max(Number(x.reorder_qty||0)-Number(x.quantity||0),0)})),todayByMethod}
}

export function mapCustomer(r:any){ return { id:r.id,name:r.name,phone:r.phone,address:r.address,notes:r.notes,balance:Number(r.balance||0),loyaltyPoints:Number(r.loyalty_points||0),createdAt:r.created_at,updatedAt:r.updated_at } }
export function mapSupplier(r:any){ return { id:r.id,name:r.name,phone:r.phone,address:r.address,notes:r.notes,balance:Number(r.balance||0),createdAt:r.created_at,updatedAt:r.updated_at } }
export function mapProduct(db:any,id:string){ const p=query<any>(db,'SELECT p.*,c.id category_id,c.name category_name,b.id brand_id,b.name brand_name FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id WHERE p.id=?',[id])[0]; if(!p)return null; return {...p,category:{id:p.category_id,name:p.category_name},brand:p.brand_id?{id:p.brand_id,name:p.brand_name}:null,variants:query<any>(db,'SELECT * FROM product_variants WHERE product_id=? ORDER BY sku',[id]).map(rowToVariant)} }
export function csvEscape(v:any){ const s=String(v??''); return `"${s.replace(/"/g,'""')}"` }
export function makeCsv(rows:any[]){ if(!rows.length)return '\ufeffno_data\n'; const headers=Object.keys(rows[0]); return '\ufeff'+[headers.join(','),...rows.map(r=>headers.map(h=>csvEscape(r[h])).join(','))].join('\n') }
