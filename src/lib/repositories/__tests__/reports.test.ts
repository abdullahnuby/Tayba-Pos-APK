import { afterEach, describe, expect, it } from 'vitest'
import { v4 as uuid } from 'uuid'
import { seedBasics } from '../../__tests__/fixtures'
import { run } from '../../db/client'
import { dashboard } from '../../api/shared'
import { fullReports } from '../reports'

const previousTimezone = process.env.TZ

afterEach(() => {
  process.env.TZ = previousTimezone
})

describe('fullReports calendar boundaries', () => {
  it('includes the first and last selected day and keeps daily totals aligned across a Cairo timezone month', async () => {
    const { db, userId, sessionId, variantId } = await seedBasics()
    process.env.TZ = 'Africa/Cairo'

    const firstSaleId = uuid()
    const lastSaleId = uuid()

    run(db, `INSERT INTO sales
      (id, invoice_no, user_id, register_session_id, date, subtotal, discount, tax_amount, total, payment_method, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [firstSaleId, 'MONTH-START-001', userId, sessionId, '2026-10-01T10:00:00', 100, 0, 0, 100, 'cash'])

    run(db, `INSERT INTO sale_items (id, sale_id, variant_id, quantity, unit_price, unit_cost, total)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), firstSaleId, variantId, 2, 50, 10, 100])

    run(db, `INSERT INTO sales
      (id, invoice_no, user_id, register_session_id, date, subtotal, discount, tax_amount, total, payment_method, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [lastSaleId, 'MONTH-END-001', userId, sessionId, '2026-10-29T12:00:00', 50, 0, 0, 50, 'cash'])

    run(db, `INSERT INTO sale_items (id, sale_id, variant_id, quantity, unit_price, unit_cost, total)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), lastSaleId, variantId, 1, 50, 10, 50])

    const report = await fullReports('2026-10-01', '2026-10-29')

    expect(report.dailyTrend).toHaveLength(29)
    expect(report.dailyTrend[0].date).toBe('2026-10-01')
    expect(report.dailyTrend.at(-1)?.date).toBe('2026-10-29')
    expect(report.dailyTrend[0].sales).toBe(100)
    expect(report.dailyTrend.at(-1)?.sales).toBe(50)
    expect(report.dailyTrend.reduce((sum, day) => sum + day.sales, 0)).toBe(150)
    expect(report.totalSales).toBe(150)
    expect(report.cogs).toBe(30)
    expect(report.grossProfit).toBe(120)
  })

  it('builds dashboard statistics for a month-to-date range in Cairo without throwing', async () => {
    const { db } = await seedBasics()
    process.env.TZ = 'Africa/Cairo'

    const result = await dashboard('2026-10-01', '2026-10-30')

    expect(result.from).toBe('2026-10-01')
    expect(result.to).toBe('2026-10-30')
    expect(result.salesTrend).toHaveLength(30)
    expect(result.salesTrend[0].date).toBe('2026-10-01')
    expect(result.salesTrend.at(-1)?.date).toBe('2026-10-30')
    expect(result.todaySales).toBe(0)
    expect(result.lowStockCount).toBeGreaterThanOrEqual(0)
    expect(db).toBeDefined()
  })

  it('rejects impossible calendar dates instead of creating a misleading report', async () => {
    await seedBasics()
    await expect(fullReports('2026-02-30', '2026-03-10'))
      .rejects.toThrow(/الفترة الزمنية غير صحيحة/)
  })

  it('rejects a start date that is later than the end date', async () => {
    await seedBasics()
    await expect(fullReports('2026-10-29', '2026-10-01'))
      .rejects.toThrow(/الفترة الزمنية غير صحيحة/)
  })
})
