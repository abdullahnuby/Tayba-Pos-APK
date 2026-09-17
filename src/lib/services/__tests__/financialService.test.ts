import { describe, it, expect, vi, afterEach } from 'vitest'
import { seedBasics } from '../../__tests__/fixtures'
import { addRecurringExpense, generateDueRecurringExpenses, setBudget, listBudgets } from '../financialService'
import { query } from '../../db/client'

afterEach(() => vi.useRealTimers())

describe('addRecurringExpense validation', () => {
  it('rejects a zero amount', async () => {
    const { userId } = await seedBasics()
    await expect(addRecurringExpense({ userId, name: 'إيجار', category: 'إيجار', amount: 0 }))
      .rejects.toThrow(/أكبر من صفر/)
  })

  it('rejects a missing name', async () => {
    const { userId } = await seedBasics()
    await expect(addRecurringExpense({ userId, name: '  ', category: 'إيجار', amount: 500 }))
      .rejects.toThrow(/اسم المصروف الثابت مطلوب/)
  })
})

describe('generateDueRecurringExpenses', () => {
  it('does NOT post an expense before its configured day of month arrives', async () => {
    const { db, userId } = await seedBasics()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-01T09:00:00'))
    await addRecurringExpense({ userId, name: 'إيجار المحل', category: 'إيجار', amount: 3000, dayOfMonth: 5 })

    const result = await generateDueRecurringExpenses(userId)
    expect(result.created).toBe(0)
    const expenses = query<any>(db, "SELECT * FROM expenses WHERE expense_type='fixed'")
    expect(expenses.length).toBe(0)
  })

  it('posts the expense once the configured day of month arrives', async () => {
    const { db, userId } = await seedBasics()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-01T09:00:00'))
    await addRecurringExpense({ userId, name: 'إيجار المحل', category: 'إيجار', amount: 3000, dayOfMonth: 5 })

    vi.setSystemTime(new Date('2026-03-05T09:00:00'))
    const result = await generateDueRecurringExpenses(userId)
    expect(result.created).toBe(1)

    const expenses = query<any>(db, "SELECT * FROM expenses WHERE expense_type='fixed'")
    expect(expenses.length).toBe(1)
    expect(expenses[0].amount).toBe(3000)
  })

  it('does not post the same recurring expense twice in the same period (idempotent)', async () => {
    const { db, userId } = await seedBasics()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-05T09:00:00'))
    await addRecurringExpense({ userId, name: 'إيجار المحل', category: 'إيجار', amount: 3000, dayOfMonth: 5 })

    await generateDueRecurringExpenses(userId)
    const second = await generateDueRecurringExpenses(userId) // same day, called again (e.g. app reopened)
    expect(second.created).toBe(0)

    const expenses = query<any>(db, "SELECT * FROM expenses WHERE expense_type='fixed'")
    expect(expenses.length).toBe(1) // still just one, not duplicated
  })

  it('posts again once a new month/period arrives', async () => {
    const { db, userId } = await seedBasics()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-05T09:00:00'))
    await addRecurringExpense({ userId, name: 'إيجار المحل', category: 'إيجار', amount: 3000, dayOfMonth: 5 })
    await generateDueRecurringExpenses(userId)

    vi.setSystemTime(new Date('2026-04-05T09:00:00'))
    const result = await generateDueRecurringExpenses(userId)
    expect(result.created).toBe(1)

    const expenses = query<any>(db, "SELECT * FROM expenses WHERE expense_type='fixed'")
    expect(expenses.length).toBe(2) // March + April
  })
})

describe('setBudget', () => {
  it('creates a new budget line, then updates the same line instead of duplicating it', async () => {
    const { userId } = await seedBasics()
    await setBudget(userId, { periodMonth: '2026-03', category: 'إيجار', plannedAmount: 3000 })
    await setBudget(userId, { periodMonth: '2026-03', category: 'إيجار', plannedAmount: 3500 }) // revised upward

    const budgets = await listBudgets('2026-03')
    expect(budgets.length).toBe(1)
    expect(budgets[0].planned_amount).toBe(3500)
  })

  it('rejects a malformed period month', async () => {
    const { userId } = await seedBasics()
    await expect(setBudget(userId, { periodMonth: '2026/03', category: 'إيجار', plannedAmount: 100 }))
      .rejects.toThrow(/صيغة الشهر غير صحيحة/)
  })
})
