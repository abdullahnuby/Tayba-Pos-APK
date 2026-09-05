import fs from 'node:fs'

const read = (p) => fs.readFileSync(p, 'utf8')
const sales = read('src/components/sections/sales-section.tsx')
const api = read('src/lib/localApi.ts')
const service = read('src/lib/services/salesService.ts')
const register = read('src/lib/repositories/registerSessions.ts')
const css = read('src/styles.css')

const checks = [
  ['cashier sales history is scoped to current user', api.includes("s.user_id=?") && api.includes("user!.role==='cashier'")],
  ['cashier cannot resume another cashier draft', api.includes('لا تملك صلاحية استئناف هذه الفاتورة')],
  ['cashier cannot use another cashier register', service.includes('لا يمكن للكاشير استخدام وردية كاشير آخر')],
  ['cashier can quick-create a customer', api.includes("if(p==='/customers' && method==='POST')") && !api.includes("['admin','manager'].includes(user!.role))return jsonResponse({error:'صلاحية غير كافية'},403);const b=await body(req);const name")],
  ['cashier discount above 5% requires manager', service.includes('خصم الكاشير يتجاوز 5% ويحتاج موافقة المدير')],
  ['cashier price edit is available in POS', sales.includes('editItemPrice')],
  ['cart remains scrollable when many items exist', css.includes('.cashier-pos .pos-cart-list {\n  overflow-y: auto !important;')],
  ['register close returns a complete report', register.includes('report:{') && register.includes('invoiceCount')],
  ['register totals are calculated from actual sales', api.includes('COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.register_session_id=rs.id')],
  ['idempotency uses durable database columns', service.includes('WHERE idempotency_key=?') && api.includes('idempotency_key=?')],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
if (failed) process.exit(1)
console.log(`cashier-contracts: PASS (${checks.length} checks)`)
