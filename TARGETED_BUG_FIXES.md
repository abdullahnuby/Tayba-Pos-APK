# الإصلاحات المستهدفة

## 1. فشل إنشاء الفاتورة للإدارة
- ربط الفاتورة بالوردية الخاصة بالمستخدم بدل اختيار وردية مستخدم آخر.
- إظهار زر فتح الوردية للإدارة والمدير أيضًا.
- إرسال `registerSessionId` صراحةً مع طلب إنشاء الفاتورة.
- تحسين رسالة خطأ API وإضافة logging للخطأ الأصلي.

## 2. تفاصيل الفاتورة عند العرض والطباعة
- توحيد حقول `variantId` و`unitPrice` في استجابة تفاصيل الفاتورة.
- إعادة جميع بنود الفاتورة مع بيانات المنتج والصنف.
- جعل شاشة السجل تجلب تفاصيل الفاتورة قبل العرض بدل الاعتماد على الصف المختصر.

## 3. حفظ النسخ الاحتياطية
- استخدام `showSaveFilePicker` عندما يدعمه المتصفح لفتح نافذة اختيار مكان الحفظ.
- الاحتفاظ بآلية fallback للتنزيل العادي على البيئات التي لا تدعم File System Access API.

## 4. المرتجعات
- إصلاح عقد البيانات بين شاشة المرتجعات وواجهة `/api/sales/:id`.
- إضافة تحقق صريح من رقم الفاتورة والأصناف.
- منع اختيار وردية مستخدم آخر عند رد النقد.
- ضبط طريقة الرد الافتراضية وفق طريقة دفع الفاتورة، والسماح بمرتجع البطاقة دون التأثير على درج النقد.
- إضافة رسائل خطأ API واضحة مع logging.

## التحقق
- اجتازت جميع الملفات المعدلة فحص syntax الخاص بـ TypeScript/TSX.
- تعذر تشغيل `tsc -b` كاملًا لأن `node_modules` غير موجود في الحزمة المرفقة؛ لذلك ظهرت أخطاء modules المفقودة فقط ولم تكن أخطاء syntax في التعديلات الجديدة.

- تمت إضافة تسجيل واضح لأخطاء مسارات الـAPI (`TAYBA_API_ERROR`) مع كود خطأ ثابت للواجهة.


# Targeted Defect Fixes — 2026-09-07

## #6 — Draft → Resume Pricing Policy Bypass — FIXED
### Before
`resumeSale()` كان يقرأ المسودة ويخصم المخزون ويحوّل الحالة إلى `completed` بدون استدعاء `checkLocalSalePrice()`، كما أن جدول `sales` لم يحفظ دور منشئ المسودة أو حالة موافقة المدير.
### After
أضيفت إلى `sales` الحقول:
- `created_role TEXT`
- `manager_approved INTEGER NOT NULL DEFAULT 0`
ويتم حفظهما لحظة إنشاء الفاتورة. عند `resumeSale()` يعاد فحص كل `sale_item.unit_price` باستخدام `checkLocalSalePrice()`، كما يعاد فحص خصم الكاشير بنسبة 5%. يمكن تسجيل موافقة مدير عند الاستئناف بعد تحقق PIN المدير في `localApi.ts`.
### Migration
تم رفع `SCHEMA_VERSION` إلى 6 ثم 7 بسبب إضافة حقل موافقة المرتجع أيضًا. القيم القديمة في `created_role` تظل NULL، ويُعامل الدور غير المعروف عند الاستئناف كـ`cashier` لسياسة محافظة؛ `manager_approved` يبدأ بصفر. لا تُحذف أي بيانات.

## #13 — Stock Reconciliation Double-Count — FIXED
### Before
`stockDiff = quantity - opening - movement_sum` بينما `movement_sum` يتضمن `OPENING_STOCK` بالفعل.
### After
أصبح الحساب `quantity - movement_sum` مع تقريب إلى خانتين. هذا يجعل رصيد افتتاحي Q مع حركة OPENING_STOCK مقدارها Q ينتج `stockDiff = 0`.

