import { getDb, persist, query, withTransaction } from '../db/client'
import { v4 as uuid } from 'uuid'
import type { Product, Variant } from '../types'

export async function listProducts(search = ''): Promise<Product[]> {
  const db = await getDb()
  const pattern = `%${search.trim()}%`
  const products = query<{ id: string; name: string; category_id: string; category_name: string }>(db,
    `SELECT p.id, p.name, p.category_id, c.name AS category_name
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.name LIKE ? OR c.name LIKE ? ORDER BY p.name`, [pattern, pattern])
  const variants = query<Variant>(db, 'SELECT * FROM product_variants ORDER BY sku')
  return products.map((p) => ({ ...p, variants: variants.filter((v) => v.product_id === p.id) }))
}

export async function findVariantByBarcodeOrSku(code: string): Promise<Variant | null> {
  const db = await getDb()
  const value = code.trim()
  const rows = query<Variant>(db, 'SELECT * FROM product_variants WHERE barcode = ? OR sku = ? LIMIT 1', [value, value])
  return rows[0] ?? null
}

export async function seedOpeningStock(input: { productName: string; categoryName: string; sku: string; barcode?: string; costPrice: number; sellPrice: number; quantity: number }): Promise<void> {
  await withTransaction((db) => {
    const category = query<{ id: string }>(db, 'SELECT id FROM categories WHERE name = ?', [input.categoryName])[0]
    const categoryId = category?.id ?? uuid()
    if (!category) db.run('INSERT INTO categories (id, name) VALUES (?, ?)', [categoryId, input.categoryName])

    const productId = uuid()
    const variantId = uuid()
    db.run('INSERT INTO products (id, name, category_id) VALUES (?, ?, ?)', [productId, input.productName, categoryId])
    db.run(`INSERT INTO product_variants (id, product_id, sku, barcode, cost_price, sell_price, quantity)
            VALUES (?, ?, ?, ?, ?, ?, ?)`, [variantId, productId, input.sku, input.barcode ?? null, input.costPrice, input.sellPrice, input.quantity])
    db.run(`INSERT INTO stock_movements (id, variant_id, type, quantity, reference_type, reference_id)
            VALUES (?, ?, 'OPENING_STOCK', ?, 'seed', ?)`, [uuid(), variantId, input.quantity, productId])
  })
}

export async function createCategory(name: string): Promise<string> {
  const db = await getDb(); const id = uuid()
  db.run('INSERT INTO categories (id, name) VALUES (?, ?)', [id, name.trim()]); await persist(); return id
}
