import { v4 as uuid } from 'uuid'
import { query, run, withTransaction } from '../db/client'
import { enqueueSync } from '../sync/queue'
import { mapEntity } from '../sync/mapper'

export type OwnerTxType = 'contribution' | 'withdrawal'

export async function addOwnerTransaction(input: { userId: string; type: OwnerTxType; amount: number; date?: string; note?: string }) {
  if (!(input.amount > 0)) throw new Error('القيمة يجب أن تكون أكبر من صفر')
  if (input.type !== 'contribution' && input.type !== 'withdrawal') throw new Error('نوع العملية غير صحيح')
  return withTransaction(db => {
    const id = uuid()
    run(db, `INSERT INTO owner_transactions(id,type,amount,date,note,user_id) VALUES(?,?,?,?,?,?)`,
      [id, input.type, input.amount, input.date || new Date().toISOString().slice(0, 10), input.note?.trim() || null, input.userId])
    run(db, `INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`,
      [uuid(), input.userId, 'CREATE', 'owner_transaction', id, JSON.stringify({ type: input.type, amount: input.amount })])
    enqueueSync(db, { entityType: 'owner_transaction', entityId: id, operation: 'create', payload: mapEntity(db, 'owner_transaction', id) })
    return { id }
  })
}

export async function deleteOwnerTransaction(userId: string, id: string) {
  return withTransaction(db => {
    run(db, 'DELETE FROM owner_transactions WHERE id=?', [id])
    run(db, `INSERT INTO audit_logs(id,user_id,action,entity,entity_id) VALUES(?,?,?,?,?)`, [uuid(), userId, 'DELETE', 'owner_transaction', id])
    enqueueSync(db, { entityType: 'owner_transaction', entityId: id, operation: 'delete', payload: { id } })
    return { id }
  })
}

/**
 * Full history plus a running balance after each entry, and lifetime totals.
 * Balance = total contributions - total withdrawals, from the very first entry
 * ever recorded (not scoped to a date range) so "how much have I put in since
 * day one" is always answerable.
 */
export async function ownerLedger() {
  return withTransaction(db => {
    const rows = query<any>(db, `SELECT ot.*, u.name user_name FROM owner_transactions ot LEFT JOIN users u ON u.id=ot.user_id ORDER BY ot.date ASC, ot.created_at ASC`)
    let running = 0
    const items = rows.map(r => {
      running += r.type === 'contribution' ? Number(r.amount) : -Number(r.amount)
      return { ...r, balanceAfter: +running.toFixed(2) }
    }).reverse()
    const totalContributions = rows.filter(r => r.type === 'contribution').reduce((a, r) => a + Number(r.amount), 0)
    const totalWithdrawals = rows.filter(r => r.type === 'withdrawal').reduce((a, r) => a + Number(r.amount), 0)
    return {
      items,
      totalContributions: +totalContributions.toFixed(2),
      totalWithdrawals: +totalWithdrawals.toFixed(2),
      netBalance: +(totalContributions - totalWithdrawals).toFixed(2),
    }
  })
}
