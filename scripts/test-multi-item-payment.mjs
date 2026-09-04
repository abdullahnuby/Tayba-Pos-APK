import assert from 'node:assert/strict'
function roundMoney(value) { return Math.round((Number(value) || 0) * 100 + Number.EPSILON) / 100 }
function cents(value) { return Math.round((Number(value) || 0) * 100) }

const subtotal = roundMoney(roundMoney(45) + roundMoney(75))
assert.equal(subtotal, 120)
assert.equal(cents(120) >= cents(subtotal), true)
assert.equal(roundMoney(119.999999999), 120)

// Regression: same variant sold as two different packs must NOT be merged by variantId alone.
const lines = [
  { variantId: 'v1', price: 45 / 3, quantity: 3 },
  { variantId: 'v1', price: 75 / 6, quantity: 6 },
]
const merged = new Map()
for (const line of lines) {
  const key = `${line.variantId}:${Math.round(line.price * 100)}`
  const prev = merged.get(key)
  merged.set(key, prev ? { ...prev, quantity: prev.quantity + line.quantity } : line)
}
assert.equal(merged.size, 2)
let backendSubtotal = 0
for (const line of merged.values()) backendSubtotal += Math.round(line.price * 100) * line.quantity
assert.equal(backendSubtotal, 12000)
console.log('multi-item-payment: PASS')
