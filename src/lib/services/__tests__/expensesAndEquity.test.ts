import { describe, it, expect } from 'vitest'
import { seedBasics } from '../../__tests__/fixtures'
import { addExpense } from '../expensesService'
import { addOwnerTransaction, ownerLedger, deleteOwnerTransaction } from '../ownerEquityService'

describe('addExpense', () => {
  it('rejects a zero or negative amount', async () => {
    const { userId } = await seedBasics()
    await expect(addExpense({ userId, category: 'إيجار', amount: 0 })).rejects.toThrow(/أكبر من صفر/)
  })

  it('requires an open shift for a shift-tied expense', async () => {
    const { userId } = await seedBasics()
    await expect(addExpense({ userId, category: 'مصروف وردية', amount: 50, registerSessionId: 'not-a-real-session' }))
      .rejects.toThrow(/يجب فتح الوردية/)
  })

  it('allows a general expense with no shift attached', async () => {
    const { userId } = await seedBasics()
    const result = await addExpense({ userId, category: 'إيجار المحل', amount: 3000 })
    expect(result.id).toBeTruthy()
  })

  it('allows a shift expense when the shift is actually open', async () => {
    const { userId, sessionId } = await seedBasics()
    const result = await addExpense({ userId, category: 'مواصلات', amount: 20, registerSessionId: sessionId })
    expect(result.id).toBeTruthy()
  })
})

describe('owner equity ledger', () => {
  it('computes running balance and lifetime totals correctly', async () => {
    const { userId } = await seedBasics()
    await addOwnerTransaction({ userId, type: 'contribution', amount: 10000, date: '2026-01-01' })
    await addOwnerTransaction({ userId, type: 'withdrawal', amount: 2000, date: '2026-01-05' })
    await addOwnerTransaction({ userId, type: 'contribution', amount: 500, date: '2026-01-10' })

    const ledger = await ownerLedger()
    expect(ledger.totalContributions).toBe(10500)
    expect(ledger.totalWithdrawals).toBe(2000)
    expect(ledger.netBalance).toBe(8500)
    // items are returned newest-first; balanceAfter on the oldest entry (last item) must be its own amount
    const oldestEntry = ledger.items[ledger.items.length - 1]
    expect(oldestEntry.balanceAfter).toBe(10000)
  })

  it('rejects a zero-amount owner transaction', async () => {
    const { userId } = await seedBasics()
    await expect(addOwnerTransaction({ userId, type: 'contribution', amount: 0 })).rejects.toThrow(/أكبر من صفر/)
  })

  it('removes a transaction from the ledger totals after deletion', async () => {
    const { userId } = await seedBasics()
    const tx = await addOwnerTransaction({ userId, type: 'contribution', amount: 1000 })
    await deleteOwnerTransaction(userId, tx.id)
    const ledger = await ownerLedger()
    expect(ledger.totalContributions).toBe(0)
  })
})
