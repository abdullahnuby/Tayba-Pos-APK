import { getDb, query } from '../db/client'
import { calculateSaleProfit } from '../profit'

function range(from?: string|null, to?: string|null) {
  const start = from || new Date(Date.now()-30*86400000).toISOString().slice(0,10)
  const end = to || new Date().toISOString().slice(0,10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) throw new Error('الفترة الزمنية غير صحيحة')
  return {start,end}
}

export async function fullReports(from?:string|null,to?:string|null){
  const db=await getDb(); const {start,end}=range(from,to)
  const sales=query<any>(db,`SELECT * FROM sales WHERE status='completed' AND date(date) BETWEEN date(?) AND date(?) ORDER BY date`,[start,end])
  const purchases=query<any>(db,`SELECT * FROM purchases WHERE status='completed' AND date(date) BETWEEN date(?) AND date(?) ORDER BY date`,[start,end])
  const saleReturns=query<any>(db,`SELECT * FROM sale_returns WHERE status='completed' AND date(date) BETWEEN date(?) AND date(?) ORDER BY date`,[start,end])
  const saleItems=query<any>(db,`SELECT si.*,p.name product_name,v.sku,v.size,v.color,c.name category_name FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN product_variants v ON v.id=si.variant_id JOIN products p ON p.id=v.product_id JOIN categories c ON c.id=p.category_id WHERE s.status='completed' AND date(s.date) BETWEEN date(?) AND date(?)`,[start,end])
  const totalSales=sales.reduce((a,r)=>a+Number(r.total||0),0)
  const totalPurchases=purchases.reduce((a,r)=>a+Number(r.total||0),0)
  const totalReturns=saleReturns.reduce((a,r)=>a+Number(r.total||0),0)
  const returnItems=query<any>(db,`SELECT sri.*,sr.date return_date,si.unit_cost sale_unit_cost,si.unit_price sale_unit_price FROM sale_return_items sri JOIN sale_returns sr ON sr.id=sri.sale_return_id JOIN sale_items si ON si.id=sri.sale_item_id WHERE sr.status='completed' AND date(sr.date) BETWEEN date(?) AND date(?)`,[start,end])
  const returnCogs=returnItems.reduce((a,r)=>a+Number(r.sale_unit_cost||0)*Number(r.quantity||0),0)
  const saleProfitMap=new Map<string,{revenue:number;cogs:number;profit:number}>()
  for(const sale of sales){ const items=saleItems.filter(i=>i.sale_id===sale.id).map(i=>({quantity:Number(i.quantity||0),unitPrice:Number(i.unit_price||0),unitCost:Number(i.unit_cost||0),total:Number(i.total||0)})); const calc=calculateSaleProfit({subtotal:Number(sale.subtotal||0),discount:Number(sale.discount||0),taxAmount:Number(sale.tax_amount||0),items}); saleProfitMap.set(sale.id,{revenue:calc.revenue,cogs:calc.cogs,profit:calc.profit}) }
  const cogs=[...saleProfitMap.values()].reduce((a,r)=>a+r.cogs,0)
  const grossProfit=[...saleProfitMap.values()].reduce((a,r)=>a+r.profit,0)
  const netSales=totalSales-totalReturns
  const netProfit=grossProfit-totalReturns+returnCogs
  const bestMap=new Map<string,any>(); const catMap=new Map<string,number>(); const methodMap=new Map<string,number>()
  for(const sale of sales){const items=saleItems.filter(i=>i.sale_id===sale.id);const discounts=calculateSaleProfit({subtotal:Number(sale.subtotal||0),discount:Number(sale.discount||0),taxAmount:Number(sale.tax_amount||0),items:items.map(i=>({quantity:Number(i.quantity||0),unitPrice:Number(i.unit_price||0),unitCost:Number(i.unit_cost||0),total:Number(i.total||0)}))}).allocatedDiscounts;items.forEach((r,idx)=>{const lineRevenue=Math.max(0,Number(r.total||0)-Number(discounts[idx]||0));const x=bestMap.get(r.variant_id)||{id:r.variant_id,name:r.product_name,sku:r.sku,qty:0,revenue:0,profit:0};x.qty+=Number(r.quantity);x.revenue+=lineRevenue;x.profit+=lineRevenue-Number(r.unit_cost)*Number(r.quantity);bestMap.set(r.variant_id,x);catMap.set(r.category_name,(catMap.get(r.category_name)||0)+lineRevenue)})}
  for(const r of sales) methodMap.set(r.payment_method,(methodMap.get(r.payment_method)||0)+Number(r.total||0))
  const daily:any[]=[]; const cursor=new Date(`${start}T00:00:00`), stop=new Date(`${end}T00:00:00`); while(cursor<=stop){const d=cursor.toISOString().slice(0,10);daily.push({date:d,sales:0,profit:0,purchases:0,returns:0});cursor.setDate(cursor.getDate()+1)}
  const byDay=new Map(daily.map(x=>[x.date,x])); for(const r of sales){const x=byDay.get(String(r.date).slice(0,10));if(x){x.sales+=Number(r.total||0);const items=saleItems.filter(i=>i.sale_id===r.id);x.profit+=Number(saleProfitMap.get(r.id)?.profit||0)}}
  for(const r of purchases){const x=byDay.get(String(r.date).slice(0,10));if(x)x.purchases+=Number(r.total||0)}
  for(const r of saleReturns){const x=byDay.get(String(r.date).slice(0,10));if(x)x.returns+=Number(r.total||0)}
  for(const r of returnItems){const x=byDay.get(String(r.return_date || new Date().toISOString()).slice(0,10)); if(x) x.profit += -(Number(r.total||0) - Number(r.sale_unit_cost||0)*Number(r.quantity||0))}
  const inventory=query<any>(db,`SELECT COALESCE(SUM(quantity*cost_price),0) cost_value,COALESCE(SUM(quantity*sell_price),0) retail_value,COUNT(*) variants,COALESCE(SUM(CASE WHEN quantity<=min_quantity THEN 1 ELSE 0 END),0) low_stock,COALESCE(SUM(CASE WHEN quantity<=0 THEN 1 ELSE 0 END),0) out_of_stock FROM product_variants`)[0]
  const customerBalance=query<any>(db,'SELECT COALESCE(SUM(balance),0) value FROM customers')[0]?.value||0
  const supplierBalance=query<any>(db,'SELECT COALESCE(SUM(balance),0) value FROM suppliers')[0]?.value||0
  return {from:start,to:end,salesCount:sales.length,purchasesCount:purchases.length,returnsCount:saleReturns.length,totalSales:+totalSales.toFixed(2),netSales:+netSales.toFixed(2),totalReturns:+totalReturns.toFixed(2),totalPurchases:+totalPurchases.toFixed(2),totalProfit:+netProfit.toFixed(2),cogs:+cogs.toFixed(2),profitMargin:netSales>0?+(netProfit/netSales*100).toFixed(2):0,bestSelling:[...bestMap.values()].sort((a,b)=>b.qty-a.qty).slice(0,10),salesByCategory:[...catMap].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value),salesByMethod:[...methodMap].map(([name,value])=>({name,value})),dailyTrend:daily, inventory:{...inventory,cost_value:Number(inventory.cost_value||0),retail_value:Number(inventory.retail_value||0),potential_profit:Number(inventory.retail_value||0)-Number(inventory.cost_value||0)},customerBalance:Number(customerBalance),supplierBalance:Number(supplierBalance)}
}

export async function registerReport(from?:string|null,to?:string|null){
 const db=await getDb();const {start,end}=range(from,to);return query(db,`SELECT rs.*,u.name user_name FROM register_sessions rs JOIN users u ON u.id=rs.user_id WHERE date(rs.opened_at) BETWEEN date(?) AND date(?) ORDER BY rs.opened_at DESC`,[start,end])
}