## #14 — Product Creation Missing Opening Stock Movement — FIXED
### Before
`POST /products` كان يضع `product_variants.quantity` مباشرة بدون سجل `stock_movements`.
### After
كل Variant بكمية افتتاحية أكبر من صفر يسجل `OPENING_STOCK` داخل نفس transaction مع `reference_type='product_create'` و`reference_id=productId`. أي فشل في الحركة يلغي العملية كاملة.

## #2 — Google Sync Token Timing Comparison — FIXED
### Before
`body.token !== expected`.
### After
أضيفت `safeEqual()` بطول متساوٍ وXOR على كل المحارف، واستُخدمت لمقارنة التوكن.

## #7 — Cash Return Approval Control — FIXED
### Before
`returnSale()` لم يكن يحتوي سقفًا أو تحقق موافقة مدير.
### After
السقف الحالي `RETURN_CASH_LIMIT = 200`. مرتجع نقدي أعلى من السقف بواسطة الكاشير يتطلب `managerApproved` ناتجًا عن تحقق PIN مدير فعلي في `localApi.ts`. تمت إضافة `manager_approved` إلى `sale_returns` مع Migration.

## #11 — Purchase Duplicate-Line Cost Loss — FIXED
### Before
دمج بنود الشراء كان بمفتاح `variantId` فقط، ثم كانت `normalized` تعيد الكتابة بالمفتاح نفسه.
### After
مفتاح الدمج أصبح `variantId + unit + factor + unitCost(cents)`، كما أن `normalized` يستخدم نفس المفتاح المركب؛ لذلك لا تضيع تكلفة/وحدة السطر الثاني.

## #12 — Purchase Float vs Cents — FIXED
### Before
`subtotal += enteredQuantity * unitCost` باستخدام Float.
### After
تمت إضافة `src/lib/money.ts` واستخدام `toCents()/fromCents()` لحساب subtotal/discount/tax/paid/total/item totals.

## #15 — Google Sheets Append → Upsert — FIXED
### Before
`processOperation()` يستخدم `appendObject()` لكل Sale/Purchase/Return، فتظهر الفاتورة نفسها كسطر جديد بعد Void/Resume.
### After
أضيف `upsertObject()` بالمفتاح `id` و`upsertItems()` للبنود، واستبدلت عمليات الكيانات المحددة إلى Upsert بدل Append.

## #16 — Reconciliation Expected Cash Mismatch — FIXED
### Before
`reconciliation.ts` كان يستخدم `cashExpected(db,id)` بدون خصم المصروفات.
### After
يتم جمع مصروفات الوردية واحتساب `ledgerExpected = cashExpected - expenses`، ويُحسب `cashDiff` مقابل هذه القيمة نفسها.

## #3 — IndexedDB Database Encryption — FIXED
### Before
تم حفظ SQLite Blob خامًا داخل IndexedDB.
### After
`db/client.ts` يستخدم AES-GCM 256-bit لتشفير Blob قبل التخزين، مع مفتاح CryptoKey غير قابل للتصدير محفوظ في IndexedDB. قاعدة قديمة غير مشفرة تُقرأ مرة ثم يعاد حفظها مشفرة. النسخة المصدّرة للنسخ الاحتياطي تظل SQLite bytes عادية.

## #4 — Direct PIN Login Rate Limit — FIXED
### Before
`loginWithPin()` لم يكن يستدعي rate limiter وكان منفصلًا عن المسار الحي.
### After
`loginWithPin()` أصبح الدالة المستخدمة فعليًا في `localApi.ts` ويطبق `localRateLimit(login:<username>, 5, 60s)` داخله. واجهة `/auth/login` تتعامل مع تجاوز الحد كـHTTP 429.

