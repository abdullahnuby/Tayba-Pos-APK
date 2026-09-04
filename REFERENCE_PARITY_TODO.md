# Tayba POS — Reference Parity Master TODO

## Reference / Project contract

- [x] Golden Reference: `abdullahnuby/tayba-pos` — READ ONLY; never modify it.
- [x] New runtime: React/Vite + browser SQLite (`sql.js`) + IndexedDB persistence.
- [x] Local API compatibility layer preserves the reference `/api/*` contract where applicable.
- [x] Offline operation is authoritative; Google Sheets is a deferred sync/backup layer, not the operating database.
- [x] Android/Capacitor is intentionally deferred until this parity scope is accepted.

## 0) Architecture

- [x] UI → Service → Repository → SQLite separation.
- [x] Atomic transaction wrapper for business mutations.
- [x] UUIDs for business entities and idempotency keys.
- [x] Local Sync Queue with pending/processing/failed/synced states.
- [x] Retry backoff and stale-processing recovery.
- [x] Local archive + restore.
- [x] No Cloudflare/D1/KV/Supabase/Firebase/Prisma/Vinext runtime dependency.

## 1) Offline Authentication / Authorization

- [x] Username + exactly 4-digit PIN only.
- [x] No online authentication requirement.
- [x] Local session stored on-device.
- [x] PIN hashed with per-user salt.
- [x] PIN-only setup flow.
- [x] PIN-only user creation/edit.
- [x] Local sensitive-operation rate limiting.
- [x] Admin / Manager / Cashier roles.
- [x] Manager PIN approval for cashier price override.
- [x] Cashier denied from admin-only functions.
- [x] Cashier restricted to own invoice details.
- [x] Legacy password columns retained only for migration compatibility; never read by authentication.

## 2) API / Reference Parity

### Auth
- [x] `/auth/login`
- [x] `/auth/logout`
- [x] `/auth/me`
- [x] `/auth/setup`
- [x] `/auth/verify-pin` — offline replacement for reference password verification.
- [x] Reference password-change/password-verify routes intentionally removed from the offline contract.

### Catalog / Master Data
- [x] `/categories` GET/POST.
- [x] `/categories/[id]` GET/PATCH/DELETE behavior.
- [x] `/brands` GET/POST.
- [x] `/brands/[id]` PATCH/DELETE behavior.
- [x] `/products` GET/POST with search/category/pagination.
- [x] `/products/[id]` GET/PATCH/DELETE with historical-movement protection.
- [x] `/variants` lookup + validation.
- [x] SKU duplicate protection.
- [x] Barcode duplicate protection.
- [x] Variant history cannot be deleted when referenced by sales/purchases/stock movements.

### Customers / Suppliers
- [x] `/customers` GET/POST.
- [x] `/customers/[id]` GET/PATCH/DELETE.
- [x] Customer ledger.
- [x] Customer payment endpoint + idempotency.
- [x] `/suppliers` GET/POST.
- [x] `/suppliers/[id]` GET/PATCH/DELETE.
- [x] Supplier ledger.
- [x] Supplier payment endpoint + idempotency.

### Sales / POS
- [x] `/sales` GET/POST.
- [x] `/sales/[id]` GET.
- [x] Sale `void`.
- [x] Sale `resume`.
- [x] Sale idempotency via payload or `Idempotency-Key` header.
- [x] Cash / card / transfer / credit.
- [x] Partial cash with receivable customer balance.
- [x] Credit sale requires customer.
- [x] Overpayment change.
- [x] Cash ledger records retained cash, not tendered amount.
- [x] Historical sale date for permitted roles.
- [x] Manager price override with local PIN approval.
- [x] Hold/resume draft sale workflow.
- [x] Invoice detail/history.
- [x] Printable/shareable receipt surface.

### Purchases
- [x] `/purchases` GET/POST.
- [x] `/purchases/[id]` GET/PATCH.
- [x] Purchase void.
- [x] Purchase cash payment requires an open register.
- [x] Cash/card/transfer/credit payment method validation.
- [x] Supplier balance / payment ledger effects.
- [x] Weighted-average cost update.
- [x] Historical purchase cost retained in purchase items.

