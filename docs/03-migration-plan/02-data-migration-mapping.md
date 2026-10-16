# 02 — ربط البيانات من الـ CRM للنظام الجديد (Data Migration Mapping)

> المصدر: `SQLCRM / Care_Pro_MSCRM` (قراءة فقط — views الـ CRM). الوجهة: قاعدة النظام الجديد عن طريق **Staging**.
> كل التواريخ: `DATEADD(HOUR, 3, x)` ⇒ `date` (توقيت السعودية). الحالات بالـ **قيمة** مش بالـ label.

## 1. مسار الترحيل

```text
CRM views ──(sync job: قراءة فقط، تزايدي بـ modifiedon)──▶ staging.crm_*  (نسخة خام + تاريخ السحب)
staging ──(transform: قواعد موثقة + اختبارات)──▶ جداول الموديولات
         └──▶ migration_exception (كل سجل مارضيش يتحول وسببه)  ──▶ تقرير للمراجعة
         └──▶ migration_reconciliation (مقارنات الأرقام)
```
- المزامنة **قابلة للتكرار** (idempotent) وبتربط كل سجل جديد بـ `crm_id` (GUID الأصلي) في جدول ربط.
- قبل كل تحويل (Cutover): تجميد العملية في الحالي ⇒ مزامنة أخيرة ⇒ تسوية ⇒ فتح النظام الجديد.

## 2. الربط حسب الكيان

