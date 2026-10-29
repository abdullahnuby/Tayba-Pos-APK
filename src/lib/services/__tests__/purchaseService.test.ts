import { describe, it, expect } from 'vitest'
import { v4 as uuid } from 'uuid'
import { seedBasics } from '../../__tests__/fixtures'
import { completePurchase, voidPurchase } from '../purchaseService'
import { returnPurchase } from '../returnsService'
import { query, run } from '../../db/client'

async function makeSupplier(db: any) {
  const id = uuid()
  run(db, `INSERT INTO suppliers(id,name,balance) VALUES(?,?,0)`, [id, 'مورد تجريبي'])
  return id
}

describe('completePurchase', () => {
  it('increases stock and recalculates weighted-average cost price', async () => {
    // seeded variant: quantity=50, cost_price=10
    const { db, variantId, userId } = await seedBasics()
    const supplierId = await makeSupplier(db)

    await completePurchase({
      userId, supplierId,
      lines: [{ variantId, quantity: 50, unitCost: 20 }],
      paid: 1000, paymentMethod: 'cash',
    })

    const variant = query<any>(db, 'SELECT quantity, cost_price FROM product_variants WHERE id=?', [variantId])[0]
    expect(variant.quantity).toBe(100) // 50 existing + 50 purchased
    // weighted avg = (50*10 + 50*20) / 100 = 15
    expect(variant.cost_price).toBe(15)
  })

  it('adds the unpaid balance to the supplier and marks nothing due when paid in full', async () => {
    const { db, variantId, userId } = await seedBasics()
    const supplierId = await makeSupplier(db)

    const result = await completePurchase({
      userId, supplierId,
      lines: [{ variantId, quantity: 10, unitCost: 20 }], // total 200
      paid: 120, paymentMethod: 'cash',
    })

    expect(result.total).toBe(200)
    expect(result.due).toBe(80)
    const supplier = query<any>(db, 'SELECT balance FROM suppliers WHERE id=?', [supplierId])[0]
    expect(supplier.balance).toBe(80)
  })

  it('rejects a credit purchase that also tries to record an upfront payment', async () => {
    const { variantId, userId, db } = await seedBasics()
    const supplierId = await makeSupplier(db)
    await expect(completePurchase({
      userId, supplierId,
      lines: [{ variantId, quantity: 5, unitCost: 20 }],
      paid: 50, paymentMethod: 'credit',
    })).rejects.toThrow(/الشراء الآجل لا يسجل دفعة مقدمة/)
  })

  it('rejects paying more than the invoice total', async () => {
    const { variantId, userId, db } = await seedBasics()
    const supplierId = await makeSupplier(db)
    await expect(completePurchase({
      userId, supplierId,
      lines: [{ variantId, quantity: 5, unitCost: 20 }], // total 100
      paid: 150, paymentMethod: 'cash',
    })).rejects.toThrow(/المدفوع أكبر من الإجمالي/)
  })
})

describe('voidPurchase', () => {
  it('reverses stock and supplier balance', async () => {
    const { db, variantId, userId } = await seedBasics()
    const supplierId = await makeSupplier(db)
    const purchase = await completePurchase({
      userId, supplierId,
      lines: [{ variantId, quantity: 10, unitCost: 20 }], // total 200, unpaid
      paid: 0, paymentMethod: 'credit',
    })

    let variant = query<any>(db, 'SELECT quantity FROM product_variants WHERE id=?', [variantId])[0]
    expect(variant.quantity).toBe(60) // 50 + 10

    await voidPurchase({ userId, purchaseId: purchase.id, reason: 'خطأ' })

    variant = query<any>(db, 'SELECT quantity FROM product_variants WHERE id=?', [variantId])[0]
    expect(variant.quantity).toBe(50) // back to original

    const supplier = query<any>(db, 'SELECT balance FROM suppliers WHERE id=?', [supplierId])[0]
    expect(supplier.balance).toBe(0) // debt reversed
  })

  it('refuses to void a purchase if current stock is now lower than what would be pulled back', async () => {
    const { db, variantId, userId } = await seedBasics()
    const supplierId = await makeSupplier(db)
    const purchase = await completePurchase({
      userId, supplierId,
      lines: [{ variantId, quantity: 10, unitCost: 20 }],
      paid: 0, paymentMethod: 'credit',
    })
    // Sell off stock so there isn't enough left to reverse the purchase.
    run(db, 'UPDATE product_variants SET quantity=5 WHERE id=?', [variantId])

    await expect(voidPurchase({ userId, purchaseId: purchase.id, reason: 'خطأ' }))
      .rejects.toThrow(/لا يمكن إلغاء الشراء/)
  })
})


