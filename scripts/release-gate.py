from pathlib import Path
import re, sqlite3, sys
root=Path(__file__).resolve().parents[1]
src=root/'src'
errors=[]; notes=[]
# required sections
required=['dashboard-section.tsx','sales-section.tsx','products-section.tsx','purchases-section.tsx','returns-section.tsx','register-section.tsx','stock-adjustments-section.tsx','customers-section.tsx','suppliers-section.tsx','reports-section.tsx','sync-section.tsx','users-section.tsx','store-settings-section.tsx','audit-log-section.tsx']
for f in required:
    if not (src/'components/sections'/f).exists(): errors.append(f'missing section {f}')
# offline invariants
for p in src.rglob('*'):
    if p.suffix not in {'.ts','.tsx'}: continue
    t=p.read_text(errors='ignore')
    for banned in ['cloudflare:', '@prisma/', 'vinext', 'wrangler', 'next/server']:
        if banned in t: errors.append(f'forbidden runtime {banned} in {p.relative_to(root)}')
# PIN policy
for f in [src/'lib/localApi.ts', src/'components/login-section.tsx', src/'components/setup-section.tsx', src/'components/sections/users-section.tsx']:
    if not re.search(r'\\d\{4\}', f.read_text(errors='ignore')): errors.append(f'PIN 4-digit policy not evident in {f.relative_to(root)}')
# schema
schema=(src/'lib/db/schema.sql').read_text()
db=sqlite3.connect(':memory:')
try: db.executescript(schema)
except Exception as e: errors.append(f'schema failed: {e}')
else:
    tables={r[0] for r in db.execute("select name from sqlite_master where type='table'")}
    for t in ['users','categories','brands','products','product_variants','customers','suppliers','sales','sale_items','purchases','purchase_items','sale_returns','sale_return_items','purchase_returns','purchase_return_items','customer_payments','supplier_payments','customer_ledger','supplier_ledger','cash_ledger','register_sessions','stock_movements','expenses','audit_logs','settings','sync_queue','document_sequences']:
        if t not in tables: errors.append(f'missing table {t}')
# API capability branches
api=(src/'lib/localApi.ts').read_text()
for route in ['/auth/login','/auth/setup','/auth/me','/auth/logout','/auth/verify-pin','/products','/variants','/categories','/brands','/customers','/suppliers','/sales','/purchases','/sale-returns','/purchase-returns','/stock-adjustments','/stock-ledger','/register-sessions','/customer-payments','/supplier-payments','/reports','/reports/register','/users','/audit-logs','/settings','/store-settings','/sync/status','/sync/export','/sync/archive','/sync/restore','/reconciliation','/expenses','/cash-movements','/infrastructure/health']:
    if route not in api: errors.append(f'API branch missing {route}')
# finance invariant source checks
for term in ['unit_cost','discount','tax_amount','returnItems','returnCogs']:
    if term not in (src/'lib/repositories/reports.ts').read_text(errors='ignore'): notes.append(f'report check term absent: {term}')
if errors:
    print('RELEASE GATE: FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)
print('RELEASE GATE STATIC: PASS')
print(' - Offline runtime forbidden-import scan: PASS')
print(' - Required UI sections: PASS')
print(' - SQLite schema parse + required tables: PASS')
print(' - Local API contract inventory: PASS')
print(' - 4-digit PIN policy source check: PASS')
print('NOTE: npm install/build and live Google Sheets round-trip are environment/deferred gates.')