| المصدر (CRM) | الوجهة | قواعد التحويل | الاستثناءات |
|---|---|---|---|
| `new_employee` (3,228) | `person` + `person_identifier` + `worker` **أو** `staff_employee` | مشروع = HeadOffice ⇒ **موظف شركة** (357)؛ غير كده ⇒ عامل. الهويات: `new_idnumber` (إقامة)، `new_passportnumber`، `new_borderno`، `new_passportvisanumber`، `new_sadadworkpermitno`… كل واحد سطر. `worker_no` = `new_empidnumber` | جواز مكرر (7)، بدون إقامة (4)، بدون مشروع (16) |
| `new_employee.new_sponseredby` | `worker_employment.sourcing_type` + `legal_entity`/`supplier` | Care-Pro 05/07 ⇒ `COMPANY_SPONSORED` على السجل المقابل؛ الباقي ⇒ `INTERNAL_SUPPLIER` بالمورد | قيمة فاضية ⇒ مراجعة |
| `new_employee` (الراتب والبدلات) | `worker_salary_structure` / `staff` | سريان من `new_contractstartdate` أو `new_dateofjoining` | راتب صفر (525) ⇒ مراجعة |
| `new_employee.statuscode` + `new_employeeaudit` | `worker.lifecycle_status` + فترات `OUT`/`ABSCONDED` | 279640007/279640026 ⇒ `FINAL_EXIT`؛ 279640003 ⇒ `END_OF_SERVICE`؛ 100000004 ⇒ `ABSCONDED`؛ 279640025 ⇒ `SPONSORSHIP_TRANSFERRED_OUT`؛ 279640011 ⇒ `DECEASED`؛ 279640013/279640018 ⇒ `SUSPENDED`؛ الباقي ⇒ `ACTIVE`. التاريخ من `new_employeeaudit.new_changedate` | |
| `new_project` (165) | `customer` + `contract` + `project` | `new_customerid` ⇒ العميل (53)؛ النوع: 1 ⇒ Cost Plus، 2 ⇒ Total Cost؛ `ownerid` ⇒ مدير المشروع؛ HeadOffice و `pro00137` ⇒ مش مشاريع (`is_internal`) | **112 مشروع من غير عميل** ⇒ ربط يدوي |
| `account` (203) | `customer` | بعد إزالة المكرر بالسجل التجاري/الاسم | |
| أسعار المباشرات المفتوحة | `price_package` | تجميع (المشروع × المهنة × الجنسية) ⇒ السعر الأكثر تكرارًا = الباقة؛ الشاذ ⇒ "سعر خاص" | مباشرات بدون سعر (87 حديثة) ⇒ لازم سعر قبل التحويل |
| `new_empwork` (4,165 من 2026) | `worker_period` (WORK) + `worker_period_rate` | البداية `new_startdate`؛ النهاية حسب قاعدة الفترات ([§3](#3-بناء-سجل-الفترات)); السعر من `new_serviceprice`/`new_housing`/`new_transportation` (أو `new_totalservices` للعامل) | مكرر نفس اليوم (252 في 2026)، بدون سعر |
| `new_empwork` 2018–2019 (2,868) | **أرشيف فقط** | مش بتدخل السجل | |
| `mw_lodginorderdetails` المعتمدة 100000009 | `worker_period` (HOUSING) | البداية `mw_arrivedate`؛ السبب `new_backreason` (القيم اليتيمة ⇒ كود "غير محدد" للمراجعة)؛ النوع `new_entertype` | خروج قبل الدخول (24)، بدون خروج (70) |
| `hr_vicrequest` المعتمدة | `worker_period` (VACATION / CLIENT_VACATION) | `hr_vicstartdate` ⇒ `new_enddate` | |
| `new_deliverorder` | أرشيف + مرجع على الفترة | `new_number`، المستلم | |
| `mw_housing` / `mw_housingapartments` / `new_ajeercontract` / `new_thijridate` | `building` / `room` / `bed` / `bed_assignment` | **السرير من `new_ajeercontract` والتسكين من `new_thijridate`** (الكيانات المعاد استخدامها) | |
| `new_invoice` + `new_invoicdetail` | أرشيف للقراءة + **رصيد افتتاحي** للمفتوح | المتبقي = `new_netsalarywithvat − new_totalpaidamount` بتاريخ الفاتورة؛ مسيرات HeadOffice (نفس الكيان) ⇒ أرشيف رواتب | 193 ملغية ⇒ أرشيف بس |
| `new_attendance` | أرشيف | | |
| `new_leaverequest`, `hr_vicrequest` المفتوحة | طلبات مفتوحة في النظام الجديد | بمرحلتها | |
| أرصدة الإجازات (`new_vacationbalance`, `new_consumedblalnce`, `new_oldconsumedbalance`) | رصيد افتتاحي للإجازات | | |
| `new_agent` (9) | `recruitment_agent` | | |
| `new_VisaHeader` / `new_Visa` | `block_visa` / `block_visa_line` | المفتوح والرصيد بس | |
| `new_candidate` اللي ماوصلوش | `candidate` بمرحلته | | |
| `systemuser` (31 مفعّل) + Teams | مستخدمين + أدوار | الربط بالـ AD بـ objectGUID؛ Teams ⇒ أدوار مقترحة (CareAdmin، CarePayroll، EditDeliver…) | الأسماء المكررة (6) |

## 3. بناء سجل الفترات
1. لكل عامل: كل الأحداث (مباشرة، تسكين معتمد، إجازة معتمدة، تغيير حالة نهائي) مرتبة بالتاريخ ثم `createdon`.
2. كل حدث بيقفل الفترة المفتوحة يوم قبله ويفتح فترته (end حصري).
3. **قواعد الحالي:** الرجوع للسكن بيقفل الشغل؛ المباشرة التالية بتقفل اللي قبلها؛ `new_enddate` اليدوي بيقفل الشغل.
4. **الاستثناءات (مايتصلحش تلقائي):** مباشرتين نفس اليوم، تسكين بعد تسكين من غير مباشرة، خروج قبل دخول، فترة شغل من غير سعر، حركة بعد خروج نهائي، عامل في الشغل وحالته "في السكن"…
5. **المطابقة:**
   - أيام الشغل لكل (عامل × مشروع) لدورات سبتمبر وأكتوبر 2026 مقابل `new_invoicdetail.new_workingdays`.
   - عدد "في السكن" مقابل التعريفات التلاتة الحالية (34/73/135) — والفرق مفسّر.
   - عدد المباشرات والرجيع لكل شهر مقابل لوحة الإدارة.

## 4. ما لا يُرحّل
الكيانات الفاضية (117)، قطاع الأفراد والساعات، الـ workflows والـ plugins (المنطق اتعاد بناؤه)، البيانات التشغيلية 2018–2019 (أرشيف قراءة).
