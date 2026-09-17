import { describe, it, expect } from 'vitest'
import { v4 as uuid } from 'uuid'
import { seedBasics } from '../../__tests__/fixtures'
import { completeSale, voidSale } from '../salesService'
import { query, run } from '../../db/client'

describe('completeSale — cash sale', () => {
  it('deducts stock and computes total/change correctly', async () => {
    const { db, variantId, userId, sessionId } = await seedBasics()

    const result = await completeSale({
      userId, registerSessionId: sessionId,
      cart: [{ variantId, quantity: 3, price: 20 } as any],
      discount: 0, paid: 100, paymentMethod: 'cash', role: 'cashier',
    })

    // 3 units at 20 = 60. Paid 100 -> change 40.
    expect(result.total).toBe(60)
    expect(result.change).toBe(40)

    const variant = query<any>(db, 'SELECT quantity FROM product_variants WHERE id=?', [variantId])[0]
    expect(variant.quantity).toBe(47) // seeded with 50, sold 3
  })

  it('rejects a sale when stock is insufficient', async () => {
    const { variantId, userId, sessionId } = await seedBasics()
    await expect(completeSale({
      userId, registerSessionId: sessionId,
      cart: [{ variantId, quantity: 999, price: 20 } as any],
      discount: 0, paid: 20000, paymentMethod: 'cash', role: 'cashier',
    })).rejects.toThrow(/المخزون غير كافٍ/)
  })

  it('blocks a cashier discount over 5% without manager approval', async () => {
    const { variantId, userId, sessionId } = await seedBasics()
    // subtotal 200 (10 x 20). 6% discount = 12 > 5% (10) -> should be blocked.
    await expect(completeSale({
      userId, registerSessionId: sessionId,
      cart: [{ variantId, quantity: 10, price: 20 } as any],
      discount: 12, paid: 188, paymentMethod: 'cash', role: 'cashier', managerApproved: false,
    })).rejects.toThrow(/خصم الكاشير يتجاوز/)
  })

  it('allows the same discount with manager approval', async () => {
    const { variantId, userId, sessionId } = await seedBasics()
    const result = await completeSale({
      userId, registerSessionId: sessionId,
      cart: [{ variantId, quantity: 10, price: 20 } as any],
      discount: 12, paid: 188, paymentMethod: 'cash', role: 'cashier', managerApproved: true,
    })
    expect(result.total).toBe(188)
  })

  it('is idempotent: replaying the same idempotencyKey does not double-charge stock', async () => {
    const { db, variantId, userId, sessionId } = await seedBasics()
    const idempotencyKey = uuid()
    const input = {
      userId, registerSessionId: sessionId,
      cart: [{ variantId, quantity: 2, price: 20 } as any],
      discount: 0, paid: 40, paymentMethod: 'cash' as const, role: 'cashier' as const, idempotencyKey,
    }
    const first = await completeSale(input)
    const second = await completeSale(input) // simulates a double-submit / retry
    expect(second.id).toBe(first.id)

    const variant = query<any>(db, 'SELECT quantity FROM product_variants WHERE id=?', [variantId])[0]
    expect(variant.quantity).toBe(48) // 50 - 2, NOT 50 - 4
  })
})

describe('completeSale — credit sale', () => {
  it('adds the full total to the customer balance and takes no cash', async () => {
    const { db, variantId, userId, sessionId } = await seedBasics()
    const customerId = uuid()
    run(db, `INSERT INTO customers(id,name,balance) VALUES(?,?,0)`, [customerId, 'عميل تجريبي'])

    const result = await completeSale({
      userId, registerSessionId: sessionId, customerId,
      cart: [{ variantId, quantity: 2, price: 20 } as any],
      discount: 0, paid: 0, paymentMethod: 'credit', role: 'cashier',
    })

    expect(result.total).toBe(40)
    expect(result.paid).toBe(0)
    const customer = query<any>(db, 'SELECT balance FROM customers WHERE id=?', [customerId])[0]
    expect(customer.balance).toBe(40)
  })

  it('rejects a credit sale with no customer attached', async () => {
    const { variantId, userId, sessionId } = await seedBasics()
    await expect(completeSale({
      userId, registerSessionId: sessionId,
      cart: [{ variantId, quantity: 1, price: 20 } as any],
      discount: 0, paid: 0, paymentMethod: 'credit', role: 'cashier',
    })).rejects.toThrow(/البيع الآجل يحتاج عميل/)
  })
})

describe('voidSale', () => {
  it('restores stock and reverses the customer debt', async () => {
    const { db, variantId, userId, sessionId } = await seedBasics()
    const customerId = uuid()
    run(db, `INSERT INTO customers(id,name,balance) VALUES(?,?,0)`, [customerId, 'عميل تجريبي'])

    const sale = await completeSale({
      userId, registerSessionId: sessionId, customerId,
      cart: [{ variantId, quantity: 5, price: 20 } as any],
      discount: 0, paid: 0, paymentMethod: 'credit', role: 'cashier',
    })

    let variant = query<any>(db, 'SELECT quantity FROM product_variants WHERE id=?', [variantId])[0]
    expect(variant.quantity).toBe(45) // 50 - 5

    await voidSale({ userId, saleId: sale.id, reason: 'خطأ إدخال' })

    variant = query<any>(db, 'SELECT quantity FROM product_variants WHERE id=?', [variantId])[0]
    expect(variant.quantity).toBe(50) // stock restored

    const customer = query<any>(db, 'SELECT balance FROM customers WHERE id=?', [customerId])[0]
    expect(customer.balance).toBe(0) // debt reversed
  })
})
