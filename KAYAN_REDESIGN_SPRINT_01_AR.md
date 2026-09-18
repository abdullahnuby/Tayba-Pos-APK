# KAYAN POS — Visual Redesign Sprint 01

## الهدف
نقل الواجهة من شكل shadcn/Tailwind عام إلى لغة بصرية خاصة بـ KAYAN، مع الحفاظ على منطق البيع وقاعدة البيانات والتكاملات الحالية.

## ما تم تنفيذه
- إنشاء هوية KAYAN بمرمز عربي بسيط وWordmark موحد داخل التطبيق.
- اعتماد لوحة ألوان دافئة: خلفية كريمية، Primary داكن، ولمسة Accent ذهبية/عنبرية.
- توحيد الـ cards والـ buttons والـ typography والمسافات الأساسية.
- تطوير Empty State إلى مكوّن بصري له هوية KAYAN بدل الأيقونة الرمادية المباشرة.
- إعادة بناء الهيكل البصري للـ Sidebar والـ Header.
- إعادة تصميم شاشة البيع: شريط علوي، بحث، تصنيفات، شبكة أصناف، وسلة الفاتورة.
- إعادة تصميم كروت المنتجات مع حالة المخزون والسعر ومرجع SKU/Barcode.
- إعادة تصميم السلة مع تراتبية أوضح للعميل، البنود، الخصم، والإجمالي.
- تطوير الشكل العام للـ Dashboard وبطاقات المؤشرات ورأس الصفحة وLegend للرسوم البيانية.
- إعادة تصميم صفحة المنتجات والمخزون كـ catalog/table بصري أكثر وضوحًا.
- تحديث شاشات الدخول والإعداد والترخيص والعناصر المطبوعة لاستخدام هوية KAYAN الظاهرة.

## ثبات الوظائف
- لم يتم تغيير schema قاعدة البيانات.
- لم يتم تغيير معرف الترخيص الداخلي `tayba-pos` أو `com.tayba.pos` حتى لا يتم كسر التراخيص/التثبيت الحالي.
- لم يتم تغيير API contracts الخاصة بالبيع أو المخزون.
- لم يتم إدخال مكتبة UI جديدة.

## التحقق
تم إجراء Parse/Syntax validation عبر TypeScript compiler على الملفات التي تم تعديلها.
لم يتم اعتماد `npm run build` كاختبار ناجح في هذه البيئة لأن تثبيت dependencies (`npm ci`) انتهى بمهلة اتصال قبل اكتماله؛ لذلك يجب تشغيل `npm ci` ثم `npm run build` في بيئة GitHub/المطور كاختبار CI نهائي.

## الملفات الأساسية المتغيرة
- `src/styles.css`
- `src/components/kayan-brand.tsx`
- `src/components/empty-state.tsx`
- `src/components/app-shell.tsx`
- `src/components/sections/sales-section.tsx`
- `src/components/sections/sales/ProductsPane.tsx`
- `src/components/sections/sales/CartPanel.tsx`
- `src/components/sections/dashboard-section.tsx`
- `src/components/sections/products-section.tsx`
- `src/components/login-section.tsx`
- `src/components/setup-section.tsx`
- `src/components/license-gate.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/button.tsx`
- `index.html`
- `capacitor.config.ts`
- `package.json`
- عناصر الطباعة والاختبارات الظاهرة التي كانت تحمل اسم طيبة أصبحت تعرض KAYAN.
