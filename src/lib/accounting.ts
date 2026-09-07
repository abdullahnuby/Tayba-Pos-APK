import { query, run } from './db/client'
import type { Database } from 'sql.js'
import { v4 as uuid } from 'uuid'

export function addCustomerDebit(db: Database, customerId: string, amount: number, refType: string, refId: string, note?: string) {
  if (amount <= 0) return
  run(db, `INSERT INTO customer_ledger(id,customer_id,entry_type,reference_type,reference_id,debit,credit,note) VALUES(?,?,?,?,?,?,?,?)`, [uuid(), customerId, refType, refType, refId, amount, 0, note ?? null])
}
export function addCustomerCredit(db: Database, customerId: string, amount: number, refType: string, refId: string, note?: string) {
  if (amount <= 0) return
  run(db, `INSERT INTO customer_ledger(id,customer_id,entry_type,reference_type,reference_id,debit,credit,note) VALUES(?,?,?,?,?,?,?,?)`, [uuid(), customerId, refType, refType, refId, 0, amount, note ?? null])
}
export function addSupplierCredit(db: Database, supplierId: string, amount: number, refType: string, refId: string, note?: string) {
  if (amount <= 0) return
  run(db, `INSERT INTO supplier_ledger(id,supplier_id,entry_type,reference_type,reference_id,debit,credit,note) VALUES(?,?,?,?,?,?,?,?)`, [uuid(), supplierId, refType, refType, refId, amount, 0, note ?? null])
}
export function addSupplierDebit(db: Database, supplierId: string, amount: number, refType: string, refId: string, note?: string) {
  if (amount <= 0) return
  run(db, `INSERT INTO supplier_ledger(id,supplier_id,entry_type,reference_type,reference_id,debit,credit,note) VALUES(?,?,?,?,?,?,?,?)`, [uuid(), supplierId, refType, refType, refId, 0, amount, note ?? null])
}
export function addCash(db: Database, input:{sessionId:string;userId?:string|null;type:string;referenceType:string;referenceId:string;amountIn?:number;amountOut?:number;note?:string;idempotencyKey?:string}) {
  run(db, `INSERT INTO cash_ledger(id,register_session_id,user_id,entry_type,reference_type,reference_id,amount_in,amount_out,note,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?)`, [uuid(), input.sessionId, input.userId ?? null, input.type, input.referenceType, input.referenceId, input.amountIn ?? 0, input.amountOut ?? 0, input.note ?? null, input.idempotencyKey ?? null])
}
export function cashExpected(db: Database, sessionId: string) {
  const session = query<{opening_float:number}>(db,'SELECT opening_float FROM register_sessions WHERE id=?',[sessionId])[0]
  const sums = query<{amount_in:number;amount_out:number}>(db,'SELECT COALESCE(SUM(amount_in),0) amount_in, COALESCE(SUM(amount_out),0) amount_out FROM cash_ledger WHERE register_session_id=?',[sessionId])[0]
  return (session?.opening_float ?? 0) + (sums?.amount_in ?? 0) - (sums?.amount_out ?? 0)
}
