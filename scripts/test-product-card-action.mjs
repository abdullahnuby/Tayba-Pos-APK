import fs from 'node:fs'

const sales = fs.readFileSync('src/components/sections/sales-section.tsx', 'utf8')
const grid = fs.readFileSync('src/components/sections/sales/ProductGrid.tsx', 'utf8')

if (/if \(available\.length === 1\) return handlePickVariant/.test(sales)) {
  console.error('FAIL: single-variant product card still adds directly')
  process.exit(1)
}
if (!sales.includes('setSelectedProduct(p)')) {
  console.error('FAIL: product card does not open selection state')
  process.exit(1)
}
if (!sales.includes("setPendingAdd({ v, productName })")) {
  console.error('FAIL: variant add confirmation state missing')
  process.exit(1)
}
if (!sales.includes('تأكيد الإضافة')) {
  console.error('FAIL: explicit add confirmation UI missing')
  process.exit(1)
}
if (!sales.includes('تمت إضافة ${productName}')) {
  console.error('FAIL: successful add feedback missing')
  process.exit(1)
}
if (!grid.includes('اختيار وإضافة')) {
  console.error('FAIL: product grid intent label missing')
  process.exit(1)
}
console.log('product-card-action: PASS')
