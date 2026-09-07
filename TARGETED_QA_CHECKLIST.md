# QA Verification — Targeted Defects — 2026-09-07

هذا الملف يثبت اختبارات QA المرتبطة فقط بالبنود المطلوبة.

## #6 Draft → Resume Pricing
1. أنشئ Variant بسعر بيع 100.
2. أنشئ Draft بسعر 80 بدور cashier بدون manager approval.
3. استدعِ Resume.
4. النتيجة المتوقعة: رفض الفاتورة برسالة أن السعر خارج حدود الكاشير.
5. أعد Resume مع manager PIN صحيح بعد التحقق في الراوتر.
6. النتيجة المتوقعة: تتحول المسودة إلى completed وتُسجل `manager_approved=1`.

## #13 Stock Reconciliation
1. Variant quantity = 50.
2. أضف حركة OPENING_STOCK = 50.
3. شغّل reconciliation.
4. النتيجة المتوقعة: `stockDiff = 0`.

## #14 Product Opening Stock
1. أنشئ Product بVariant quantity = 20.
2. اقرأ `stock_movements`.
3. النتيجة المتوقعة: سجل واحد `OPENING_STOCK` quantity=20 reference_type=`product_create`.

## #2 Token Timing
1. اختبر توكن صحيح بطول مختلف أو حرف مختلف.
2. النتيجة المتوقعة: `safeEqual()` يعيد false.
3. اختبر نفس النص والطول.
4. النتيجة المتوقعة: `safeEqual()` يعيد true.

## #7 Cash Return Approval
1. أنشئ مرتجعًا نقديًا أعلى من 200 بدور cashier بدون موافقة.
2. النتيجة المتوقعة: رفض بـ`مرتجع نقدي كبير يحتاج موافقة المدير`.
3. أعد الطلب بعد تحقق PIN المدير.
4. النتيجة المتوقعة: إنشاء المرتجع وتسجيل `manager_approved=1`.

## #11 Duplicate Purchase Lines
1. أرسل لنفس Variant سطرًا `piece / factor 1 / cost 10` وسطرًا `dozen / factor 12 / cost 120`.
2. النتيجة المتوقعة: سطران مستقلان في `purchase_items` ولا تضيع تكلفة أي منهما.

## #12 Purchase Money
1. استخدم بنودًا تحتوي 0.10 + 0.20 + 0.30 + 99.99.
2. النتيجة المتوقعة: الحساب الداخلي بالقروش ينتج 100.59 بدون فروق Float غير مرئية.

## #15 Sheets Upsert
1. زامن Sale بالحالة completed.
2. غيّر حالتها إلى voided وزامن العملية الثانية.
3. النتيجة المتوقعة: يبقى صف Sales واحد بنفس `id` ويتم تحديثه بدل إضافة صف ثانٍ.

## #16 Expected Cash
1. افتح وردية.
2. أضف مصروفات 150.
3. اجعل cashExpected قبل المصروفات 1200.
4. النتيجة المتوقعة: reconciliation يعرض 1050، مطابقًا لقيمة إغلاق الوردية.

## #3 Database Encryption
1. أنشئ/عدّل بيانات قاعدة محلية.
2. افحص القيمة المخزنة تحت `tayba-sqlite-db-v3`.
3. النتيجة المتوقعة: Blob تخزين يحتوي `version/iv/data` وليس SQLite bytes الخام.
4. قاعدة قديمة خام يجب أن تُقرأ وتُعاد كتابتها مشفرة بعد أول تحميل.

## #4 Direct Login Rate Limit
1. استدعِ `loginWithPin()` خمس مرات فاشلة.
2. الاستدعاء السادس خلال الدقيقة.
3. النتيجة المتوقعة: رفض Rate-limit.
4. من `/auth/login` النتيجة المتوقعة HTTP 429.

## #8 Session Resolution
1. أنشئ فاتورة مرتبطة بالوردية A.
2. أغلق A وافتح B.
3. نفّذ return/void.
4. النتيجة المتوقعة: استخدام B كوردية fallback بدل اختيار وردية عشوائية مختلفة.

## #9 Dead Auth
1. ابحث عن imports لـ`localAuth.ts`.
2. النتيجة المتوقعة: `localApi.ts` هو المستهلك الفعلي لـ`loginWithPin`.
3. لا يجب وجود `createUser` أو `hasAnyUser` داخل الملف.

## #10 Regex
1. أدخل `abc1234xyz`.
2. النتيجة المتوقعة: رفض.
3. أدخل `1234`.
4. النتيجة المتوقعة: قبول صيغة PIN (ثم متابعة تحقق المستخدم).
