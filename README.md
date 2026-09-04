# Tayba POS — Offline (Phase 1 Foundation)

هذا المشروع **جديد ومستقل تمامًا** عن `abdullahnuby/tayba-pos` المرجعي. الريبو المرجعي لا يتم تعديله. يتم الاستفادة منه كمصدر للـBusiness Model والقواعد فقط.

## المعمارية المعتمدة

UI React → Services → Repositories → SQLite محلي

Google Sheets / Google Apps Script لن تكون قاعدة التشغيل؛ سيتم تركيبها في المرحلة الثانية كـSync/Backup/Reporting layer. وبعد تثبيت الـBusiness Logic سيتم تغليف التطبيق بـCapacitor لإخراج APK.

## ما تم تثبيته في Phase 1

- SQLite schema شامل للبيانات الأساسية: Users, Categories, Brands, Products, Variants, Customers, Suppliers.
- Sales/SaleItems مع تخزين `unit_cost` snapshot لحساب الربح لاحقًا بصورة صحيحة.
- Purchases/PurchaseItems وReturns وCustomer/Supplier Payments.
- Register Sessions والخزنة الأساسية.
- Stock Movements كدفتر حركة مخزون.
- Audit Logs.
- Expenses وSettings.
- Document sequences يومية لمنع تصادم أرقام الفواتير.
- Sync Queue مجهز للمرحلة الثانية.
- Local PIN authentication.
- Atomic sale transaction: sale + items + stock + movement + customer balance + register totals + audit + sync queue في Transaction واحدة.
- منع البيع الآجل بدون عميل، ومنع بيع كمية أكبر من المتاح، ومنع المدفوع الأقل من الإجمالي للبيع غير الآجل.
- Repository مستقل للمخزون حتى لا يصبح تعديل `quantity` مبعثرًا داخل الواجهة.

## ملاحظة قاعدة البيانات الحالية

النسخة الحالية تستخدم `sql.js` + IndexedDB لأغراض التطوير/إثبات الـMVP. هذا ليس بديل الإنتاج النهائي على Android. في Phase 3 سيتم استبدال طبقة التخزين بـ`@capacitor-community/sqlite` مع الحفاظ على عقود الـRepository/Service.

## التشغيل

```bash
npm install
npm run dev
```

## مراحل التنفيذ التالية

1. استكمال Repositories/Services للمشتريات والمرتجعات والمدفوعات والتقارير.
2. تنفيذ Sync Queue + Google Apps Script + Google Sheets بعقود Idempotent.
3. Capacitor + Android + SQLite فعلي على الجهاز.
4. Barcode / Printer / Cash Drawer.
5. Redesign POS UI + E2E QA + Production APK.


## Phase 2 — Business Services + Sync Queue

This ZIP is a new independent project. The legacy repository `abdullahnuby/tayba-pos` is reference-only and is not modified by this project.

Implemented in this phase:
- Atomic sales service with stock movement, customer credit, register totals, audit and sync payload.
- Atomic purchases with stock update, supplier payable balance and supplier payment record.
- Atomic sale/purchase returns with over-return protection and stock reversal.
- Customer and supplier payment ledgers.
- Local reporting queries for dashboard, sales by period and stock valuation.
- Durable `sync_queue` with pending/processing/failed/synced states, retry count and stale-processing recovery.
- Google Apps Script gateway skeleton with operation UUID idempotency through `SyncLog`.
- Automatic sync attempt on application start, browser `online` event and every 30 seconds.

## Google Apps Script

See `scripts/google-apps-script/SETUP.md`. The tablet remains operational when offline; Google Sheets is a sync/backup/reporting layer, not the POS runtime database.

## Verification

The SQLite schema was executed in an in-memory SQLite smoke test and passed creation plus basic foreign-key/stock/sale/sync inserts. Full Vite build requires `npm install`; package installation could not be completed in the current execution environment.


## Latest UI audit

تمت مراجعة أنماط الحقول الرقمية في جميع الشاشات، وإزالة التكرار الناتج عن عرض Label خارجي بالإضافة إلى Label الداخلي في NumericField، خصوصًا شاشة المنتجات التي ظهر فيها التكرار في لقطة التابلت.
