import { query } from './db/client'
import type { Database } from 'sql.js'

export function checkLocalSalePrice(
  db: Database,
  variantId: string,
  salePrice: number,
  role: 'admin' | 'manager' | 'cashier',
  managerApproved = false,
) {
  const v = query<{
    sell_price: number
    quarter_dozen_price: number | null
    half_dozen_price: number | null
    dozen_price: number | null
    name: string
    sku: string
  }>(
    db,
    `SELECT pv.sell_price,pv.quarter_dozen_price,pv.half_dozen_price,pv.dozen_price,p.name,pv.sku
     FROM product_variants pv JOIN products p ON p.id=pv.product_id WHERE pv.id=?`,
    [variantId],
  )[0]

  if (!v) return { ok: false, error: 'المنتج غير موجود', needsManagerApproval: false }
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    return { ok: false, error: `السعر غير صحيح لـ ${v.name} (${v.sku})`, needsManagerApproval: false }
  }

  // Managers/admins may use the existing controlled approval/edit flow.
  if (role !== 'cashier' || managerApproved) return { ok: true }

  // Cashier sales are locked to the prices configured for the product.
  // No percentage tolerance and no manual price override.
  const allowed: number[] = [Number(v.sell_price)]
  if (v.quarter_dozen_price != null) allowed.push(Number(v.quarter_dozen_price))
  if (v.half_dozen_price != null) allowed.push(Number(v.half_dozen_price))
  if (v.dozen_price != null) allowed.push(Number(v.dozen_price))

  const exact = allowed.some(x => Math.abs(x - salePrice) <= 0.01)
  if (exact) return { ok: true }

  return {
    ok: false,
    error: 'الكاشير لا يمكنه تعديل سعر البيع. استخدم السعر المحدد للصنف.',
    needsManagerApproval: true,
  }
}
