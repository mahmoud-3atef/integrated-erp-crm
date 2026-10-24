# نشر النظام المتكامل على سيرفر الاختبار

السيرفر: **NEWCRM** (Windows Server 2022 + IIS)، وعنوان النظام: **https://newcrm.jrco.local:8003**.

المنفذ 8003 داخلي للتجربة أولًا، بينما يبقى النظام القديم يعمل على المنفذ 80. وعند الإطلاق للموظفين، يُعاد تشغيل التهيئة بمنفذ آخر، مثل `.\Initialize-ErpServer.ps1 -Port 443`، ثم `Deploy-Erp.ps1 -Port 443`.
قاعدة بيانات النظام على SQL Server في السيرفر نفسه، وقاعدة CRM (`SQLCRM`) تُقرأ فقط.

> كل الأوامر تُنفَّذ في **Windows PowerShell كمسؤول (Run as administrator)**، سطرًا سطرًا.

## أولًا: التثبيت المسبق (مرة واحدة)

1. **ASP.NET Core Hosting Bundle لإصدار .NET 10**
   - نزّله من صفحة تنزيل .NET 10 الرسمية لدى Microsoft (dotnet.microsoft.com)، من قسم ASP.NET Core Runtime، باسم «Hosting Bundle».
   - ثبّته، ثم نفّذ `iisreset`.
2. **SQL Server 2022 على هذا السيرفر**
   - **الإصدار:**
     - لسيرفر الاختبار يكفي **Developer** (مجاني لغير الإنتاج).
     - للتشغيل الفعلي لاحقًا يلزم **Standard** بترخيص.
     - **Express** مجاني، لكن حدّه 10 GB لكل قاعدة.
   - **أثناء التثبيت:**
     - اختر Default instance.
     - فعّل Windows Authentication.
     - أضف حسابك إلى SQL Server Administrators.
3. **المنطقة الزمنية:** السيرفر الآن على توقيت المحيط الهادئ، فاضبطه على توقيت الرياض:
   ```powershell
   Set-TimeZone -Id "Arab Standard Time"
   ```

## ثانيًا: تهيئة السيرفر (مرة واحدة)

```powershell
cd C:\Integrated-ERP-CRM\deploy
.\Initialize-ErpServer.ps1
```

يُنشئ السكربت ما يلي، ويمكن تشغيله أكثر من مرة دون ضرر:

- **المجلدات:** `C:\IntegratedErp` ومجلداتها: `app` و`releases` و`config` و`keys` و`logs` و`files`.
  - مجلدا `config` و`keys` لا يقرؤهما إلا المسؤولون والنظام.
- **IIS:**
  - مجموعة تطبيقات `IntegratedErp` تعمل دائمًا، حتى تستمر المزامنة في الخلفية.
  - موقع HTTPS على `newcrm.jrco.local` بالمنفذ **8003**.
- **الشهادة:**
  - تُطلب من جهة الشهادات في الدومين (JRCO-AD-CA).
  - إن رُفض الطلب لعدم الصلاحية على قالب Web Server، اطلب الشهادة من مسؤول الدومين.
  - بعد تثبيتها، أعد التشغيل مع تمرير بصمتها: `.\Initialize-ErpServer.ps1 -CertificateThumbprint <البصمة>`.
- **جدار الحماية:** فتح المنفذ 8003 على شبكة الدومين.
- **قاعدة البيانات:** قاعدة `IntegratedErp`، وصلاحية قراءة وكتابة البيانات لحساب النظام فقط. تغيير بنية الجداول يتم عند النشر بحساب المسؤول.
- **ملف الإعدادات:** `C:\IntegratedErp\config\appsettings.Server.json`، وفيه:
  - الاتصالات و AD و CRM.
  - الشركة: `carepro`.
  - أول مسؤول: حساب AD `JRCO\carepro` (غير رمز الشركة `carepro`).
  - لا يستبدله أي نشر لاحق.

## ثالثًا: الأسرار (مرة واحدة)

حساب ربط AD يُحفظ مشفّرًا لهذا الجهاز فقط:

```powershell
$env:ERP_SECRETS_FILE = 'C:\IntegratedErp\config\secrets.dat'
C:\Integrated-ERP-CRM\tools\Set-ErpSecret.ps1 -Name Identity:Ldap:BindUser -Scope LocalMachine
C:\Integrated-ERP-CRM\tools\Set-ErpSecret.ps1 -Name Identity:Ldap:BindPassword -Secret -Scope LocalMachine
```

## رابعًا: صلاحية القراءة من CRM (مرة واحدة، على SQLCRM)

يتصل النظام بقاعدة CRM باسم حساب الجهاز `JRCO\NEWCRM$`، وتكفيه صلاحية **القراءة فقط**. هذا تعديل أمني على خادم CRM، فينفّذه مسؤول قواعد البيانات بنفسه:

```sql
CREATE LOGIN [JRCO\NEWCRM$] FROM WINDOWS;
USE Care_Pro_MSCRM;
CREATE USER [JRCO\NEWCRM$] FOR LOGIN [JRCO\NEWCRM$];
ALTER ROLE db_datareader ADD MEMBER [JRCO\NEWCRM$];
```

## خامسًا: النشر (في كل مرة)

```powershell
C:\Integrated-ERP-CRM\deploy\Deploy-Erp.ps1
```

**خطوات النشر:**