describe('purchase returns and cancellation integrity', () => {
  it('rejects voiding a purchase after a completed return without changing stock or purchase status', async () => {
    const { db, variantId, userId, sessionId } = await seedBasics()
    const supplierId = await makeSupplier(db)
    const purchase = await completePurchase({
      userId, supplierId, registerSessionId: sessionId,
      lines: [{ variantId, quantity: 10, unitCost: 20 }],
      paid: 0, paymentMethod: 'credit',
    })
    await returnPurchase({ userId, purchaseId: purchase.id, supplierId, lines: [{ variantId, quantity: 2 }], refundMethod: 'credit' })
    const stockBefore = query<any>(db, 'SELECT quantity FROM product_variants WHERE id=?', [variantId])[0].quantity
    await expect(voidPurchase({ userId, purchaseId: purchase.id, reason: 'اختبار' })).rejects.toThrow(/مرتجع مكتمل/)
    expect(query<any>(db, 'SELECT quantity FROM product_variants WHERE id=?', [variantId])[0].quantity).toBe(stockBefore)
    expect(query<any>(db, 'SELECT status FROM purchases WHERE id=?', [purchase.id])[0].status).toBe('completed')
  })

  it('validates the combined quantity when the same variant is repeated in one purchase return', async () => {
    const { db, variantId, userId, sessionId } = await seedBasics()
    const supplierId = await makeSupplier(db)
    const purchase = await completePurchase({
      userId, supplierId, registerSessionId: sessionId,
      lines: [{ variantId, quantity: 5, unitCost: 20 }],
      paid: 100, paymentMethod: 'cash',
    })
    const stockBefore = query<any>(db, 'SELECT quantity FROM product_variants WHERE id=?', [variantId])[0].quantity
    await expect(returnPurchase({
      userId, purchaseId: purchase.id, supplierId,
      lines: [{ variantId, quantity: 3 }, { variantId, quantity: 3 }],
      refundMethod: 'credit',
    })).rejects.toThrow(/كمية المرتجع تتجاوز الكمية المشتراة/)
    expect(query<any>(db, 'SELECT quantity FROM product_variants WHERE id=?', [variantId])[0].quantity).toBe(stockBefore)
    expect(query<any>(db, 'SELECT COUNT(*) count FROM purchase_returns WHERE purchase_id=?', [purchase.id])[0].count).toBe(0)
  })

  it('coalesces repeated valid variant lines into one auditable return line', async () => {
    const { db, variantId, userId, sessionId } = await seedBasics()
    const supplierId = await makeSupplier(db)
    const purchase = await completePurchase({
      userId, supplierId, registerSessionId: sessionId,
      lines: [{ variantId, quantity: 5, unitCost: 20 }],
      paid: 100, paymentMethod: 'cash',
    })
    const result = await returnPurchase({
      userId, purchaseId: purchase.id, supplierId,
      lines: [{ variantId, quantity: 2 }, { variantId, quantity: 1 }],
      refundMethod: 'credit',
    })
    expect(result.total).toBe(60)
    const returnLine = query<any>(db, 'SELECT quantity,total FROM purchase_return_items WHERE purchase_return_id=?', [result.id])[0]
    expect(returnLine).toEqual({ quantity: 3, total: 60 })
    expect(query<any>(db, 'SELECT quantity FROM product_variants WHERE id=?', [variantId])[0].quantity).toBe(52)
  })
})