### Returns
- [x] Sale returns GET/POST.
- [x] Purchase returns GET/POST.
- [x] Sale return variant mismatch guard.
- [x] Sale return quantity overrun guard.
- [x] Purchase return quantity overrun guard.
- [x] Sale return methods: cash/card/credit.
- [x] Purchase return methods: cash/card/transfer/credit.
- [x] Cash return requires open register.
- [x] Return idempotency header/payload support.
- [x] Historical cost preserved for COGS reversal.

### Inventory / Register / Finance
- [x] `/stock-adjustments` GET/POST.
- [x] `/stock-ledger` with filtering/date/limit.
- [x] Negative-stock prevention.
- [x] `OPENING_STOCK`, `SALE`, `PURCHASE`, `SALE_RETURN`, `PURCHASE_RETURN`, `ADJUSTMENT` movement types.
- [x] `/register-sessions` GET/POST/PATCH.
- [x] Open/close shift with 4-digit PIN verification.
- [x] Expected-vs-actual cash reconciliation.
- [x] Cash movements: deposit/withdrawal.
- [x] Expenses linked to shift.
- [x] Customer/supplier payments linked to cash ledger when cash.
- [x] Cashier ownership enforcement for shifts.

### Reports / Management
- [x] `/dashboard/stats`.
- [x] `/reports`.
- [x] `/reports/register`.
- [x] Real COGS from historical sale-item cost.
- [x] Invoice discount allocation.
- [x] Returns impact on revenue/COGS/profit.
- [x] VAT excluded from management profit metrics.
- [x] Inventory valuation / retail value / potential profit.
- [x] Best-selling products.
- [x] Sales trends.
- [x] CSV/XLSX export.
- [x] Print-friendly reporting.

### Administration / Technical
- [x] `/users` and `/users/[id]` admin-only.
- [x] `/settings` / `/store-settings` admin/manager guarded.
- [x] `/audit-logs` admin-only.
- [x] `/infrastructure/health` admin/manager.
- [x] `/capabilities` local-runtime capabilities.
- [x] Local reconciliation endpoint.
- [x] Backup/download endpoint.
- [x] Restore endpoint.
- [x] Local sync status/retry/archive/export endpoints.
- [x] Reference-only diagnostic/deployment endpoints are intentionally not reproduced in the offline runtime.

## 3) Business Rules / Accounting

- [x] Sale is one atomic transaction.
- [x] Purchase is one atomic transaction.
- [x] Sale return is one atomic transaction.
- [x] Purchase return is one atomic transaction.
- [x] Customer balance uses debit/credit ledger.
- [x] Supplier balance uses credit/debit ledger.
- [x] Cash uses dedicated cash ledger.
- [x] Purchase cash is cash-out; supplier payment cash is cash-out.
- [x] Sale cash/customer collection is cash-in.
- [x] Cash refunds are cash-out.
- [x] Purchase-return cash from supplier is cash-in.
- [x] Expenses reduce expected register cash.
- [x] Void sale reverses stock and financial effects.
- [x] Void purchase reverses stock and payable/cash effects.
- [x] Resume draft rechecks stock before completion.
- [x] Resume draft applies receivable/cash effects consistently with the saved payment state.
- [x] Double-submit guarded by idempotency.
- [x] Atomic rollback on transaction failure.

## 4) UI / UX Reference Parity

- [x] RTL Arabic shell.
- [x] Dashboard parity.
- [x] POS parity baseline.
- [x] Products parity baseline.
- [x] Purchases parity baseline.
- [x] Returns parity baseline.
- [x] Customers parity baseline.
- [x] Suppliers parity baseline.
- [x] Register parity baseline.
- [x] Stock adjustments parity baseline.
- [x] Reports parity baseline.
- [x] Sync/admin surfaces.
- [x] Users administration.
- [x] Store settings.
- [x] Audit log.
- [x] Mobile-first POS touch targets.
- [x] Search / barcode workflow.
- [x] Variant / size / color workflow.
- [x] Pack pricing: piece / quarter-dozen / half-dozen / dozen.
- [x] Customer selection and quick-add.
- [x] Payment dialog with live change/remaining.
- [x] Manager override dialog.
- [x] Hold/resume invoice UI.
- [x] Invoice history/detail.
- [x] Receipt print/share surface.
- [x] Shift cash movement UI.
- [x] Online/offline indicator.
- [x] Loading/error/empty states on primary flows.
- [x] Theme support.
- [x] Favicon SVG/ICO and fixed sql.js browser asset loading.

