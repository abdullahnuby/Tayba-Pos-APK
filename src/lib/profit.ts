export interface ProfitLine { quantity:number; unitPrice:number; unitCost:number; total:number }
export function allocateInvoiceDiscount(lines:ProfitLine[], discount:number){
 const gross=lines.reduce((s,i)=>s+Math.max(0,i.total),0), d=Math.min(Math.max(0,discount||0),gross)
 if(gross<=0||d<=0) return lines.map(()=>0)
 return lines.map(i=>+(d*(Math.max(0,i.total)/gross)).toFixed(4))
}
export function calculateSaleProfit(input:{subtotal:number;discount:number;taxAmount?:number;items:ProfitLine[]}){
 const discounts=allocateInvoiceDiscount(input.items,input.discount)
 let revenue=0,cogs=0
 input.items.forEach((i,idx)=>{const lineRevenue=Math.max(0,i.total)-discounts[idx]; revenue+=lineRevenue; cogs+=Math.max(0,i.unitCost)*Math.max(0,i.quantity)})
 return {revenue:+revenue.toFixed(2),cogs:+cogs.toFixed(2),profit:+(revenue-cogs).toFixed(2),allocatedDiscounts:discounts}
}
