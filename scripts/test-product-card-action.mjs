import fs from 'node:fs'
const sales = fs.readFileSync('src/components/sections/sales-section.tsx', 'utf8')
const grid = fs.readFileSync('src/components/sections/sales/ProductGrid.tsx', 'utf8')
if (!sales.includes('function chooseProduct')) { console.error('FAIL: chooseProduct missing'); process.exit(1) }
if (!sales.includes('openQuantityPad(v, p.name)')) { console.error('FAIL: single-unit product does not open quantity pad'); process.exit(1) }
if (!sales.includes('setUnitPickerFor({ v, productName: p.name })')) { console.error('FAIL: pack-priced product does not open unit picker'); process.exit(1) }
if (sales.includes('function editItemPrice')) { console.error('FAIL: POS price editor still exists'); process.exit(1) }
if (!grid.includes('onClick')) { console.error('FAIL: product grid has no click action'); process.exit(1) }
console.log('product-card-action: PASS')
