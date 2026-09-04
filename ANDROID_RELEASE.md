# طيبة POS — Official Android Release

## الإصدار الأول
- Version Name: `1.0.0`
- Version Code: `1`
- Application ID: `com.tayba.pos`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

## قبل أول Release
1. احتفظ بمفتاح التوقيع في مكان آمن. نفس المفتاح مطلوب لكل التحديثات المستقبلية.
2. أنشئ keystore مرة واحدة:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\create-release-keystore.ps1
   ```
3. أنشئ `android/keystore.properties` باستخدام `android.keystore.properties.example` واملأ القيم الحقيقية.
4. لا ترفع `android/keystore.properties` أو ملف `.jks` إلى GitHub أو ZIP عام.

## بناء النسخة الرسمية
من جذر المشروع:
```powershell
npm.cmd run build
npx.cmd cap sync android
npm.cmd run android:release
```

بعد النجاح:
```text
android\app\build\outputs\apk\release\app-release.apk
```

## التحديثات
لكل تحديث لاحق:
- غيّر `version` في `package.json` عند الحاجة.
- ارفع `versionCode` في Android إلى رقم أكبر من السابق.
- استخدم **نفس keystore ونفس keyAlias**.
- ابنِ Release من جديد.

هذا يسمح بتثبيت التحديث فوق النسخة الحالية بدون حذف بيانات SQLite المحلية، طالما ظل Application ID والتوقيع ثابتين.
