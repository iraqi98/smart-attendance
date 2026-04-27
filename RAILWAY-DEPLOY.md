# 🚂 دليل النشر على Railway

## الخطوة 1: ادخل على Railway
https://railway.app/dashboard

## الخطوة 2: أنشئ مشروع جديد
1. اضغط **New +**
2. اختر **Deploy from GitHub repo**

## الخطوة 3: اختر المستودع
- ابحث عن `iraqi98/smart-attendance`
- اضغط عليه

## الخطوة 4: أضف متغير البيئة (مهم!)
1. اذهب لـ **Variables**
2. اضغط **New Variable**
3. الاسم: `JWT_SECRET`
4. القيمة: اكتب أي نص عشوائي طويل (مثلاً: `MySuperSecretKey2024!@#$%`)

## الخطوة 5: اضبط Start Command
1. اذهب لـ **Settings**
2. في **Start Command** اكتب:
```
node server.js
```

## الخطوة 6: تفعيل النشر
- اضغط **Deploy**
- انتظر 2-3 دقائق

## ✅ النهاية
سيعطيك Railway رابط مثل:
```
https://smart-attendance-production.up.railway.app
```

---

## ⚠️ ملاحظات مهمة

### 1. HTTPS
Railway يعطي HTTPS تلقائياً — فالكاميرا والموقع الجغرافي يعملان 🔒

### 2. SQLite
البيانات تُحفظ في Railway لكن **قد تُمسح** عند إعادة التشغيل.
- استخدم صفحة **النسخ الاحتياطي** في النظام
- حمّل النسخة دورياً

### 3. Front-end يتحدث مع API تلقائياً
الكود يستخدم `API_URL = ''` أي نفس الرابط — لا تحتاج تعديل.

---

## 🔗 الروابط
| الرابط | الوظيفة |
|--------|---------|
| GitHub | https://github.com/iraqi98/smart-attendance |
| Railway Dashboard | https://railway.app/dashboard |
| Local | http://localhost:8080 |
