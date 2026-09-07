import { getDb, query } from './db/client'
import type { Database } from 'sql.js'

export type Json = Record<string, any> | any[] | string | number | boolean | null

export function jsonResponse(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function readJsonBody(req: Request) {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

export function urlOf(input: RequestInfo | URL) {
  return typeof input === 'string'
    ? new URL(input, location.origin)
    : new URL(input instanceof Request ? input.url : input.toString(), location.origin)
}

export function requireRole(user: any, roles?: readonly string[]) {
  if (!user) return jsonResponse({ error: 'غير مصرح' }, 401)
  if (roles && !roles.includes(user.role)) {
    return jsonResponse({ error: 'صلاحية غير كافية' }, 403)
  }
  return null
}

export async function hashPin(pin: string, salt: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${salt}:${pin}`),
  )
  return `${salt}:${[...new Uint8Array(digest)]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('')}`
}

export async function verifyPin(pin: string, stored: string) {
  const [salt, hash] = String(stored || '').split(':')
  if (!salt || !hash) return false
  return (await hashPin(pin, salt)).split(':')[1] === hash
}

export function randSalt() {
  return crypto.randomUUID().replaceAll('-', '')
}

export function serializeSaleById(db: Database, saleId: string) {
  const sale = query<any>(
    db,
    'SELECT s.*,c.name customerName,c.phone customerPhone FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=?',
    [saleId],
  )[0]
  if (!sale) return null

  const items = query<any>(
    db,
    `SELECT i.*,v.sku,v.size,v.color,p.name product_name
     FROM sale_items i
     JOIN product_variants v ON v.id=i.variant_id
     JOIN products p ON p.id=v.product_id
     WHERE i.sale_id=?
     ORDER BY i.rowid`,
    [saleId],
  ).map((r: any) => ({
    id: r.id,
    variantId: r.variant_id,
    quantity: Number(r.quantity || 0),
    unitPrice: Number(r.unit_price || 0),
    unitCost: Number(r.unit_cost || 0),
    total: Number(r.total || 0),
    variant: {
      sku: r.sku,
      size: r.size || null,
      color: r.color || null,
      product: { name: r.product_name },
    },
  }))

  return {
    ...sale,
    invoiceNo: sale.invoice_no,
    customer: sale.customer_id
      ? { name: sale.customerName || '', phone: sale.customerPhone || null }
      : null,
    items,
    paymentMethod: sale.payment_method,
  }
}

export function rowToVariant(r: any) {
  return {
    id: r.id,
    sku: r.sku,
    barcode: r.barcode,
    size: r.size,
    color: r.color,
    material: r.material,
    costPrice: r.cost_price,
    sellPrice: r.sell_price,
    quantity: r.quantity,
    minQuantity: r.min_quantity,
    reorderQty: r.reorder_qty,
    baseUnit: r.base_unit,
    purchaseUnit: r.purchase_unit,
    purchaseUnitFactor: r.purchase_unit_factor,
    saleUnit: r.sale_unit,
    saleUnitFactor: r.sale_unit_factor,
    quarterDozenPrice: r.quarter_dozen_price,
    halfDozenPrice: r.half_dozen_price,
    dozenPrice: r.dozen_price,
    product: { id: r.product_id, name: r.product_name },
  }
}

export function mapCustomer(r: any) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    address: r.address,
    notes: r.notes,
    balance: Number(r.balance || 0),
    loyaltyPoints: Number(r.loyalty_points || 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function mapSupplier(r: any) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    address: r.address,
    notes: r.notes,
    balance: Number(r.balance || 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function mapProduct(db: Database, id: string) {
  const product = query<any>(
    db,
    'SELECT p.*,c.id category_id,c.name category_name,b.id brand_id,b.name brand_name FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id WHERE p.id=?',
    [id],
  )[0]
  if (!product) return null

  return {
    ...product,
    category: { id: product.category_id, name: product.category_name },
    brand: product.brand_id
      ? { id: product.brand_id, name: product.brand_name }
      : null,
    variants: query<any>(
      db,
      'SELECT * FROM product_variants WHERE product_id=? ORDER BY sku',
      [id],
    ).map(rowToVariant),
  }
}

export function csvEscape(value: any) {
  const s = String(value ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

export function makeCsv(rows: any[]) {
  if (!rows.length) return '\ufeffno_data\n'
  const headers = Object.keys(rows[0])
  return '\ufeff' + [
    headers.join(','),
    ...rows.map(row => headers.map(h => csvEscape(row[h])).join(',')),
  ].join('\n')
}

// Intentionally kept as a small dependency helper so future API modules can
// request a DB without importing the entire local API router.
export { getDb, query }