## 5) SQLite / Data Integrity

- [x] 28-table current schema.
- [x] Foreign keys and indexes.
- [x] Customer/Supplier/Cash ledgers.
- [x] Stock movements.
- [x] Register sessions.
- [x] Expenses.
- [x] Document sequences.
- [x] Sync queue.
- [x] Startup migrations.
- [x] Local archive/restore validation.
- [x] Historical-reference deletion protection.
- [x] Business invariants script PASS.

## 6) Sync / Backup — Google excluded by user request

- [x] Queue persistence.
- [x] Mapper coverage for local entities.
- [x] Retry/backoff.
- [x] Stale-processing recovery.
- [x] Local failure/dead-letter visibility.
- [x] Local archive/restore.
- [x] Local backup download.
- [x] Local reconciliation.
- [x] Sync counters/status.
- [~] Google Sheets upload/restore round-trip — intentionally deferred.
- [~] Daily Google backup — intentionally deferred.
- [~] Live Google verification — intentionally deferred.

## 7) Security

- [x] Offline PIN-only authentication.
- [x] 4-digit PIN validation everywhere sensitive.
- [x] Rate limiting for local sensitive actions.
- [x] Role checks inside Local API, not only UI.
- [x] Manager approval validated against local user record.
- [x] No required production secrets for local operation.
- [x] Audit log for state-changing business operations.
- [x] Cashier ownership enforcement.
- [x] Historical business records protected from destructive deletion.

## 8) QA / Verification

- [x] TypeScript syntax parse across all TS/TSX source files.
- [x] SQLite schema parse.
- [x] Required-table checks.
- [x] Required-section checks.
- [x] Forbidden-runtime import scan.
- [x] Local API contract inventory.
- [x] PIN-only policy scan.
- [x] Business invariants test PASS.
- [x] Static release gate PASS.
- [x] Reference API inventory reviewed against local compatibility layer.
- [~] `npm install` — environment registry installation timed out.
- [~] Full `tsc -b` with installed dependencies — blocked by missing installed dependency tree.
- [~] `vite build` — blocked by missing installed dependency tree.
- [~] Browser E2E / tablet execution — requires installed dependency tree + browser runtime.
- [~] Crash/chaos/concurrency live execution — requires runtime execution.

## 9) Explicitly Deferred

- [~] Google Sheets production sync / import / restore / live verification.
- [~] Capacitor packaging.
- [~] Android APK / permissions / Bluetooth / USB printer / camera integration.

## 10) Release Decision for This Scope

- [x] All implementation TODO items outside Google Sheets and Android are closed at source/static-test level.
- [x] New project only; reference repository remains untouched.
- [x] Release-gate scripts PASS.
- [~] Production sign-off remains blocked by executable dependency installation and live E2E verification only.

## Execution policy

Every implementation response must:
1. Modify only the new project.
2. Update this TODO.
3. Run available static/schema/business checks.
4. Produce a new ZIP.
5. Never modify the Golden Reference.
## 11) Tablet Full-Touch Hardening — Current Pass

- [x] Global coarse-pointer touch contract: interactive controls target at least 48px where practical.
- [x] `touch-action: manipulation` and tap feedback for buttons/inputs.
- [x] Visible focus ring that works with hardware and touch-assisted navigation.
- [x] Safe-area aware fixed bottom navigation for mobile/tablet.
- [x] Thumb-friendly 5-item quick navigation on coarse touch devices.
- [x] Increased touch targets for compact icon controls on coarse pointers.
- [x] Added touch scroll behavior and overscroll containment helpers.
- [x] Removed reliance on hover for any primary interaction path.
- [x] Offline login now includes an on-screen 4-digit PIN keypad, so login does not require the tablet keyboard.
- [x] POS already keeps barcode/search/payment actions touch accessible; this pass hardens the rest of the shell globally.
- [~] Final physical-tablet acceptance test remains pending until dependencies are installed and the app is run on the target tablet.

