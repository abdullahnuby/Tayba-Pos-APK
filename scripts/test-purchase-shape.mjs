import fs from 'node:fs'
import assert from 'node:assert/strict'

const api = fs.readFileSync('src/lib/localApi.ts','utf8')
const ui = fs.readFileSync('src/components/sections/purchases-section.tsx','utf8')

assert.match(api, /itemsByPurchase=new Map<string,any\[\]>\(\)/)
assert.match(api, /items:itemsByPurchase\.get\(r\.id\)\|\|\[\]/)
assert.match(api, /supplier:r\.supplier_id\?\{id:r\.supplier_id,name:r\.supplierName\|\|'بدون مورد'\}:null/)
assert.match(api, /items:itemRows\.map\(\(x:any\)=>\(/)
assert.match(ui, /p\.items\?\.length \|\| 0/)
assert.match(ui, /\(viewing\.items \|\| \[\]\)\.map\(it =>/)
console.log('purchase-shape-regression: PASS')
