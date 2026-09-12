import { v4 as uuid } from 'uuid'
import { query, run, withTransaction } from '../db/client'
import { enqueueSync } from '../sync/queue'
import { mapEntity } from '../sync/mapper'

export type RecurringFrequency = 'monthly' | 'weekly' | 'yearly'

export interface RecurringExpenseInput {
  userId: string
  name: string
  category: string
  amount: number
  frequency?: RecurringFrequency
  dayOfMonth?: number
  startDate?: string
  endDate?: string | null
  note?: string
}

function currentPeriod(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function addRecurringExpense(input: RecurringExpenseInput) {
  if (!input.name.trim()) throw new Error('اسم المصروف الثابت مطلوب')
  if (!input.category.trim()) throw new Error('تصنيف المصروف مطلوب')
  if (!(input.amount > 0)) throw new Error('القيمة يجب أن تكون أكبر من صفر')
  const dayOfMonth = Math.min(28, Math.max(1, Number(input.dayOfMonth || 1)))
  return withTransaction(db => {
    const id = uuid()
    run(db, `INSERT INTO recurring_expenses(id,name,category,amount,frequency,day_of_month,start_date,end_date,note) VALUES(?,?,?,?,?,?,?,?,?)`,
      [id, input.name.trim(), input.category.trim(), input.amount, input.frequency || 'monthly', dayOfMonth, input.startDate || new Date().toISOString().slice(0, 10), input.endDate || null, input.note?.trim() || null])
    run(db, `INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`,
      [uuid(), input.userId, 'CREATE', 'recurring_expense', id, JSON.stringify({ name: input.name.trim(), category: input.category.trim(), amount: input.amount })])
    enqueueSync(db, { entityType: 'recurring_expense', entityId: id, operation: 'create', payload: mapEntity(db, 'recurring_expense', id) })
    return { id }
  })
}

export async function listRecurringExpenses(activeOnly = false) {
  return withTransaction(db =>
    query<any>(db, `SELECT * FROM recurring_expenses ${activeOnly ? 'WHERE active=1' : ''} ORDER BY category, name`)
  )
}

export async function setRecurringExpenseActive(userId: string, id: string, active: boolean) {
  return withTransaction(db => {
    const rows = query<{ id: string }>(db, 'SELECT id FROM recurring_expenses WHERE id=?', [id])
    if (!rows.length) throw new Error('المصروف الثابت غير موجود')
    run(db, `UPDATE recurring_expenses SET active=?, updated_at=datetime('now') WHERE id=?`, [active ? 1 : 0, id])
    run(db, `INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`,
      [uuid(), userId, 'UPDATE', 'recurring_expense', id, JSON.stringify({ active })])
    enqueueSync(db, { entityType: 'recurring_expense', entityId: id, operation: 'update', payload: mapEntity(db, 'recurring_expense', id) })
    return { id }
  })
}

export async function deleteRecurringExpense(userId: string, id: string) {
  return withTransaction(db => {
    run(db, 'DELETE FROM recurring_expenses WHERE id=?', [id])
    run(db, `INSERT INTO audit_logs(id,user_id,action,entity,entity_id) VALUES(?,?,?,?,?)`,
      [uuid(), userId, 'DELETE', 'recurring_expense', id])
    enqueueSync(db, { entityType: 'recurring_expense', entityId: id, operation: 'delete', payload: { id } })
    return { id }
  })
}

/**
 * Generates expense entries for any active recurring cost (rent, salaries...) whose
 * period is due and hasn't already been posted. Safe to call repeatedly (idempotent
 * per period via last_generated_period). Call on app start and before viewing reports.
 */
export async function generateDueRecurringExpenses(userId: string) {
  return withTransaction(db => {
    const today = new Date()
    const period = currentPeriod(today)
    const dueRows = query<any>(db, `SELECT * FROM recurring_expenses WHERE active=1 AND (last_generated_period IS NULL OR last_generated_period < ?) AND date(start_date) <= date('now') AND (end_date IS NULL OR date(end_date) >= date('now'))`, [period])
    const created: string[] = []
    for (const r of dueRows) {
      // Only post once we've reached the configured day of month for the current period,
      // so rent/salary due on the 5th doesn't get posted on the 1st.
      if (today.getDate() < Number(r.day_of_month || 1)) continue
      const id = uuid()
      run(db, `INSERT INTO expenses(id,category,amount,note,user_id,expense_type,recurring_expense_id,period_month) VALUES(?,?,?,?,?,?,?,?)`,
        [id, r.category, r.amount, r.name, userId, 'fixed', r.id, period])
      run(db, `UPDATE recurring_expenses SET last_generated_period=?, updated_at=datetime('now') WHERE id=?`, [period, r.id])
      run(db, `INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`,
        [uuid(), userId, 'CREATE', 'expense', id, JSON.stringify({ source: 'recurring', recurringExpenseId: r.id, period })])
      enqueueSync(db, { entityType: 'expense', entityId: id, operation: 'create', payload: mapEntity(db, 'expense', id) })
      created.push(id)
    }
    return { created: created.length, period }
  })
}

export async function setBudget(userId: string, input: { periodMonth: string; category: string; plannedAmount: number; note?: string }) {
  if (!/^\d{4}-\d{2}$/.test(input.periodMonth)) throw new Error('صيغة الشهر غير صحيحة (YYYY-MM)')
  if (!input.category.trim()) throw new Error('التصنيف مطلوب')
  if (input.plannedAmount < 0) throw new Error('القيمة غير صحيحة')
  return withTransaction(db => {
    const existing = query<{ id: string }>(db, 'SELECT id FROM budgets WHERE period_month=? AND category=?', [input.periodMonth, input.category.trim()])
    const id = existing[0]?.id || uuid()
    if (existing[0]) {
      run(db, `UPDATE budgets SET planned_amount=?, note=?, updated_at=datetime('now') WHERE id=?`, [input.plannedAmount, input.note?.trim() || null, id])
    } else {
      run(db, `INSERT INTO budgets(id,period_month,category,planned_amount,note) VALUES(?,?,?,?,?)`, [id, input.periodMonth, input.category.trim(), input.plannedAmount, input.note?.trim() || null])
    }
    run(db, `INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`,
      [uuid(), userId, existing[0] ? 'UPDATE' : 'CREATE', 'budget', id, JSON.stringify(input)])
    enqueueSync(db, { entityType: 'budget', entityId: id, operation: existing[0] ? 'update' : 'create', payload: mapEntity(db, 'budget', id) })
    return { id }
  })
}

export async function listBudgets(periodMonth: string) {
  return withTransaction(db => query<any>(db, 'SELECT * FROM budgets WHERE period_month=? ORDER BY category', [periodMonth]))
}