### Current UI release target

The tablet is the primary device. Desktop layout remains supported, but all primary workflows must be operable by touch alone on a coarse-pointer tablet without requiring hover, mouse precision, or a physical keyboard.



## TABLET TOUCH INPUT PASS
- [x] Numeric Pad داخلي لكل الإدخالات الرقمية.

## 2026-09-04 Hotfix — Date Resilience
- [x] `formatDate` / `formatDateTime` now tolerate missing/null/invalid dates without crashing the app.
- [x] Local `/sales` responses normalize `date`/`createdAt` and customer/user display objects.
- [x] Local `/register-sessions` responses normalize `openedAt`/`closedAt` and user display objects.
- [x] Dashboard recent-sales dates normalized before rendering.
- [x] Date-resilience static test PASS.

## Current Runtime Gate
- [x] Static release gate PASS after date hotfix.
- [~] Full `npm install` + `vite build`: environment-dependent because registry install may time out.
- [~] Live browser/tablet E2E: must be run on the deployment/device before production use.


## 2026-09-04 — Product Identification + Electronic Receipt

- [x] Automatic store-owned SKU generation when SKU is omitted; SKU is unique and human-readable.
- [x] Automatic EAN-13-shaped internal barcode generation when barcode is omitted.
- [x] Barcode generation uses a persisted global sequence and GS1 check digit calculation.
- [x] Optional GS1 Company Prefix setting added for stores that already own an official GS1 prefix; generated GTIN-13 uses that prefix.
- [x] Explicitly documented that an invented EAN-13 number without a licensed GS1 prefix is not a globally licensed GTIN.
- [x] Electronic receipt text includes invoice number, date, line items, totals, paid amount, change, and customer.
- [x] WhatsApp receipt action opens the customer's WhatsApp chat with a pre-filled receipt message using WhatsApp click-to-chat.
- [x] Egyptian mobile numbers are normalized to international format before creating the WhatsApp link.
- [~] Direct automatic document/PDF attachment to WhatsApp remains an Android/native sharing enhancement; current web flow sends a pre-filled electronic receipt message.


## PATCH — Numeric Input + Sales Crash Hotfix (2026-09-04)
- [x] إزالة جميع `<input type=\"number\">` من واجهات التطبيق.
- [x] كل الإدخالات الرقمية تستخدم Numeric Pad الداخلي.
- [x] POS discount/payment uses Numeric Pad.
- [x] Returns quantities use Numeric Pad.
- [x] Stocktake quantities use Numeric Pad.
- [x] Register cash amounts use Numeric Pad.
- [x] Supplier payment uses Numeric Pad.
- [x] VAT/loyalty numeric settings use Numeric Pad.
- [x] Setup VAT uses Numeric Pad.
- [x] Sales receipt/detail rendering hardened against missing `items`.
- [x] Variant picker hardened against missing `variants`.
- [x] Date formatter remains resilient to missing/invalid values.
- [x] Static gate: PASS.
- [x] Date resilience test: PASS.
- [x] Identifier check-digit test: PASS.
- [x] Business invariants: PASS.

### Current release status
- Google Sheets: DEFERRED by project decision.
- Android/Capacitor: DEFERRED until pilot readiness.
- Remaining blocking work before real tablet pilot: dependency install/build gate on target environment + live tablet E2E/hardware validation.
## Tablet UI Copy / Duplication Audit — 2026-09-04

- [x] Removed duplicate labels around the Products numeric fields; `NumericField` now owns its label and its wrapper no longer renders the same label twice.
- [x] Applied the fix to cost price, sell price, purchase/sale conversion factors, pack prices, opening/current stock, minimum stock alert, and reorder quantity.
- [x] Repository-wide source scan confirms no remaining `Label + NumericField` double-label pattern.
- [x] No raw `<input type="number">` remains in `src/components`.
- [ ] Browser visual pass on every screen remains a manual tablet QA gate; source audit cannot replace real-device rendering.


