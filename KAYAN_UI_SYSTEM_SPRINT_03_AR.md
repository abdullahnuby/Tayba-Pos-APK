# KAYAN POS — UI System Sprint 03

## نطاق التنفيذ
إعادة ضبط اللغة البصرية للـRTL والموبايل/التابلت، مع الحفاظ على منطق الـPOS وقاعدة البيانات والـAPI وعقود الترخيص.

## ما تم
- تثبيت Palette KAYAN: Deep Navy / Champagne Gold / Sand / Slate / Charcoal.
- Sidebar Desktop وMobile Drawer بخلفية Navy ونص واضح وActive state ذهبي/داكن.
- استبدال رسم الـMark داخل React باستخدام أصول KAYAN SVG حقيقية.
- تحديث favicon وWindows icon وAndroid launcher assets وSplash.
- تحسين KPI cards والـtone لكل مجموعة بيانات.
- تحسين Empty States.
- إضافة Mobile Product Rows بدل ضغط جدول سطح المكتب على الهاتف.
- تقوية RTL للـdialogs والجداول والحقول الاتجاهية، مع إبقاء SKU/barcode والـtechnical identifiers LTR.
- الحفاظ على عدم استخدام صور للمنتجات.

## الملفات الرئيسية
- `src/styles.css`
- `src/components/kayan-brand.tsx`
- `src/components/app-shell.tsx`
- `src/components/sections/dashboard-section.tsx`
- `src/components/sections/products-section.tsx`
- `public/kayan-mark.svg`
- `public/kayan-logo.svg`
- `public/kayan-mark.png`
- `public/favicon-*`
- `public/apple-touch-icon.png`
- `resources/icon.*`
- `resources/android-*/*/*.png`
- `resources/splash*.png`

## ملاحظة الاختبار
تم فحص بنية الـZIP والأصول وتعديلات TypeScript نصيًا. لم يتم اعتماد `npm run build` هنا لأن dependencies غير مثبتة في بيئة التنفيذ.
