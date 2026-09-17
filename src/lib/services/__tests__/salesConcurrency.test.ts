import { describe, it, expect } from 'vitest'
import { seedBasics } from '../../__tests__/fixtures'
import { completeSale } from '../salesService'
import { query, run } from '../../db/client'

describe('completeSale — real concurrency (racing transactions, not sequential awaits)', () => {
  it('never oversells stock when two sales for the same item fire at the exact same instant', async () => {
    const { db, variantId, userId, sessionId } = await seedBasics()
    // Tighten stock so the race is meaningful: only 5 units available.
    run(db, 'UPDATE product_variants SET quantity=5 WHERE id=?', [variantId])

    // Two cashiers, each trying to sell 4 units of the same 5-in-stock item,
    // fired together with Promise.allSettled — NOT one awaited after the other.
    // Only one of these can legitimately succeed; the other must be rejected,
    // not silently overselling into negative stock.
    const [a, b] = await Promise.allSettled([
      completeSale({ userId, registerSessionId: sessionId, cart: [{ variantId, quantity: 4, price: 20 } as any], discount: 0, paid: 80, paymentMethod: 'cash', role: 'cashier' }),
      completeSale({ userId, registerSessionId: sessionId, cart: [{ variantId, quantity: 4, price: 20 } as any], discount: 0, paid: 80, paymentMethod: 'cash', role: 'cashier' }),
    ])

    const outcomes = [a, b]
    const succeeded = outcomes.filter(o => o.status === 'fulfilled')
    const failed = outcomes.filter(o => o.status === 'rejected')

    expect(succeeded.length).toBe(1) // exactly one sale wins the race
    expect(failed.length).toBe(1)
    if (failed[0].status === 'rejected') {
      expect(String(failed[0].reason?.message ?? failed[0].reason)).toMatch(/المخزون غير كافٍ/)
    }

    const variant = query<any>(db, 'SELECT quantity FROM product_variants WHERE id=?', [variantId])[0]
    expect(variant.quantity).toBe(1) // 5 - 4, never negative, never double-deducted
    expect(variant.quantity).toBeGreaterThanOrEqual(0)
  })

  it('handles ten simultaneous sales against a 3-unit stock without ever going negative', async () => {
    const { db, variantId, userId, sessionId } = await seedBasics()
    run(db, 'UPDATE product_variants SET quantity=3 WHERE id=?', [variantId])

    const attempts = Array.from({ length: 10 }, () =>
      completeSale({ userId, registerSessionId: sessionId, cart: [{ variantId, quantity: 1, price: 20 } as any], discount: 0, paid: 20, paymentMethod: 'cash', role: 'cashier' })
    )
    const results = await Promise.allSettled(attempts)
    const succeeded = results.filter(r => r.status === 'fulfilled')

    expect(succeeded.length).toBe(3) // exactly as many as there was stock for
    const variant = query<any>(db, 'SELECT quantity FROM product_variants WHERE id=?', [variantId])[0]
    expect(variant.quantity).toBe(0)
  })

  it('double-tap idempotency holds even when both taps fire at the exact same instant (not one after another)', async () => {
    const { db, variantId, userId, sessionId } = await seedBasics()
    const idempotencyKey = 'double-tap-key'
    const input = { userId, registerSessionId: sessionId, cart: [{ variantId, quantity: 2, price: 20 } as any], discount: 0, paid: 40, paymentMethod: 'cash' as const, role: 'cashier' as const, idempotencyKey }

    const [a, b] = await Promise.allSettled([completeSale(input), completeSale(input)])
    const succeeded = [a, b].filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[]

    // Both calls should resolve to the SAME sale id (the second one hits the idempotency shortcut),
    // not create two separate sales or throw a spurious "transaction within a transaction" error.
    expect(succeeded.length).toBe(2)
    expect(succeeded[0].value.id).toBe(succeeded[1].value.id)

    const variant = query<any>(db, 'SELECT quantity FROM product_variants WHERE id=?', [variantId])[0]
    expect(variant.quantity).toBe(48) // 50 - 2, not 50 - 4
  })
})