## 2026-09-04 — Multi-item POS payment crash hotfix
- [x] إصلاح رفض دفع فاتورة متعددة الأصناف بسبب floating-point precision.
- [x] توحيد rounding للعملات إلى منزلتين في SalesService والـPOS.
- [x] إضافة tolerance محاسبي 0.01 عند مقارنة المدفوع بالإجمالي.
- [x] اختبار فاتورة 45 + 75 = 120 مع مدفوع 120: PASS.
- [x] منع انهيار POS عند نقص بيانات items/date: PASS من الإصلاحات السابقة.

## Checkpoint 2026-09-04 — Multi-item payment + Numeric Pad stability
- [x] Replace floating-point payment comparison with integer cents in POS/service.
- [x] Multi-item exact-total test path hardened (e.g. 45 + 75 = 120, paid 120).
- [x] Numeric Pad first-key replacement behavior (no accidental append to prior value).
- [x] Numeric Pad Escape/Enter/backspace handling.
- [x] Numeric Pad remains touch-first and does not use system numeric keyboard.
- [x] Date/receipt rendering resilience remains enabled.
- [ ] Browser E2E on actual tablet hardware — pending pilot device validation.

## Checkpoint 2026-09-04 — Same-variant pack pricing regression
- [x] Fix sale-line merge key to preserve different pack/unit prices for the same variant.
- [x] Add regression test: same variant at 45/quarter-dozen + 75/half-dozen totals to 120 without backend mismatch.
- [x] Payment comparison remains integer-cents based.

### Purchase crash hotfix

- [x] Purchase API list/detail parity fixed: always returns `items[]`, nested `supplier`, nested Variant/Product data, and normalized dates.
- [x] Purchases UI hardened against missing/null legacy `items` arrays; invoice cards/details no longer crash on `.length`/`.map`.
- [x] Regression guard recorded for malformed/legacy purchase rows with missing items.


## 2026-09-04 — Repository-wide Defensive Rendering Audit
- [x] Audited all primary section pages for unsafe `.map/.length/.some/.find/.flatMap` assumptions.
- [x] Dashboard arrays normalized before rendering (`recentSales`, `reorderList`, `topProducts`, `salesTrend`) and payment-method defaults hardened.
- [x] Products variants normalized before search/reduce/map/length usage.
- [x] Purchases products/suppliers/purchase line arrays normalized; supplier names guarded before string operations.
- [x] Returns sale/return item arrays normalized before rendering.
- [x] Sales products/customers/sales arrays normalized, including nested `variants/items`.
- [x] Register session user display guarded against missing nested user data.
- [x] Sync preview rows/headers and sync result `errors/synced` arrays normalized.
- [x] Users/Customers/Suppliers tolerate either array or `{items: []}` API envelopes.
- [x] Stock-adjustment nested variant arrays normalized.
- [x] Store Settings state hydration moved out of render into `useEffect`.
- [x] Added global AppErrorBoundary so a malformed legacy record cannot blank the entire app.
- [x] Removed remaining system numeric-keyboard PIN inputs from Setup, Register, Users, and Manager Override; all use the internal 4-digit Numeric Pad.
- [x] Added `test-page-data-shapes.mjs`: page-data-shape-regression PASS.
- [x] No raw `<input type=\"number\">` or `inputMode=\"numeric\"` remains in source components.
- [~] Real browser/device visual and E2E validation remains a manual gate.


## 2026-09-04 — Full Page Resilience Audit
- [x] Reviewed all primary pages/components for malformed API payloads causing `.map/.length/.some/.find/.flatMap` crashes.
- [x] Added defensive array normalization for Dashboard, Products, Purchases, Returns, Sales, Register, Stock Adjustments, Customers, Suppliers, Users, Reports, Sync, and Audit pages.
- [x] Added guarded nested `items/variants/user/supplier/customer` rendering where legacy/local records may omit relations.
- [x] Removed remaining system numeric-keyboard hints from login; PIN continues through the internal keypad.
- [x] Moved Sync/Settings hydration state changes out of render-time code.
- [x] Added global AppErrorBoundary around the authenticated application shell.
- [x] Added malformed page-data regression coverage: PASS.
- [~] Live browser navigation through every page on the target tablet is still required before production sign-off.