1. تشغيل الاختبارات. لتخطيها أضف `-SkipTests`.
2. بناء الواجهة والخادم.
3. إيقاف الموقع مؤقتًا مع رسالة «جارٍ تحديث النظام».
4. تحديث قاعدة البيانات، وإنشاء الشركة إن لم تكن موجودة.
5. نسخ الإصدار، ثم تشغيل الموقع.
6. فحص `https://newcrm.jrco.local:8003/health`.

**الإصدارات:** يُحفظ كل إصدار في `C:\IntegratedErp\releases`، ويُبقى آخر خمسة منها.

## الرجوع للإصدار السابق

```powershell
C:\Integrated-ERP-CRM\deploy\Deploy-Erp.ps1 -Rollback
```

قاعدة البيانات لا ترجع، لأن الترحيلات تضيف فقط، فيعمل الإصدار السابق عليها.

## المتابعة

- **حالة النظام:** `https://newcrm.jrco.local:8003/health`، ويُظهر حالة قاعدة البيانات واتصال CRM.
- **السجلات:** `C:\IntegratedErp\logs\erp-YYYYMMDD.log`، ملف لكل يوم، وتُحذف بعد 60 يومًا.
- **أول دخول:** بحساب `carepro` من AD (يجب أن يكون موجودًا في الدومين)، ثم التحقق بخطوتين. بعده يضيف المستخدمين والأدوار من شاشات الإدارة.
- **حسابات التطوير:** حسابا `dev.admin` و`dev.user` لا يعملان على السيرفر.

## بريد الإرسال (لإرسال القسائم والتنبيهات)

النظام يرسل من حساب بريد واحد، يُضبط مرة واحدة على السيرفر.

1. في ملف إعدادات السيرفر `C:\IntegratedErp\config\appsettings.Server.json`، املأ قسم `Email`. مثال لحساب Microsoft 365:

   ```json
   "Email": {
     "Host": "smtp.office365.com",
     "Port": 587,
     "EnableSsl": true,
     "UserName": "payroll@carepro.com.sa",
     "FromAddress": "payroll@carepro.com.sa",
     "FromName": "كير برو - الموارد البشرية"
   }
   ```

   في Microsoft 365 يجب أن يكون «SMTP AUTH» مفعّلًا لهذا الصندوق.

2. احفظ كلمة مرور الحساب مشفّرة بسكربت الأسرار، ولا تكتبها في ملف الإعدادات:

   ```powershell
   $env:ERP_SECRETS_FILE = 'C:\IntegratedErp\config\secrets.dat'
   C:\Integrated-ERP-CRM\tools\Set-ErpSecret.ps1 -Name Email:Password -Secret -Scope LocalMachine
   ```

3. أعد النشر أو أعد تشغيل مجموعة التطبيقات. بعدها تظهر «يُرسل من: …» في نافذة «إرسال القسائم بالبريد» في صفحة المسير.

إيميل كل موظف يُدخل في ملفه (البيانات الشخصية)، أو لكل الموظفين مرة واحدة بملف «تحديث بيانات الموظفين» (عمود البريد الإلكتروني).

## إيقاف التحقق بخطوتين مؤقتًا (فترة التجربة فقط)

في ملف إعدادات السيرفر، أضف `"MfaRequired": false` داخل قسم `Identity`، ثم أعد النشر أو أعد تشغيل مجموعة التطبيقات. يسجل النظام تحذيرًا في السجل عند كل تشغيل ما دام التحقق متوقفًا. لإعادته احذف السطر أو اجعله `true`.


## نسخة تيست منفصلة تُفتح من الأجهزة الأخرى (`New-ErpTestSite.ps1`)

موقع ثانٍ على IIS باسم `IntegratedErpTest` يُفتح من أي جهاز على الشبكة. ‏`http://newcrm` (المنفذ 80) يحوّل إلى `https://newcrm` (المنفذ 443).

**ما يُنشئه**
- قاعدة بيانات `IntegratedErp_Test`: نسخة من قاعدة النظام الحي `IntegratedErp`، مأخوذة بنسخة احتياطية COPY_ONLY، فلا تتأثر نسخ النظام الحي الاحتياطية.
- مجلداته في `C:\IntegratedErpTest`.
- مفاتيحه الخاصة: جلسات التيست والنظام الحي لا تختلط.
- المرفقات منسوخة من النظام الحي.

**الإعدادات**
- لا مزامنة مع CRM، ولا بريد، ولا ملخص يومي.
- الدخول بحسابات الدومين كالنظام الحي.

**قبل التشغيل**
- المنفذان 80 و443 يجب أن يكونا فارغين. إن كان موقع النظام القديم على 80 فأوقفه أولًا.

شغّل في PowerShell كمسؤول:

```powershell
cd C:\Integrated-ERP-CRM
```

```powershell
.\deploy\New-ErpTestSite.ps1
```

**تحديث كود نسخة التيست لاحقًا**

```powershell
.\deploy\Deploy-Erp.ps1 -SiteName IntegratedErpTest -Root C:\IntegratedErpTest -HostName newcrm -Port 443 -SkipTests
```

**نسخ بيانات النظام الحي من جديد**

```powershell
.\deploy\New-ErpTestSite.ps1 -RefreshData
```

**إزالة موقع التيست وإرجاع المنفذ 80 للنظام القديم**

يحذف الموقع ومجموعة التطبيقات وقاعدة الجدار الناري، ويُبقي القاعدة والمجلد. بعدها شغّل موقع النظام القديم.

```powershell
.\deploy\New-ErpTestSite.ps1 -Remove
```
