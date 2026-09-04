# طيبة POS — Android / APK

المشروع أصبح مهيأ للتغليف كتطبيق Android مستقل باستخدام Capacitor 8.

## المتطلبات على جهاز البناء

- Node.js 22+.
- Android Studio مع Android SDK وPlatform Tools وGradle/Android build tools المطلوبة للمشروع.
- Java/JDK المتوافق مع نسخة Android Studio/Capacitor المثبتة.

## أول تشغيل

من مجلد المشروع:

```bash
npm install
npm run build
npx cap add android
npx cap sync android
```

بعدها يمكن فتح المشروع في Android Studio:

```bash
npx cap open android
```

أو إنشاء APK Debug من الطرفية:

```bash
npm run android:debug
```

سينتج APK Debug داخل:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## تحديث نسخة Android بعد تعديل الواجهة

```bash
npm run cap:sync
```

ثم أعد Build من Android Studio أو شغّل `npm run android:debug`.

## الهوية الحالية

- App ID: `com.tayba.pos`
- App Name: `طيبة POS`
- Web output: `dist`

## ملاحظات مهمة

التطبيق مصمم ليعمل محليًا بدون خادم. قاعدة البيانات الحالية مبنية داخل طبقة التطبيق المحلية، لذلك التغليف بـ Capacitor لا يحول التطبيق إلى نظام يعتمد على الإنترنت.

نسخة Release للنشر تحتاج لاحقًا إلى Android signing keystore خاص بالمشروع قبل التوزيع العام. لا نضع مفاتيح التوقيع داخل المستودع.