## 2026-09-04 — Cashier Tablet Zero-Scroll UX checkpoint
- [x] Cashier shell locks to `100dvh` and hides desktop shell chrome.
- [x] POS page/panes use `overflow:hidden`; sale surface no longer depends on scrolling.
- [x] POS product catalog is paged (12 products) rather than vertically scrolled.
- [x] Cashier category selector is compact and does not horizontally scroll.
- [x] Product cards, search bar and cart controls compacted for viewport fit.
- [x] Cashier POS body uses a fixed two-pane tablet layout; portrait fallback splits product/cart vertically.
- [ ] Final hardware visual QA on target tablet resolutions remains required before production APK.

## 2026-09-04 — SalesSection Vite 500 hotfix
- [x] Fixed malformed JSX template literal in `src/components/sections/sales-section.tsx` that caused Vite HTTP 500 when importing the component.
- [x] Re-ran TypeScript parse check; no `sales-section.tsx` parse diagnostics remain.
- [x] Verified forbidden runtime imports scan remains clean.
- [ ] Full dependency-backed `vite build` remains environment-gated until `npm install` completes.

## 2026-09-04 — Vite 500 SalesSection hotfix
- [x] Fixed malformed `className` JSX template in `src/components/sections/sales-section.tsx` introduced by the Zero-Scroll patch.
- [x] TypeScript parser no longer reports syntax errors from `sales-section.tsx` (remaining diagnostics are dependency/type-resolution only because node_modules is not installed in this environment).
- [x] Forbidden runtime import scan remains clean.
- [ ] Browser/Vite runtime smoke test remains environment-gated until dependencies are installed.

## 2026-09-04 — Store Settings Vite import hotfix
- [x] Fixed invalid `useEffect` import from `@tanstack/react-query`; React hooks now import from `react`.
- [x] Scanned source for the same cross-package `useEffect` import pattern; no remaining matches found.
- [ ] Full dependency-backed Vite/browser smoke test remains environment-gated until dependencies are installed.

## 2026-09-04 — Purchase pack-cost calculation hotfix
- [x] Corrected purchase subtotal to use entered purchase quantity × purchase-unit cost (not base stock quantity × pack cost).
- [x] Kept stock quantity conversion separate: 20 dozen = 240 pieces.
- [x] Normalized stored purchase-item `unit_cost` to base-piece cost for inventory weighted-average calculations.
- [x] Regression test added: 20 dozen at 7.80 EGP/piece => 93.60 EGP/dozen => invoice total 1,872 EGP.
- [ ] Existing historical invoices already saved with the old wrong total require a separate data-reconciliation/migration decision; this fix applies to new purchases.

## Android / APK Packaging Phase (2026-09-04)
- [x] Prepared Capacitor 8 configuration for the offline POS (`com.tayba.pos`, webDir=`dist`).
- [x] Added repeatable Android preparation/build scripts for Windows/macOS/Linux environments.
- [x] Added Android build/run documentation and release-signing guidance.
- [x] Kept the offline SQLite/sql.js application architecture unchanged; Android is a native WebView shell around the existing local app.
- [ ] Install npm dependencies in a networked development/build environment.
- [ ] Run `npm run android:prepare` to generate the native `android/` project.
- [ ] Build/install the Debug APK on the target tablet and perform hardware smoke tests (touch, keyboard suppression, barcode workflow, WhatsApp share handoff, rotation/back behavior).
- [ ] Configure a private release keystore and produce the signed Release APK after pilot validation.

