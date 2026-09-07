import { getDb, query, withTransaction } from '../db/client'
import { v4 as uuid } from 'uuid'
import type { Database } from 'sql.js'

export type StockMovementType = 'PURCHASE' | 'SALE' | 'SALE_RETURN' | 'PURCHASE_RETURN' | 'ADJUSTMENT' | 'OPENING_STOCK'

/** Internal primitive used by every stock-moving service while inside its transaction. */
export function applyStockDelta(db: Database, input: {
  variantId: string
  quantityChange: number
  type: StockMovementType
  referenceType: string
  referenceId: string
}): { before: number; after: number } {
  if (!Number.isInteger(input.quantityChange) || input.quantityChange === 0) throw new Error('كمية حركة المخزون غير صحيحة')
  const row = query<{ quantity: number }>(db, 'SELECT quantity FROM product_variants WHERE id=?', [input.variantId])[0]
  if (!row) throw new Error('الصنف غير موجود')
  const next = row.quantity + input.quantityChange
  if (next < 0) throw new Error('لا يمكن أن يصبح المخزون بالسالب')

  db.run("UPDATE product_variants SET quantity=?, updated_at=datetime('now') WHERE id=?", [next,input.variantId])
  db.run(`INSERT INTO stock_movements(id,variant_id,type,quantity,reference_type,reference_id)
          VALUES(?,?,?,?,?,?)`, [uuid(),input.variantId,input.type,input.quantityChange,input.referenceType,input.referenceId])
  return { before: row.quantity, after: next }
}

export async function adjustStock(input: { variantId: string; quantityChange: number; userId?: string; reason?: string; notes?: string; type?: StockMovementType }): Promise<void> {
  await withTransaction((db) => {
    const result = applyStockDelta(db, { variantId: input.variantId, quantityChange: input.quantityChange, type: input.type ?? 'ADJUSTMENT', referenceType: 'adjustment', referenceId: input.userId ?? 'system' })
    db.run(`INSERT INTO audit_logs(id,user_id,action,entity,entity_id,after_json) VALUES(?,?,?,?,?,?)`, [uuid(),input.userId ?? null,'STOCK_ADJUST','product_variant',input.variantId,JSON.stringify({before: result.before, after: result.after, reason: input.reason ?? null, notes: input.notes ?? null, type: input.type ?? 'ADJUSTMENT'})])
  })
}

export async function getStockLedger(variantId: string) {
  const db = await getDb()
  return query(db, 'SELECT * FROM stock_movements WHERE variant_id=? ORDER BY created_at DESC', [variantId])
}
