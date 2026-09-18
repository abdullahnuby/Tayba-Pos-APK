# KAYAN POS — Brand Implementation Sprint 02
## الهوية
تم اعتماد اتجاه الشعار الثاني: KAYAN / كيان — Business, Simplified.
- شعار Mark هندسي بحرف A ونقطة ذهبية.
- Navy + Champagne Gold + Sand + Slate + Charcoal.
- لا توجد صور منتجات ضمن تصميم بطاقات البيع.
- تم استبدال الأصول البصرية القديمة بشعار KAYAN مع الإبقاء على المعرفات الداخلية اللازمة للتوافق.

## ما تم تغييره
- `public/kayan-mark.svg`
- `public/kayan-logo.svg`
- `public/kayan-mark.png`
- favicon و Apple touch icon
- Windows/Electron icon
- Android launcher icons
- splash screens
- `src/components/kayan-brand.tsx`
- `src/styles.css`
- `index.html` إن وجد

## التوافق
لم يتم تغيير:
- `appId`
- license product identifier
- مفاتيح IndexedDB / localStorage
- أسماء Bridges / API الداخلية
- Schema أو business logic

الهدف هو تغيير الهوية البصرية بدون كسر البيانات أو التراخيص الحالية.
