# طيبة POS — One Sprint Hardening (v1.0.1)

تم تنفيذ الإصلاحات على طبقة التخزين والمزامنة والصلاحيات دون حذف أي بيانات تجارية موجودة.

## النسخ الاحتياطي
- Android: الحفظ إلى `Documents/TaybaPOS/Backups/` باستخدام Capacitor Filesystem.
- مشاركة النسخة بعد الحفظ عبر النظام إن كانت مدعومة.
- Web/Desktop: اختيار مكان الحفظ عبر File System Access API، مع fallback إلى Downloads.
- فحص `PRAGMA integrity_check` قبل كتابة النسخة.
- لا يتم تخزين نسخة SQLite كاملة في `localStorage`.

## حماية البيانات
- Migrations إضافية غير مدمرة فقط (`ADD COLUMN`/indexes).
- لا يتم حذف أو تحديث سجلات المبيعات والمشتريات والمخزون كجزء من backup.

## Sync
- دعم `cash_movement` في Google Apps Script.
- Stock adjustments تدخل Sync Queue.
- Auto Sync يتم تشغيله من AppShell.
- إضافة Lock إلى Google Apps Script لمعالجة العمليات المتزامنة.

## Accounting
- `customer_payments.register_session_id` يتم حفظه فعليًا.
- Cash refunds تعتمد على cash ledger الخاص بالوردية المنفذة.

## Authorization
- حماية عمليات إنشاء المشتريات.
- حماية دفعات الموردين.
- حماية قراءة بيانات المشتريات ودفعات الموردين.
- Rate limiting لا يعتمد على Device-Key وحده في مسارات المصادقة.

## Performance
- Lazy loading للأقسام الرئيسية.
- قفل تهيئة قاعدة البيانات عند الإقلاع.
- تسلسل معاملات SQLite لتفادي تداخل المعاملات.
- تحسين persistence ليتم عبر queue بدل تكرار عمليات الحفظ المتداخلة.

## Dependency additions
- `@capacitor/filesystem` 8.1.3
- `@capacitor/share` 8.0.1