## #8 — Unified Register Session Resolution — FIXED
### Before
`voidSale` ومرتجعات البيع/الشراء لا تستخدم ترتيبًا موحدًا لاختيار الوردية.
### After
أضيف `registerSessionResolver.ts` وتستخدم الدوال `resolveTargetSession()`؛ يبدأ الاختيار بالوردية المرجعية المفتوحة ثم آخر وردية مفتوحة. كما أصبحت فواتير الشراء تحفظ `register_session_id` عند إنشائها حتى يمكن تتبع وردية الأصل في المرتجع.

## #9 — Duplicate Dead Authentication Code — FIXED
### Before
`localAuth.ts` كان يحتوي `createUser` و`hasAnyUser` ومنطق Hash/Login غير مستخدم، بينما `localApi.ts` يعيد تنفيذ المصادقة.
### After
`localAuth.ts` أصبح مصدر `loginWithPin()` الفعلي الوحيد لمسار الدخول، وتم حذف الدوال غير المستخدمة منه.

## #10 — Manager PIN Regex — FIXED
### Before
`/\d{4}/` كان يقبل أي نص يحتوي أربعة أرقام متتالية.
### After
تم تثبيت التحقق إلى `/^\d{4}$/`.


## #1 — Google Apps Script Token Fail-Closed — FIXED
### Before
كان فحص التوكن يستخدم `if(expected && !safeEqual(...))`، وبالتالي إذا لم تُضبط `TAYBA_SYNC_TOKEN` أصلًا تصبح `expected` فارغة ويتجاوز الخادم التحقق بالكامل.
### After
أصبح المسار يرفض أي طلب عندما لا يكون `TAYBA_SYNC_TOKEN` مضبوطًا، ثم يجري `safeEqual()` فقط بعد التأكد من وجود التوكن:
`if(!expected)return json({ok:false,error:'الخادم غير مُهيأ: TAYBA_SYNC_TOKEN غير مضبوط'});`
ثم:
`if(!safeEqual(String(body.token||''),String(expected)))return json({ok:false,error:'Unauthorized'});`
وهذا يحول السلوك من Fail-Open إلى Fail-Closed.

## #5 — Sales Section Structural Refactor — FIXED
### Before
`src/components/sections/sales-section.tsx` كان ملفًا واحدًا بحوالي 1666 سطرًا، ويحتوي على حالة شاشة البيع، وتفاصيل/طباعة الفواتير، وسجل الفواتير، وأنواع البيانات كلها في نفس الملف.
### After
تم فصل مسؤوليات الحوارات الخاصة بالفواتير إلى:
`src/components/sections/sales/SalesDialogs.tsx`
وفصل أنواع بيانات شاشة البيع إلى:
`src/components/sections/sales/sales-types.ts`
وأصبح `sales-section.tsx` هو حاوية شاشة البيع، وانخفض حجمه من 1666 إلى 1455 سطرًا، مع الإبقاء على نفس سلوك البيع والطباعة والتاريخ والاستئناف.


## CI Build Fix — 2026-09-07
- `src/lib/db/client.ts`: added an explicit `ArrayBuffer` conversion for AES-GCM IV and payload so modern TypeScript/DOM `BufferSource` types are satisfied without `any` or `@ts-ignore`.
- `src/lib/localApi.ts`: explicitly typed the `ReturnSummary.items` array so `push()` is not inferred as `never[]`.
- These changes were applied to the latest uploaded project snapshot and do not replace the newer business/security fixes already present in that snapshot.


## Regression fix — exported SQLite backup cannot be re-imported

تم إصلاح مسار الاستيراد في `src/lib/db/client.ts` على النسخة الحالية: الاستيراد الآن يتحقق من SQLite magic header، ثم `PRAGMA integrity_check`، ثم الجداول الأساسية و`schema_version`، وبعد نجاح جميع الفحوصات يعيد تصدير قاعدة SQLite السليمة قبل تخزينها مشفرة في IndexedDB. بذلك النسخة التي يخرجها النظام بصيغة `.sqlite` تُستقبل كقاعدة SQLite فعلية، والملفات التالفة/غير المتوافقة تُرفض برسالة محددة قبل استبدال قاعدة الجهاز.
