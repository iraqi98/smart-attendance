# Smart Attendance - نظام الحضور والانصراف الذكي

## 🚀 رابط التشغيل المباشر
[اضغط هنا للتشغيل](https://railway.app)

## 📝 المميزات
- تسجيل دخول آمن بـ JWT
- إدارة الموظفين (إضافة، تعديل، حذف)
- تسجيل الحضور والانصراف
- بصمة الوجه Face Recognition
- تحديد الموقع الجغرافي Geofencing
- إدارة الإجازات
- تقارير PDF و Excel
- نسخ احتياطي واستعادة

## 🔧 التشغيل محلياً
```bash
npm install
node server.js
```

## 🔐 بيانات الدخول الافتراضية
| الدور | المستخدم | كلمة المرور |
|-------|----------|-------------|
| Admin | admin | admin |

## 🛠️ التقنيات
- Node.js + Express
- SQLite
- JWT Authentication
- face-api.js (Face Recognition)
- Chart.js (رسوم بيانية)
