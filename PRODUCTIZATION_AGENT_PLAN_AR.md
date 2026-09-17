# Tayba POS — Productization Multi-Agent Plan

## المدير الرئيسي — Release/Product Manager

المسؤول عن قبول أو رفض أي مرحلة قبل الانتقال للمرحلة التالية، ومنع إضافة Features خارج النطاق.

### Agent 01 — Data & Excel Lead
- Product Excel import
- Product Excel export
- Template + validation + preview
- Duplicate strategy
- Import rollback / transaction safety
- Data portability QA

### Agent 02 — Local Data & Recovery Lead
- SQLite runtime contract
- Backup / restore
- Automatic backup policy
- Recovery after crash / failed restore
- Database migrations
- Data integrity checks

### Agent 03 — Licensing & Trial Lead
- 30-day trial
- Lifetime license
- Device binding
- License states
- Trial expiry behavior
- Seller-side key generation
- Anti-tamper hardening

### Agent 04 — Desktop Release Lead
- Electron hardening
- Installer
- Upgrade preservation
- Versioning
- Update mechanism
- Windows 10/11 acceptance

### Agent 05 — POS/UX Product Lead
- Onboarding
- Product management UX
- Cashier UX
- Printer / barcode workflows
- Settings / About / support UI

### Agent 06 — QA & Reliability Lead
- Business scenario matrix
- Regression tests
- Backup/restore tests
- Licensing tests
- Large-data tests
- Crash/power-loss tests
- Release gate

### Agent 07 — Support & Commercialization Lead
- Diagnostics
- Support bundle
- Terms / privacy / license text
- Customer-facing documentation
- Trial-to-purchase journey

## Phase gates

### Gate 1 — Data portability
Excel import/export + clean local-data page + backup/restore.

### Gate 2 — Commercial licensing
Trial + lifetime activation + device identity + seller key workflow.

### Gate 3 — Distribution
Installer + upgrade-safe migrations + error handling + diagnostics + update check.

### Gate 4 — Production QA
Windows, printer, scanner, data volume, crash/recovery, financial invariants.

### Gate 5 — Commercial release
Only after all blockers are closed.

## Current sprint started

- [x] Replace owner-password activation with trial/lifetime licensing foundation.
- [x] Add signed lifetime license verification using public key only in the app.
- [x] Add seller-side license key generator that reads private key from environment.
- [x] Add 30-day local trial UX.
- [x] Add Product Excel template/import/export.
- [x] Simplify data/sync page to SQLite + backup/restore + Excel + diagnostics.
- [x] Disable new Google sync queue writes for SQLite-only V1.
- [x] Native desktop automatic backup to filesystem + retention (7 backups).
- [ ] Production update service.
- [ ] Full automated release QA.


## Gate 1 execution note — 2026-09-14

تم إغلاق جزء النسخ المحلي في Gate 1: Electron يوفّر مجلد backups داخل userData، والواجهة تعرض التاريخ والحجم وتتيح فتح المجلد وحذف النسخ. يتم إنشاء نسخة تلقائية يوميًا في نسخة Windows مع الاحتفاظ بآخر 7 نسخ.

Build verification كان محجوبًا في بيئة العمل الحالية لأن `node_modules` الموجودة في النسخة المرفوعة غير مكتملة، و`npm ci --offline` توقف عند dependency غير موجودة في الكاش (`zwitch`). تم التحقق من سلامة ملفات Electron عبر `node --check`.
