import { query } from './db/client'
import type { Database } from 'sql.js'
export const DISCOUNT_TOLERANCE=0.05
export const OVERCHARGE_TOLERANCE=0.10
export function checkLocalSalePrice(db:Database,variantId:string,unitPrice:number,role:'admin'|'manager'|'cashier',managerApproved=false){
  const v=query<{sell_price:number;quarter_dozen_price:number|null;half_dozen_price:number|null;dozen_price:number|null;name:string;sku:string}>(db,`SELECT pv.sell_price,pv.quarter_dozen_price,pv.half_dozen_price,pv.dozen_price,p.name,pv.sku FROM product_variants pv JOIN products p ON p.id=pv.product_id WHERE pv.id=?`,[variantId])[0]
  if(!v) return {ok:false,error:'المنتج غير موجود',needsManagerApproval:false}
  if(unitPrice<=0) return {ok:false,error:`سعر صفر غير مسموح لـ ${v.name} (${v.sku})`,needsManagerApproval:true}
  if(role!=='cashier'||managerApproved) return {ok:true}
  const pack=[v.quarter_dozen_price&&v.quarter_dozen_price/3,v.half_dozen_price&&v.half_dozen_price/6,v.dozen_price&&v.dozen_price/12].filter((x):x is number=>typeof x==='number')
  if(pack.some(x=>Math.abs(x-unitPrice)<=0.02)) return {ok:true}
  const min=v.sell_price*(1-DISCOUNT_TOLERANCE), max=v.sell_price*(1+OVERCHARGE_TOLERANCE)
  if(unitPrice<min||unitPrice>max) return {ok:false,error:'السعر خارج حدود الكاشير ويحتاج موافقة المدير',needsManagerApproval:true}
  return {ok:true}
}
