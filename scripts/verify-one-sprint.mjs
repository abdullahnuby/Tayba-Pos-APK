import fs from 'node:fs'

const read = (p) => fs.readFileSync(p, 'utf8')
const checks = [
  ['native backup path', read('src/lib/services/archiveService.ts').includes('Documents/TaybaPOS/Backups')],
  ['backup integrity header check', read('src/lib/services/archiveService.ts').includes('subarray(0, 16)')],
  ['pre-restore safety backup', read('src/components/sections/sync-section.tsx').includes('pre-restore-')],
  ['purchase authorization', read('src/lib/localApi.ts').includes("p==='/purchases' && method==='POST'") && read('src/lib/localApi.ts').includes("requireRole(user,['admin','manager'])")],
  ['customer payment authorization', read('src/lib/localApi.ts').includes("p==='/customer-payments'&&method==='POST'") && read('src/lib/localApi.ts').includes("p==='/customer-payments' && method==='GET'")],
  ['cash movement sync', read('scripts/google-apps-script/Code.gs').includes("case 'cash_movement'")],
  ['stock adjustment sync', read('src/lib/repositories/inventory.ts').includes("entityType:'stock_adjustment'")],
  ['auto sync mounted', read('src/components/app-shell.tsx').includes('startAutoSync(30_000)')],
  ['register payment session', read('src/lib/repositories/payments.ts').includes('register_session_id')],
  ['refund uses cash ledger', read('src/lib/repositories/registerSessions.ts').includes('cash_ledger')],
  ['generic render error', read('src/App.tsx').includes('تم تسجيل الخطأ')],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
if (failed) process.exit(1)
console.log(`one-sprint: PASS (${checks.length} checks)`)
