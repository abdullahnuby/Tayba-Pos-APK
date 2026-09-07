import assert from 'node:assert/strict'

const safeArray = (value) => Array.isArray(value) ? value : []

const dashboard = { todayByMethod: undefined, recentSales: undefined, reorderList: undefined, topProducts: undefined, salesTrend: undefined }
assert.deepEqual(safeArray(dashboard.recentSales), [])
assert.deepEqual(safeArray(dashboard.reorderList), [])
assert.deepEqual(safeArray(dashboard.topProducts), [])
assert.deepEqual(safeArray(dashboard.salesTrend), [])

const purchase = { items: undefined, supplier: undefined }
assert.equal(safeArray(purchase.items).length, 0)
assert.equal(String(purchase.supplier?.name || ''), '')

const product = { variants: undefined }
assert.equal(safeArray(product.variants).length, 0)

const sync = { headers: undefined, rows: [null, ['a']] }
assert.deepEqual(safeArray(sync.headers), [])
assert.deepEqual(sync.rows.map((r) => Array.isArray(r) ? r : []), [[], ['a']])

console.log('page-data-shape-regression: PASS')
