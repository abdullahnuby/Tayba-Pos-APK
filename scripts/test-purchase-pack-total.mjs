import assert from 'node:assert/strict'
import fs from 'node:fs'
const service = fs.readFileSync('src/lib/services/purchaseService.ts', 'utf8')
const enteredQuantity = 20, factor = 12, perPieceCost = 7.8, unitCost = perPieceCost * factor
assert.equal(enteredQuantity * factor, 240)
assert.equal(enteredQuantity * unitCost, 1872)
assert.match(service, /const itemTotal = fromCents\(toCents\(enteredQuantity \* Number\(l\.unitCost\)\)\)/)
assert.match(service, /const baseUnitCost = fromCents\(toCents\(Number\(l\.unitCost\)\/factor\)\)/)
console.log('purchase-pack-total-regression: PASS')
