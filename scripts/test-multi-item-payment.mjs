import assert from 'node:assert/strict'
function roundMoney(value) { return Math.round((Number(value) || 0) * 100 + Number.EPSILON) / 100 }
function cents(value) { return Math.round((Number(value) || 0) * 100) }

const subtotal = roundMoney(roundMoney(45) + roundMoney(75))
assert.equal(subtotal, 120)
assert.equal(cents(120) >= cents(subtotal), true)
assert.equal(roundMoney(119.999999999), 120)

// Regression: the same variant sold once as a half-dozen and once as a
// dozen can have the same rounded per-piece price (350/6 and 700/12 both
// round to 58.33). They must NOT merge into one line.
const lines = [
  { variantId: 'v1', unit: 'half-dozen', factor: 6, price: 350 / 6, quantity: 6, lineTotalCents: 35000 },
  { variantId: 'v1', unit: 'dozen', factor: 12, price: 700 / 12, quantity: 12, lineTotalCents: 70000 },
]
const merged = new Map()
for (const line of lines) {
  const key = `${line.variantId}:${line.unit}:${line.factor}:${Math.round(line.price * 100)}:${line.lineTotalCents}`
  const prev = merged.get(key)
  merged.set(key, prev ? { ...prev, quantity: prev.quantity + line.quantity } : line)
}
assert.equal(Math.round((350 / 6) * 100), Math.round((700 / 12) * 100))
assert.equal(merged.size, 2)
const backendSubtotal = [...merged.values()].reduce((sum, line) => sum + line.lineTotalCents, 0)
assert.equal(backendSubtotal, 105000)
assert.equal(Math.round(1050 * 100), 105000)
console.log('multi-item-payment: PASS — half-dozen 350 + dozen 700 = 1050')
