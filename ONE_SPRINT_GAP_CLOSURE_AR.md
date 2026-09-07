# طيبة POS — إغلاق فجوات السبرنت

تم إغلاق عيوب السبرنت عالية الخطورة في النسخة الحالية:

- Backup SQLite أصلي والتحقق من سلامة الملف قبل إعلان النجاح.
- الحفظ على Android داخل `Documents/TaybaPOS/Backups/` مع التحقق من حجم الملف وURI.
- مشاركة نفس ملف الـSnapshot المحفوظ.
- Backup أمان تلقائي قبل أي Restore.
- Restore يتحقق من SQLite integrity والجداول الأساسية قبل الاستبدال.
- حماية صلاحيات المشتريات ودفعات الموردين وتحويل تحصيل العملاء للمستخدمين المصرح لهم.
- ربط Customer/Supplier payments بالوردية.
- حساب Cash Refund من cash ledger الخاص بالوردية المنفذة.
- مزامنة cash movements وstock adjustments.
- Auto Sync startup.
- Rate limiting على هوية المستخدم الحساسة بدل الاعتماد على Device-Key وحده.
- Lazy loading للأقسام.
- transaction initialization/persistence serialization.
- migrations غير مدمرة فقط.
- إصلاح اختبار pack-total.

## قيود التحقق

تم اجتياز اختبارات Node/Python الساكنة واختبارات business/cashier الموجودة في المستودع. لم يكتمل `npm install` الكامل في بيئة التنفيذ بسبب مهلة الشبكة، لذلك يجب تشغيل `npm ci && npm run check` في بيئة التطوير/CI قبل اعتماد APK إنتاجي.

لا توجد عملية في هذا السبرنت تحذف أو تُعيد تعيين سجلات المبيعات أو المشتريات أو العملاء أو الموردين أو المخزون كجزء من Backup.
