import assert from 'node:assert/strict'
import fs from 'node:fs'

const service = fs.readFileSync('src/lib/services/purchaseService.ts', 'utf8')

// 20 dozen × 12 pieces = 240 pieces in stock,
// but the invoice price is 7.80 EGP per piece => 93.60 EGP per dozen.
const enteredQuantity = 20
const factor = 12
const perPieceCost = 7.8
const unitCost = perPieceCost * factor
const stockQuantity = enteredQuantity * factor
const invoiceTotal = enteredQuantity * unitCost
const storedBaseUnitCost = unitCost / factor

assert.equal(stockQuantity, 240)
assert.equal(invoiceTotal, 1872)
assert.equal(Number(storedBaseUnitCost.toFixed(2)), 7.8)
assert.match(service, /subtotal \+= enteredQuantity \* Number\(l\.unitCost\)/)
assert.match(service, /const itemTotal = Math\.round\(\(enteredQuantity \* Number\(l\.unitCost\)\)\*100\)\/100/)
assert.match(service, /const baseUnitCost = Math\.round\(\(Number\(l\.unitCost\)\/factor\)\*100\)\/100/)
console.log('purchase-pack-total-regression: PASS')
console.log(`20 dozen × 12 = ${stockQuantity} pieces; 20 × ${unitCost.toFixed(2)} = ${invoiceTotal.toFixed(2)} EGP`)
