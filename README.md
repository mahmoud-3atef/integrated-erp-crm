# بناء نظام متكامل (ERP + CRM)

نظام بديل لـ CarePro الحالي (بوابة ASP.NET Web Forms فوق Microsoft Dynamics CRM 2011)،
مبني على تقنية حديثة ومستقل عن الـ CRM، ويغطي كل خصائص النظام الحالي على نطاق أكبر.

## المصادر
- كود النظام الحالي: `C:\Cl\Project-Update\project05-10-2026\project19042026`
  - البوابة: `test2\test2` — المكتبة: `CarePro.CRM.Core`
- قاعدة البيانات الحالية: `SQLCRM` / `Care_Pro_MSCRM` (قراءة فقط)

## هيكل المجلد
- `docs/01-current-system-analysis` — تحليل النظام الحالي (الكيانات، الحقول، الحالات، مسارات الاعتماد، منطق الـ CRM المخفي)
- `docs/02-target-architecture` — المعمارية ونموذج البيانات للنظام الجديد
- `docs/03-migration-plan` — خطة النقل على مراحل وربط البيانات
- `src` — كود النظام الجديد (لاحقًا)

## المراحل المقترحة
0. التأسيس وتحليل النظام الحالي
1. البيانات الأساسية + سجل الفترات الموحّد (مع مزامنة من الـ CRM)
2. حركة العمالة (تسليم / تسكين / إجازات)
3. التحضير والفوترة (+ ZATCA)
4. الرواتب والمالية (+ مُدد / WPS)
5. المبيعات (CRM)
6. إيقاف الـ CRM

## التشغيل للتطوير

المتطلبات: .NET 10 SDK (المحدد في `global.json`)، و Node 24 (للواجهة لاحقًا).

```bash
dotnet build IntegratedErp.slnx
```

```bash
dotnet test IntegratedErp.slnx
```

```bash
dotnet run --project src/Hosts/IntegratedErp.Api --urls http://localhost:5080
```

إنشاء/تحديث قاعدة البيانات (كل الموديولات المفعّلة) بأمر واحد:

```bash
dotnet run --project src/Hosts/IntegratedErp.Api -- migrate
```

في التطوير القاعدة على LocalDB (`IntegratedErp_Dev`) بإعدادات توافق SQL Server 2022 (160). اختبارات التكامل بتعمل قاعدة مؤقتة وتمسحها — على LocalDB في Windows، أو على السيرفر المحدد في `ERP_TEST_SQLSERVER`.

إضافة migration لموديول:

```bash
dotnet ef migrations add <Name> --project src/Modules/Organization/IntegratedErp.Modules.Organization --startup-project src/Modules/Organization/IntegratedErp.Modules.Organization --output-dir Infrastructure/Migrations
```

نقاط مفيدة: `/health`، `/api/v1/system/modules` (الموديولات وحالة تفعيلها)، `/openapi/v1.json` (في بيئة التطوير).

### هيكل الكود
```text
src/
  SharedKernel/      أنواع مشتركة صغيرة بدون أي اعتماد (Result, Error, ...)
  BuildingBlocks/    البنية المشتركة (تسجيل الموديولات، التدقيق، الترقيم، ...)
  Modules/<Name>/
    IntegratedErp.Modules.<Name>             التنفيذ: Domain / Application / Infrastructure / Api
    IntegratedErp.Modules.<Name>.Contracts   الواجهة العامة — الشيء الوحيد اللي موديول تاني يقدر يستخدمه
  Hosts/IntegratedErp.Api                    الـ API (بيسجل كل الموديولات)
tests/
  IntegratedErp.UnitTests                    قواعد العمل
  IntegratedErp.ArchitectureTests            حدود الموديولات (بتفشل لو موديول استخدم تنفيذ موديول تاني)
```

### تفعيل/تعطيل موديول
في الإعدادات: `"Modules": { "<Name>": { "Enabled": false } }` — الموديول المقفول مابيتسجلش ولا بتظهر نقاطه.

### ملاحظة للأجهزة غير المحدّثة (CET)
لو البناء أو التشغيل فشل برسالة `Your Windows doesn't fully support CET`، اعمل ملف `Directory.Build.local.props` في جذر المشروع (مش بيترفع على Git) فيه تشغيل المترجم عن طريق `dotnet` و `<CETCompat>false</CETCompat>` — أو ثبّت تحديثات Windows.
