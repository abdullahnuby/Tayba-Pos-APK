# Tayba POS — Multi-Agent Execution System

## 0) المدير الرئيسي — TAYBA RELEASE DIRECTOR

هذا هو صاحب قرار المرحلة بالكامل.

### مسؤولياته
- يحدد نطاق المرحلة ويمنع Scope Creep.
- يوزع المهام على قادة المراحل والـWorkers.
- يراجع الـdiff النهائي وليس النتيجة الوظيفية فقط.
- يمنع انتقال مرحلة إلى التالية بدون Gate واضح.
- يشغّل Build + Regression + Acceptance قبل الإغلاق.
- يسجل blockers ويمنع تجاوزها بعبارة "نكمّل وبعدها نصلح".

### قاعدة الإغلاق
المرحلة لا تُعتبر مغلقة إلا عندما:
1. كل Worker سلّم نتيجة قابلة للمراجعة.
2. قائد المرحلة راجع التكامل بين النتائج.
3. Build / typecheck / tests المطلوبة نجحت.
4. المدير الرئيسي وقّع Gate.
5. تم تحديث changelog ونسخة الخطة.

---

# PHASE 1 — DATA PORTABILITY & LOCAL RECOVERY

## Phase Manager: Data Reliability Manager

### Agent 1.1 — Excel Import Worker
- Template
- Column mapping
- Validation
- Duplicate strategy
- Preview
- Transactional commit
- Error report

### Agent 1.2 — Excel Export Worker
- Product export
- Business report export
- UTF-8 / Arabic support
- Stable column names
- Export QA

### Agent 1.3 — Backup Worker
- Manual backup
- Automatic daily desktop backup
- Retention policy
- Backup listing
- Safe naming
- Folder access

### Agent 1.4 — Restore & Recovery Worker
- SQLite header validation
- integrity check
- schema compatibility
- safety copy before restore
- failed restore recovery
- corrupted file handling

### Agent 1.5 — Data Migration Worker
- schema version contract
- migration idempotency
- upgrade preservation
- legacy database repair

### Gate 1 — Data Ready
- Excel Import/Export يعملان من الـUI.
- Backup/Restore لا يفقدان البيانات.
- Windows automatic backup ينشئ نسخة يومية ويحتفظ بآخر 7.
- Restore يرفض الملفات التالفة قبل الاستبدال.
- لا توجد عملية data-loss blocker مفتوحة.

---

# PHASE 2 — COMMERCIAL LICENSING

## Phase Manager: Licensing Manager

### Agent 2.1 — Trial Worker
- 30-day trial
- start/end state
- countdown
- expired read-only behavior

### Agent 2.2 — License Crypto Worker
- signed license payload
- public-key verification
- no private secret in renderer/app source
- tamper/error states

### Agent 2.3 — Device Worker
- installation identity
- device binding
- reactivation
- transfer workflow

### Agent 2.4 — Seller Console Worker
- key generation
- customer/license records
- lifetime license issuance
- suspend/revoke primitives

### Agent 2.5 — License QA Worker
- reinstall
- clock changes
- expired trial
- invalid key
- wrong device
- offline grace

### Gate 2 — Commercial Licensing Ready
- لا توجد credentials ثابتة داخل التطبيق.
- Trial يبدأ للمستخدم نفسه بدون تفعيل يدوي.
- Lifetime activation يعمل بكود موقع.
- حالات الترخيص محددة ومختبرة.

---

# PHASE 3 — DESKTOP DISTRIBUTION

## Phase Manager: Desktop Release Manager

### Agent 3.1 — Electron Security Worker
- context isolation
- nodeIntegration off
- IPC validation
- navigation restrictions
- external URL policy
- production DevTools check

### Agent 3.2 — Installer Worker
- NSIS branding
- publisher metadata
- upgrade behavior
- uninstall behavior
- data preservation

### Agent 3.3 — Migration/Upgrade Worker
- old version → new version
- schema migration
- safety snapshot before migration
- rollback strategy

### Agent 3.4 — Update Worker
- current version
- update check
- release endpoint contract
- download/install strategy

### Gate 3 — Distribution Ready
- Installer production build ناجح.
- Upgrade فوق نسخة فيها بيانات لا يمس البيانات.
- DevTools لا تظهر في production.
- update check مفهوم ويمكن تعطيله بأمان.

---

# PHASE 4 — POS PRODUCT POLISH

## Phase Manager: Product UX Manager

### Agent 4.1 — Onboarding Worker
- store profile
- admin setup
- currency/tax
- printer setup
- product import

### Agent 4.2 — Cashier UX Worker
- quantity flow
- unit selection
- price lock
- manager override
- keyboard/touch/mouse

### Agent 4.3 — Inventory UX Worker
- barcode workflow
- SKU generation
- bulk edit
- low stock
- dead stock

### Agent 4.4 — Reporting Worker
- commercial KPIs
- report exports
- print/PDF entry points

### Agent 4.5 — Printing Worker
- 58/80mm
- A4
- barcode labels
- test print

### Gate 4 — Product Ready
- السيناريوهات اليومية واضحة وسريعة.
- لا يوجد price-edit bypass للكاشير.
- الطباعة والباركود قابلة للاختبار الحقيقي.

---

# PHASE 5 — QA & RELIABILITY

## Phase Manager: QA Release Manager

### Agent 5.1 — Business Scenario Worker
- sales
- purchases
- returns
- partial returns
- expenses
- shifts
- customer/supplier balances

### Agent 5.2 — Financial Invariants Worker
- totals
- discount/tax
- weighted cost
- drawer reconciliation
- credit/collection

### Agent 5.3 — Data Stress Worker
- 1k products
- 5k variants
- 50k sales
- 100k sale items

### Agent 5.4 — Crash/Recovery Worker
- restart during transaction
- interrupted restore
- bad backup
- power-loss simulation

### Agent 5.5 — Windows Hardware Worker
- Windows 10
- Windows 11
- Arabic Windows user/path
- thermal printers
- A4 printer
- barcode scanner

### Gate 5 — Release Candidate
- كل blockers الحرجة مغلقة.
- Regression suite green.
- لا يوجد data-loss أو financial-correctness blocker.

---

# PHASE 6 — COMMERCIAL RELEASE

## Phase Manager: Go-To-Market Manager

### Agent 6.1 — Support Worker
- diagnostics
- support bundle
- safe logs

### Agent 6.2 — Documentation Worker
- setup guide
- backup/restore guide
- trial/license guide
- customer FAQ

### Agent 6.3 — Legal Copy Worker
- Terms
- Privacy
- License Terms
- Trial Terms
- Refund policy

### Agent 6.4 — Release Operations Worker
- release artifact
- checksum
- versioning
- changelog
- rollback artifact

### Gate 6 — Commercial Release
**Tayba POS 1.0 = SELLABLE**

---

# تنفيذنا داخل هذه الجلسة

سيتم التعامل مع الأدوار على شكل orchestration داخل نفس بيئة المشروع:

`TAYBA RELEASE DIRECTOR`
→ `Phase Manager`
→ `Specialist Workers`
→ `QA Worker`
→ `Gate Review`

ولا تنتقل الملفات أو الـfeatures من مرحلة إلى التالية إلا بعد إغلاق الـGate.
