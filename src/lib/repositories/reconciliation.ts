import { getDb, query } from '../db/client'
import { cashExpected } from '../accounting'

export async function getReconciliation() {
  const db = await getDb()
  const customerRows = query<any>(db, `
    SELECT c.id,c.name,c.balance,
      COALESCE((SELECT SUM(debit-credit) FROM customer_ledger l WHERE l.customer_id=c.id),0) ledger_balance
    FROM customers c
  `)
  const supplierRows = query<any>(db, `
    SELECT s.id,s.name,s.balance,
      COALESCE((SELECT SUM(credit-debit) FROM supplier_ledger l WHERE l.supplier_id=s.id),0) ledger_balance
    FROM suppliers s
  `)
  const customers = customerRows.map((r:any)=>({...r,balanceDiff:+(Number(r.balance)-Number(r.ledger_balance)).toFixed(2)}))
  const suppliers = supplierRows.map((r:any)=>({...r,balanceDiff:+(Number(r.balance)-Number(r.ledger_balance)).toFixed(2)}))
  const sessions = query<any>(db, `
    SELECT id,user_id,status,opening_float,closing_float,expected_cash,difference,opened_at,closed_at
    FROM register_sessions ORDER BY opened_at DESC LIMIT 100
  `).map((s:any)=>{
    const expenses=Number(query<any>(db,"SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE register_session_id=?",[s.id])[0]?.v||0)
    const ledgerExpected=Number((cashExpected(db,s.id)-expenses).toFixed(2))
    return {...s,ledger_expected:ledgerExpected,cashDiff:s.closing_float==null?null:Number((Number(s.closing_float)-ledgerExpected).toFixed(2))}
  })
  const stock = query<any>(db, `
    SELECT pv.id,pv.sku,pv.quantity,
      COALESCE(SUM(CASE WHEN sm.type='OPENING_STOCK' THEN sm.quantity ELSE 0 END),0) opening,
      COALESCE(SUM(sm.quantity),0) movement_sum
    FROM product_variants pv LEFT JOIN stock_movements sm ON sm.variant_id=pv.id GROUP BY pv.id,pv.sku,pv.quantity
  `).map((r:any)=>({...r,stockDiff:+(Number(r.quantity)-Number(r.movement_sum)).toFixed(2)}))
  const sales = query<any>(db, `SELECT COUNT(*) count, COALESCE(SUM(total),0) total FROM sales WHERE status='completed'`)[0]||{count:0,total:0}
  const returns = query<any>(db, `SELECT COALESCE(SUM(total),0) total FROM sale_returns WHERE status='completed'`)[0]||{total:0}
  return {
    ok: true,
    customers: { mismatches: customers.filter((x:any)=>Math.abs(x.balanceDiff)>0.009).length, items: customers.filter((x:any)=>Math.abs(x.balanceDiff)>0.009) },
    suppliers: { mismatches: suppliers.filter((x:any)=>Math.abs(x.balanceDiff)>0.009).length, items: suppliers.filter((x:any)=>Math.abs(x.balanceDiff)>0.009) },
    stock: { mismatches: stock.filter((x:any)=>Math.abs(x.stockDiff)>0.009).length, items: stock.filter((x:any)=>Math.abs(x.stockDiff)>0.009) },
    sessions,
    summary: { salesCount:Number(sales.count), salesTotal:Number(sales.total), saleReturns:Number(returns.total) },
  }
}
