import { describe, it, expect } from 'vitest'
import { v4 as uuid } from 'uuid'
import { seedBasics } from '../../__tests__/fixtures'
import { completeSale } from '../../services/salesService'
import { returnSale } from '../../services/returnsService'
import { closeSession } from '../registerSessions'
import { query, run } from '../../db/client'

describe('closeSession — cash reconciliation', () => {
  it('expected cash = opening float + cash sales, with zero difference when the drawer matches', async () => {
    const { db, variantId, userId, sessionId } = await seedBasics() // opening_float seeded as 500
    await completeSale({
      userId, registerSessionId: sessionId,
      cart: [{ variantId, quantity: 3, price: 20 } as any],
      discount: 0, paid: 60, paymentMethod: 'cash', role: 'cashier',
    })

    const result = await closeSession(sessionId, 560) // 500 opening + 60 cash sale, counted exactly

    expect(result.expected).toBe(560)
    expect(result.difference).toBe(0)
    expect(result.report.cashSales).toBe(60)
  })

  it('flags a shortage when the counted cash is less than expected', async () => {
    const { variantId, userId, sessionId } = await seedBasics()
    await completeSale({
      userId, registerSessionId: sessionId,
      cart: [{ variantId, quantity: 3, price: 20 } as any],
      discount: 0, paid: 60, paymentMethod: 'cash', role: 'cashier',
    })

    const result = await closeSession(sessionId, 540) // 20 EGP missing from the drawer
    expect(result.expected).toBe(560)
    expect(result.difference).toBe(-20)
  })

  it('subtracts cash refunds from expected cash', async () => {
    const { db, variantId, userId, sessionId } = await seedBasics()
    const sale = await completeSale({
      userId, registerSessionId: sessionId,
      cart: [{ variantId, quantity: 5, price: 20 } as any],
      discount: 0, paid: 100, paymentMethod: 'cash', role: 'cashier',
    })
    const saleItem = query<any>(db, 'SELECT id FROM sale_items WHERE sale_id=?', [sale.id])[0]
    await returnSale({ userId, role: 'cashier', saleId: sale.id, lines: [{ saleItemId: saleItem.id, variantId, quantity: 2 }], refundMethod: 'cash' })

    // 500 opening + 100 cash sale - 40 cash refund = 560 expected in the drawer
    const result = await closeSession(sessionId, 560)
    expect(result.expected).toBe(560)
    expect(result.difference).toBe(0)
  })

  it('credit sales do not affect the cash drawer at all', async () => {
    const { db, variantId, userId, sessionId } = await seedBasics()
    const customerId = uuid()
    run(db, `INSERT INTO customers(id,name,balance) VALUES(?,?,0)`, [customerId, 'عميل تجريبي'])
    await completeSale({
      userId, registerSessionId: sessionId, customerId,
      cart: [{ variantId, quantity: 10, price: 20 } as any], // 200 EGP, all on credit
      discount: 0, paid: 0, paymentMethod: 'credit', role: 'cashier',
    })

    const result = await closeSession(sessionId, 500) // drawer untouched, still just the opening float
    expect(result.expected).toBe(500)
    expect(result.difference).toBe(0)
    expect(result.report.creditSales).toBe(200)
    expect(result.report.cashSales).toBe(0)
  })

  it('rejects closing a session that is already closed', async () => {
    const { sessionId } = await seedBasics()
    await closeSession(sessionId, 500)
    await expect(closeSession(sessionId, 500)).rejects.toThrow(/الوردية غير موجودة أو مغلقة/)
  })
})