## 2026-09-04 — APK TypeScript Compile Cleanup
- [x] Added `baseUrl` + `paths` (`@/*` → `src/*`) to `tsconfig.json`; this removes the large cascade of false `Cannot find module '@/...'` diagnostics while keeping the existing Vite alias.
- [x] Fixed `StoreSettings` form state update so boolean switch values are normalized to the string-backed settings schema.
- [x] Removed `any[]` widening in Suppliers data normalization so collection callbacks retain `Supplier` types.
- [x] Added a typed runtime-safe SQLite close helper for the `sql.js` database instance.
- [x] Fixed the binary backup `Response` BodyInit typing.
- [x] Replaced the Expenses session `db.exec(...).values` access with a typed query check.
- [ ] Full dependency-backed `tsc`/Vite/Capacitor build remains pending until `npm install` is available in the local Android build environment.


## 2026-09-04 APK TypeScript cleanup pass 2
- [x] Fixed NumericPad nullable request closure in confirm().
- [x] Fixed CustomersSection implicit-any collection/event typing.
- [x] Fixed ProductsSection safeVariants typo in openEdit().
- [x] Fixed SalesSection customer mutation generic, collection typing, and selectedProduct narrowing.
- [x] Fixed UsersSection collection typing.
- [ ] Re-run npm run build on a machine with dependencies installed; remaining errors, if any, are environment/compiler feedback to address before APK packaging.
## 2026-09-04 — Tailwind v4 build dependency hotfix
- [x] Added `tw-animate-css` `^1.4.0` to `devDependencies`; `src/styles.css` already imports it and the previous build failed because the package was absent from `package.json`.
- [x] Kept the existing `tailwindcss-animate` dependency untouched for legacy compatibility; Tailwind v4 uses the CSS-first `tw-animate-css` package for the current stylesheet import.
- [x] Confirmed the reported build failure is dependency resolution in `@tailwindcss/vite`, not a TypeScript compile error.
- [ ] Re-run `npm install` then `npm run build`; after dependency installation the `Can't resolve 'tw-animate-css'` error should be gone.


## 2026-09-04 — Android Gradle Wrapper fallback
- [x] Updated Android debug build script to use `android/gradlew.bat` when present and fall back to the system Gradle command when the wrapper is missing.
- [x] Added explicit `android:sync`, `android:open`, and `android:apk` npm scripts for the Windows APK workflow.
- [ ] Verify Android SDK/JDK + Gradle availability on the local Windows machine before producing the APK.

## 2026-09-04 — Android Numeric Pad hardening
- [x] Reworked the shared NumericPad state to keep the active request in a ref, avoiding stale/null callback execution during rapid Android touch interactions.
- [x] Added body scroll locking while the numeric keypad is open and safe-area bottom padding for Android gesture/navigation bars.
- [x] Raised keypad overlay z-index and added `touch-action: manipulation` / tap-highlight suppression for WebView touch reliability.
- [x] Replaced the login screen's separate inline PIN keypad with the same centralized NumericPad used by Admin Setup, New User, PIN Change, discounts, amounts, and other numeric fields.
- [x] Added global Android WebView touch/overscroll hardening CSS.
- [ ] Physical Android regression test remains required: Setup PIN, Login PIN, New User PIN, Change PIN, decimal amount entry, backspace, clear, confirm, and reopen-after-close.


## 2026-09-04 — Official Android Release Track
- [x] Bumped application/package version to 1.0.0 for the first official Android release track.
- [x] Added repeatable signed Release APK script with versionCode 1 / versionName 1.0.0.
- [x] Added release keystore creation helper and non-secret `keystore.properties` template.
- [x] Added Windows-friendly official release documentation and future update/versioning rules.
- [ ] User-owned release keystore must be created and backed up before first official APK build.
- [ ] Build and install the signed 1.0.0 Release APK on the target device.
- [ ] Preserve the same signing key for all future APK updates.


## 2026-09-04 — Release keystore command discoverability hotfix
- [x] Confirmed the canonical `scripts/create-release-keystore.ps1` exists in the official release track.
- [x] Added `android:keystore` npm script so keystore creation can be launched without a long PowerShell path.
- [x] Added root-level `create-release-keystore.ps1` convenience wrapper.
- [x] Documented the exact Windows official-release sequence and APK output path.
- [ ] User must run the keystore generator once and securely back up the `.jks` plus passwords.
