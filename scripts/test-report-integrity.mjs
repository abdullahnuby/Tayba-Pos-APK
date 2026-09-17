import fs from 'node:fs'
const checks=[]
function has(file, needle){const s=fs.readFileSync(file,'utf8'); checks.push([file,needle,s.includes(needle)])}
has('src/components/sections/reports-section.tsx','الربح الصافي')
has('src/components/sections/reports-section.tsx','salesByCategory')
has('src/components/sections/reports-section.tsx','expensesByCategory')
has('src/components/sections/sales-invoices-section.tsx','printInvoice')
has('src/components/sections/sales-invoices-section.tsx','product_name')
has('src/components/sections/purchases-section.tsx','supplierFilter')
has('src/components/sections/purchases-section.tsx','<table')
has('src/components/sections/purchases-section.tsx','printPurchase')
has('src/lib/api/shared.ts','todayNetProfit')
has('src/lib/repositories/reports.ts','operatingNetProfit')
for(const [f,n,ok] of checks){if(!ok){console.error(`FAIL ${f}: ${n}`);process.exitCode=1}else console.log(`PASS ${f}: ${n}`)}
