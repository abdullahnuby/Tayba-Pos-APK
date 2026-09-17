import { v4 as uuid } from 'uuid'
import { getDb, run, __resetDbForTests } from '../db/client'

// Every test gets a completely fresh, real schema — same code path the app
// itself uses (sql.js + the actual schema.sql), just never persisted to a
// real disk. No mocking of business logic: if completeSale() has a bug,
// these tests hit it for real.
export async function freshDb() {
  await __resetDbForTests()
  return getDb()
}

export async function seedBasics() {
  const db = await freshDb()
  const categoryId = uuid()
  const productId = uuid()
  const variantId = uuid()
  const userId = uuid()
  const sessionId = uuid()

  run(db, 'INSERT INTO categories(id,name) VALUES(?,?)', [categoryId, 'شراب'])
  run(db, 'INSERT INTO products(id,name,category_id) VALUES(?,?,?)', [productId, 'شراب قطن', categoryId])
  run(
    db,
    `INSERT INTO product_variants(id,product_id,sku,barcode,size,color,cost_price,sell_price,quantity)
     VALUES(?,?,?,?,?,?,?,?,?)`,
    [variantId, productId, 'SKU-1', 'BC-1', '40', 'أسود', 10, 20, 50],
  )
  // pin_hash content doesn't matter for service-level tests — auth isn't exercised here.
  run(db, `INSERT INTO users(id,username,pin_hash,name,role) VALUES(?,?,?,?,?)`, [userId, 'cashier1', 'x', 'كاشير 1', 'cashier'])
  run(db, `INSERT INTO register_sessions(id,user_id,opening_float,status) VALUES(?,?,?,'open')`, [sessionId, userId, 500])

  return { db, categoryId, productId, variantId, userId, sessionId }
}
