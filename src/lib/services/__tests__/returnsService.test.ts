import { describe, it, expect } from 'vitest'
import { v4 as uuid } from 'uuid'
import { seedBasics } from '../../__tests__/fixtures'
import { completeSale } from '../salesService'
import { returnSale } from '../returnsService'
import { query, run } from '../../db/client'

async function makeSale(userId: string, sessionId: string, variantId: string, quantity: number, paid: number) {
  return completeSale({
    userId, registerSessionId: sessionId,
    cart: [{ variantId, quantity, price: 20 } as any],
    discount: 0, paid, paymentMethod: 'cash', role: 'cashier',
  })
}

describe('returnSale', () => {
  it('restores stock and pays cash back from the drawer for a small return', async () => {
    const { db, variantId, userId, sessionId } = await seedBasics()
    const sale = await makeSale(userId, sessionId, variantId, 5, 100) // 100 EGP, under the 200 cash-refund limit
    const saleItem = query<any>(db, 'SELECT id FROM sale_items WHERE sale_id=?', [sale.id])[0]

    const result = await returnSale({
      userId, role: 'cashier', saleId: sale.id,
      lines: [{ saleItemId: saleItem.id, variantId, quantity: 2 }],
      refundMethod: 'cash',
    })

    expect(result.total).toBe(40) // 2 x 20
    const variant = query<any>(db, 'SELECT quantity FROM product_variants WHERE id=?', [variantId])[0]
    expect(variant.quantity).toBe(47) // 50 - 5 sold + 2 returned
  })

  it('blocks a cash return over 200 EGP by a cashier without manager approval', async () => {
    const { userId, sessionId, variantId, db } = await seedBasics()
    const sale = await makeSale(userId, sessionId, variantId, 20, 400) // 400 EGP sale
    const saleItem = query<any>(db, 'SELECT id FROM sale_items WHERE sale_id=?', [sale.id])[0]

    await expect(returnSale({
      userId, role: 'cashier', saleId: sale.id,
      lines: [{ saleItemId: saleItem.id, variantId, quantity: 15 }], // 300 EGP > 200 limit
      refundMethod: 'cash',
    })).rejects.toThrow(/مرتجع نقدي كبير يحتاج موافقة المدير/)
  })

  it('rejects returning more than was originally sold on that line', async () => {
    const { userId, sessionId, variantId, db } = await seedBasics()
    const sale = await makeSale(userId, sessionId, variantId, 3, 60)
    const saleItem = query<any>(db, 'SELECT id FROM sale_items WHERE sale_id=?', [sale.id])[0]

    await expect(returnSale({
      userId, role: 'cashier', saleId: sale.id,
      lines: [{ saleItemId: saleItem.id, variantId, quantity: 4 }], // sold only 3
      refundMethod: 'cash',
    })).rejects.toThrow(/كمية المرتجع تتجاوز الكمية المباعة/)
  })

  it('rejects a second return that would push cumulative returned quantity past what was sold', async () => {
    const { userId, sessionId, variantId, db } = await seedBasics()
    const sale = await makeSale(userId, sessionId, variantId, 5, 100)
    const saleItem = query<any>(db, 'SELECT id FROM sale_items WHERE sale_id=?', [sale.id])[0]

    await returnSale({ userId, role: 'cashier', saleId: sale.id, lines: [{ saleItemId: saleItem.id, variantId, quantity: 3 }], refundMethod: 'cash' })
    // 3 already returned out of 5 sold — trying to return 3 more (total 6) must fail.
    await expect(returnSale({
      userId, role: 'cashier', saleId: sale.id,
      lines: [{ saleItemId: saleItem.id, variantId, quantity: 3 }],
      refundMethod: 'cash',
    })).rejects.toThrow(/كمية المرتجع تتجاوز الكمية المباعة/)
  })

  it('deducts credit refunds from the customer balance instead of touching cash', async () => {
    const { db, variantId, userId, sessionId } = await seedBasics()
    const customerId = uuid()
    run(db, `INSERT INTO customers(id,name,balance) VALUES(?,?,0)`, [customerId, 'عميل تجريبي'])
    const sale = await completeSale({
      userId, registerSessionId: sessionId, customerId,
      cart: [{ variantId, quantity: 5, price: 20 } as any],
      discount: 0, paid: 0, paymentMethod: 'credit', role: 'cashier',
    })
    const saleItem = query<any>(db, 'SELECT id FROM sale_items WHERE sale_id=?', [sale.id])[0]

    await returnSale({
      userId, role: 'cashier', saleId: sale.id, customerId,
      lines: [{ saleItemId: saleItem.id, variantId, quantity: 2 }],
      refundMethod: 'credit',
    })

    const customer = query<any>(db, 'SELECT balance FROM customers WHERE id=?', [customerId])[0]
    expect(customer.balance).toBe(60) // 100 owed - 40 returned
  })
})
