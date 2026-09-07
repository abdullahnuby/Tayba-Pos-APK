# Sprint 2 — تقسيم الوحدات الكبيرة

تم تنفيذ تقسيم محافظ على السلوك والـAPI والبيانات.

## ما تم فصله

- `src/components/sections/sales/ProductSelectionDialogs.tsx`
  - اختيار الـVariant
  - تأكيد إضافة الصنف
  - اختيار وحدة البيع (قطعة/ربع دستة/نص دستة/دستة)

- `src/components/sections/sales/CartPanel.tsx`
  - سلة البيع
  - اختيار العميل
  - تعديل الكمية والسعر
  - الخصم والإجمالي
  - زر إنهاء الفاتورة

- `src/components/sections/sales/ShiftDialogs.tsx`
  - فتح الوردية
  - إغلاق الوردية
  - تقرير الوردية

- `src/lib/localApi-helpers.ts`
  - JSON response/body helpers
  - authorization helpers
  - PIN hashing/verification
  - mappers الخاصة بالعميل والمورد والمنتج والـvariant
  - CSV helpers

## النتيجة

- `sales-section.tsx`: من 1466 إلى 1196 سطرًا تقريبًا قبل التنسيق النهائي، ثم استقر بعد إعادة الدمج على أقل من النسخة الأصلية بشكل واضح.
- `localApi.ts`: تم إخراج الـpure/shared helpers إلى ملف مستقل.
- لم يتم تعديل أي schema أو حذف أي بيانات أو تغيير API contracts.

## التحقق

- `product-card-action`: PASS
- `test:regressions`: PASS
- `release-gate.py`: PASS
- `verify-business-invariants.py`: PASS

> ملاحظة: الـBuild الكامل يتطلب تثبيت dependencies (`npm install`/`npm ci`) في بيئة ذات شبكة متاحة.
