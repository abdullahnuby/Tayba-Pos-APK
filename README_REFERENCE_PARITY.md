# Tayba POS Offline — Reference Parity Build

هذه النسخة تستخدم ZIP المرجع الكامل `tayba-pos` كمصدر وظيفي وواجهاتي، مع إبقاء المرجع نفسه Read-Only وعدم تعديل GitHub.

## التشغيل
- Vite + React
- SQLite داخل المتصفح عبر sql.js + IndexedDB persistence
- واجهات المرجع الأصلية مع RTL عربي
- Local API compatibility layer تحت `/api/*` لتحافظ مكونات المرجع على نفس العقود
- Google Apps Script للمزامنة فقط
- لا Cloudflare / D1 / KV / Supabase / Firebase / VPS

## تشغيل محلي
```bash
npm install
npm run dev
```

## ملاحظات
- تحتاج نسخة المتصفح/الأجهزة إلى WebAssembly support لـ sql.js.
- أول تشغيل يعرض Setup مثل المرجع، ثم Login.
- البيانات التشغيلية محلية بالكامل، والـSync اختياري.
- يلزم إكمال QA الفعلي للعمليات النهائية قبل APK الإنتاج.
