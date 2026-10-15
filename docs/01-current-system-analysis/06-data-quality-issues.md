# 06 — مشاكل جودة البيانات والتصميم اللي لازم تتحل في النظام الجديد

> كل رقم هنا من استعلام SELECT على `Care_Pro_MSCRM` يوم 2026-10-15 أو من الكود مباشرة. الأولوية: 🔴 تأثير مالي/تشغيلي مباشر — 🟠 بيأثر على دقة التقارير — 🟡 تقني/صيانة.

## 1. الفترات والحركة (أهم مجموعة)

| # | المشكلة | الدليل | الأولوية | الحل في التصميم الجديد |
|---|---|---|---|---|
| 1.1 | **مافيش سجل فترات**: "العامل كان فين يوم كذا" بيتحسب كل مرة من تواريخ متفرقة (بداية المباشرة، `new_enddate` اختياري، أول تسكين معتمد لنفس المشروع، المباشرة التالية) — بنفس المنطق متكرر في 5+ أماكن | `GlobalCode.GetProjectMonthlyAttendanceExportData`, `FinanceReportService.GetCoverage`, `EmployeeComparisonService`, `EmployeeLifecycleService`, `ManagementDashboardService` | 🔴 | **Period Ledger** موحد: كل فترة (WORK / HOUSING / VACATION / LEAVE / ABSCONDED / EXITED) ليها `employee_id, type, project_id, housing/bed, start_date, end_date (exclusive), source_document`، وقاعدة إن الفترات مابتتداخلش، والإغلاق صريح بحدث |
| 1.2 | تواريخ خروج السكن ناقصة/غلط | من 966 أمر معتمد: **70** من غير `new_leavedate`، **24** الخروج قبل الدخول؛ وعلى كل الأوامر 119 الخروج = الدخول (الـ workflow بيكتب `new_leavedate = mw_arrivedate` عند الإلغاء وفي فروع معينة) | 🔴 | تاريخ الخروج بيتولد من الحدث التالي (تسليم/إجازة/خروج) مش يدويًا ولا من workflow |
| 1.3 | **"العمالة في السكن" ليها 3 أرقام** | حسب حالة العامل **34**، حسب `new_housingstatus=1` **73**، حسب آخر حركة (تسكين معتمد ومفيش مباشرة بعده) **135** | 🔴 | رقم واحد مشتق من الـ ledger |
| 1.4 | مباشرات مكررة/متداخلة | **502** حالة (252 منها في 2026) عامل له أكتر من مباشرة بنفس تاريخ البداية؛ **384** (عامل، مشروع) في 2026 عندهم أكتر من مباشرة مفتوحة (`new_enddate` فاضي) | 🔴 | قيد unique على (العامل، تاريخ البداية) ومنع فترتين عمل مفتوحتين |
| 1.5 | الرجوع للسكن من مشروع تاني **مابيقفلش** المباشرة في التحضير (الشرط `l.new_projectid = ew.new_projectid`)، والإجازات مش داخلة في الحساب | `GlobalCode` السطر 711–715 | 🔴 (احتمال فوترة زيادة) | الفوترة من الـ ledger: أيام WORK فقط في المشروع |
| 1.6 | `new_projectjoingdate` (تاريخ الالتحاق بالمشروع) بيتكتب من 3 مصادر: تاريخ المباشرة، تاريخ التسليم، **وتاريخ دخول السكن** (`Housing Order Process`) | XAML الـ workflows | 🟠 | حقل مشتق (آخر فترة WORK) مش مخزن |
| 1.7 | حالة العامل `statuscode` حقل واحد بيخلط المكان (سكن/شغل) ودورة الحياة (جديد/خروج نهائي/هروب) والكفالة، وبيكتبه 8+ workflows والبوابة | 22 قيمة؛ تغييرات من `أمر تسليم`, `مباشرة الموظف`, `Housing Order Process`, `Housing Status Work Flow`, `طلب أجازة`, `Housing Reservation`… | 🟠 | فصل: Lifecycle status (Active/Exited/Absconded/Transferred) + Current period (من الـ ledger) |
| 1.8 | أوامر "لم يتم التسليم" (279640003) واتعمل لها مباشرات | 9 أوامر | 🟠 | المباشرة تتولد بس من أمر مكتمل، والإلغاء يلغي الفترات |

## 2. أوامر التسليم والمبالغ

| # | المشكلة | الدليل | الأولوية | الحل |
|---|---|---|---|---|
| 2.1 | **العمال في أمر التسليم نص** في `new_laborsnumber` مفصول بـ CRLF، والـ lookup `new_employeeid` فاضي في **كل** الأوامر (1,267) | 343 أمر فيهم أكتر من عامل | 🔴 | جدول سطور `delivery_order_lines (order_id, employee_id, service_price, housing, transport)` |
| 2.2 | البحث عن العامل من النص بيطابق على **7 أعمدة** (`new_empidnumber`, `new_idnumber`, `new_borderno`, `new_PassportNumber`, `new_sadadworkpermitno`, `new_passportvisanumber`, `new_onlynumber`) و `TOP 1` | `TransferOrderDetailsService.CreateEmpWorkFromDeliverOrder` | 🔴 (ممكن يختار عامل غلط) | اختيار العامل بالـ ID من واجهة بحث |
| 2.3 | **أوامر التسليم كانت من غير حقول مبالغ** ⇒ المباشرات مالهاش سعر خدمة | **87** مباشرة من 2026-09-01 `new_serviceprice = NULL` (من 409)؛ على كل البيانات 4,890 من 7,033 NULL و 5,480 NULL أو صفر | 🔴 | السعر إجباري على سطر الأمر/الفترة + جدول أسعار للعقد (rate card) بتاريخ سريان |
| 2.4 | سعر الخدمة في 3 أماكن: العامل (`new_totalservices` — 2,266 عامل صفر)، المباشرة، وأمر التسليم؛ والتحضير بياخد سعر "آخر مقطع فيه سعر" وإلا سعر العامل | `GlobalCode`, `ProjectServicePriceUpdateService` | 🔴 | السعر على الفترة نفسها، مأخوذ من rate card العقد، والتعديل بأثر تاريخي موثق |
| 2.5 | أسعار بتتنقل عن طريق الـ **Session** (`TransferFinancials_{id}`) | `TransferOrderDetailsService.CopyFinancialValuesFromSession` | 🟡 | لا state في الـ session للبيانات المالية |

## 3. التواريخ والتوقيت

| # | المشكلة | الدليل | الأولوية | الحل |
|---|---|---|---|---|
| 3.1 | التواريخ "date-only" متخزنة UTC (اليوم 15 بيتخزن 14 الساعة 21:00) والكود بيعمل `DATEADD(HOUR, 3, …)` يدويًا في كل استعلام (ومرة `TimeZoneInfo` ومرة `AddHours(3)`) | 6,986 من 7,033 مباشرة الساعة 21:00 UTC؛ **31 بساعات مختلفة** (هتتحسب يوم غلط) | 🔴 (مشاكل "نفس اليوم") | نوع `date` للتواريخ التشغيلية، و `datetimeoffset` للطوابع الزمنية بس |
| 3.2 | ترتيب الأحداث في نفس اليوم معتمد على `createdon` (مين اتسجل الأول) | `EmployeeMovementValidationService.IsAfterOrSame` | 🟠 | ترتيب صريح (sequence) داخل الـ ledger |
| 3.3 | قاعدة التأخير مختلفة بين مكانين: البوابة تطلب السبب لو الفرق **> 2** يوم، و `CrmCreateService` يحط `new_delay` لو **≥ 2** | `Operations_Housing_Create.IsLateReturn`, `CrmCreateService.CreateHousingOrder` | 🟡 | قاعدة واحدة configurable |
| 3.4 | شهر الفوترة "30 يوم ثابت" مع قص يوم 31 وعدم تطبيقه على فبراير | `GlobalCode.GetAttendanceCalculationToDate` | 🟠 | سياسة فوترة على مستوى العقد (أيام فعلية / 30 ثابت) |

## 4. الحالات والـ Option Sets

| # | المشكلة | الدليل | الأولوية | الحل |
|---|---|---|---|---|
| 4.1 | **المنطق مبني على نص الـ label** (`LIKE '%معتمد%'`, `= 'approved'`, `NOT LIKE '%ملغ%'`…) | 156 مقارنة في SQL + ~50 نص عربي مختلف بيتطابق في C# — التفاصيل في [03](03-option-sets-and-statuses.md) | 🔴 | أكواد ثابتة |
| 4.2 | labels ناقصة: العربي لـ "approved" (100000009) وللفاتورة الملغية (279640007) فاضي؛ وlabels متناقضة (100000000 عربي "تمت الموافقة" / إنجليزي "Send To Sales Manager") | `StringMap` | 🟠 | |
| 4.3 | دوال `getOptionSetDisplay(en)` مكتوبة يدويًا جوه قاعدة الـ CRM وبترجع `varchar(50)` | `OBJECT_DEFINITION` | 🟡 | |
| 4.4 | **قيم يتيمة** في `new_backreason`: 2, 3, 5, 279640003, 279640004 = **145** أمر تسكين بدون label | `StringMap` vs البيانات | 🟠 | ترحيل لقيم معروفة بمراجعة العمليات |
| 4.5 | نوع الإجازة/التصفية بيتعرف من النص بعد شيل المسافات (`خروجنهائي`, `استقال`) — وده بيحدد صرف مكافأة نهاية الخدمة | `VacationRequestService.IsFinalExit/IsResignation` | 🔴 | نوع طلب بكود + سياسة حساب مرتبطة بالكود |
| 4.6 | شاشة أوامر التسليم بتعرض حالتين بس وأي حالة تانية "غير محدد" | `TransferOrderQueryService.GetStatusText` | 🟡 | |

## 5. نموذج البيانات

| # | المشكلة | الدليل | الأولوية | الحل |
|---|---|---|---|---|
| 5.1 | **كيانات مُعاد استخدامها لغير غرضها**: السرير متخزن في `new_ajeercontract` (عقد أجير) وتسكين السرير في `new_thijridate` (تاريخ هجري) | `HousingManagerService` (`BedMasterTableName`, `BedAssignmentTableName`) | 🔴 | جداول `buildings / rooms / beds / bed_assignments` حقيقية |
| 5.2 | نموذجين سكن منفصلين: أمر التسكين (`mw_lodginorderdetails` على مبنى/غرفة) وتسكين السرير (`new_thijridate`) من غير ربط | | 🟠 | الحركة (HOUSING period) هي اللي تحجز سرير |
| 5.3 | **مسير الرواتب متخزن كفاتورة مشروع** (`new_invoice`, `new_invoicetype = 100000000 Project Invoice`) على مشروع HeadOffice؛ النوع 100000003 "employee payroll" مش مستخدم؛ 3 فواتير `new_invoicetype` فاضي | `PayrollService.CreatePayrollInvoice` | 🔴 | موديول Payroll منفصل (payroll run / payslip lines) عن الفوترة (AR invoices) |
| 5.4 | المشروع = العميل = العقد في كيان واحد، والعميل `account` بيتنشأ تلقائيًا بـ workflow | WF `Create Customers For Projects` | 🟠 | Customer ← Contract ← Project/Site منفصلين |
| 5.5 | **Schema drift**: الكود بيكتشف أسماء الأعمدة وقت التشغيل (`sys.columns`, `RetrieveAttributeRequest`) — أعمدة بديلة لنفس المعنى (`new_enddate`/`new_endworkdate`, `new_serviceprice`/`new_totalservices`, 5 أسماء لأيام الغياب، 10 أسماء لجدول الغرف) | [02 §3](02-entities-and-fields.md#3-أعمدة-بيتم-اكتشافها-وقت-التشغيل-schema-drift) | 🟡 | schema ثابت بـ migrations |
| 5.6 | 223 كيان custom، **117 منهم فاضيين**، والبوابة بتستخدم ~19 بس | `sys.partitions` | 🟡 | ترحيل الكيانات اللي فيها بيانات حقيقية بس (راجع [01 §6](01-domain-map.md#6-الكيانات-اللي-في-الـ-crm-ومش-ظاهرة-في-البوابة-لازم-تتقرر-في-النطاق)) |
| 5.7 | التحصيل = رقم واحد `new_totalpaidamount` على الفاتورة (مافيش سندات قبض ولا توزيع دفعات على فواتير؛ `new_paymentreceipt` فيه سجل واحد) | | 🔴 | AR: receipts + allocations + aging من القيود |
| 5.8 | سطر الفاتورة مش مربوط بالمباشرة/الفترة | `new_invoicdetail` | 🟠 | invoice_line ← period_id |
| 5.10 | أعمدة قالب التحضير بأسماء مضللة: `DueGovMonthlyCost` = جزء **السكن** من السعر و`Dueprofit` = جزء **النقل**، ومتخزنين في `new_invoicdetail.new_govcost` / `new_profit` ⇒ ربحية العامل في ملف 360 بتطرح جزء السكن على إنه تكلفة حكومية | `NewTS.xlsx` (AE/AF)، `EmployeeInsightService`, `EmployeeComparisonService` | 🟠 | أسماء ومعاني صحيحة للمكونات |
| 5.11 | **277 سطر فاتورة (4.2% من 2026-06) اتعدل مبلغها يدويًا في الـ Excel** خارج المعادلة، و140 سطر `FeesDays ≠ WorkingDays` | تحقق المعادلات على `new_invoicdetail` | 🔴 | تعديلات بنوع وسبب واعتماد بس |
| 5.9 | VAT بيتحسب في ملف Excel (عمود `Vat Rate`/`Vat Amount`)، ومافيش ZATCA | `AttendanceInvoiceImportService.GetMappedVatAmount` | 🔴 (امتثال) | محرك ضريبة + ZATCA Phase 2 |

## 6. هوية العامل والبيانات الأساسية

| # | المشكلة | الدليل | الأولوية | الحل |
|---|---|---|---|---|
| 6.1 | أرقام العمال نص (`new_empidnumber` `BSS002862`، `new_laborsnumber`) ومافيش مفتاح طبيعي موحد؛ العامل بيتعرف بـ 7 أرقام مختلفة | | 🟠 | `employee_id` داخلي + جدول identifiers (iqama, passport, border, visa…) بقيود unique |
| 6.2 | جوازات مكررة | **7** أرقام جواز مكررة (الإقامة والرقم الوظيفي مفيهمش تكرار) | 🟠 | unique constraint + شاشة دمج |
| 6.3 | بيانات ناقصة على العامل | 525 عامل راتب صفر، 2,266 سعر خدمة صفر، 16 بدون مشروع، 4 بدون إقامة | 🟠 | validation إجباري حسب الحالة |
| 6.4 | بيانات تاريخية 2018–2019 مختلفة الشكل | 2,868 مباشرة من 2018–2019: 2,861 بدون مشروع، كلها بدون سعر وبدون أمر تسليم | 🟡 | ترحيلها كأرشيف read-only أو تجاهلها |
| 6.5 | "المرشح" و"الموظف" نسختين من نفس الشخص (3,228 لكل منهم) والـ workflows بتزامنهم في الاتجاهين | `create candidate from employee`, `إنشاء موظف من عامل`, `updatecandedate` | 🟡 | Person واحد + مرحلة توظيف |

## 7. المستخدمين والصلاحيات والتدقيق

| # | المشكلة | الدليل | الأولوية | الحل |
|---|---|---|---|---|
| 7.1 | **مستخدمين مكررين** | 6 أسماء دخول (`domainname` بعد `\`) مكررة على كل المستخدمين (المفعّلين مفيهمش تكرار)؛ 261 مستخدم و 31 بس مفعّلين | 🟠 | ربط واحد بـ Entra/AD object id |
| 7.2 | مطابقة المستخدم تقريبية: `ResolveSystemUserId` بيدور بـ `fullname LIKE '%name%'` و `domainname LIKE '%user%'` و `TOP 1` ⇒ ممكن يجيب مهام مستخدم تاني؛ وفحص الـ Team بيقبل `FullName`/`YomiFullName`/بادئة الإيميل | `CrmApprovalService`, `PortalPermissionService` | 🔴 (أمني) | هوية بالـ object id |
| 7.3 | **الإنشاء باسم المستخدم بيفشل أحيانًا** ويرجع لحساب الخدمة: "Cannot insert duplicate key" في إنشاء التسكين (6 مرات في لوج 2026-10) | `App_Data\logs\create-as-user-202610.log` | 🟠 | audit columns من الـ identity مباشرة |
| 7.4 | **كل فواتير 2026 (697) منشئها حساب الخدمة** `c it` — مافيش أثر مين عمل الفاتورة | `new_invoice.CreatedByName` | 🟠 | audit trail لكل عملية |
| 7.5 | **كتابة SQL مباشرة على جداول/views الـ CRM** (`UPDATE new_employee`, `UPDATE new_empwork`, `UPDATE new_invoicdetailBase`) بتتخطى الـ workflows والـ audit والـ cache — وصفحة العامل بتكتب رصيد الإجازة **كل ما تتفتح** | `HR_EmployeeDetails` (3 أماكن)، `ProjectServicePriceUpdateService`, `AttendanceInvoiceImportService` | 🔴 | كل كتابة عن طريق domain service بأحداث |
| 7.6 | باسورد حساب خدمة الـ CRM مكتوب **نص صريح** في `Web.config`، والـ app pool ليه صلاحية كتابة على قاعدة الـ CRM | `Web.config` (`username`/`password`) | 🔴 (أمني) | Managed identity / Key Vault، وأقل صلاحيات |
| 7.7 | SQL مبني بتجميع نصوص في أماكن (`GetOptionSetLookup` بـ `string.Format`، `GetLookUpSearchMultiColumns` بأسماء أعمدة، `UPDATE … string.Join`) — المدخلات داخلية حاليًا بس النمط خطر | `GlobalCode`, `AttendanceInvoiceImportService` | 🟡 | ORM/parameters فقط |

## 8. منطق مخفي وثوابت

| # | المشكلة | الدليل | الأولوية | الحل |
|---|---|---|---|---|
| 8.1 | منطق تشغيلي مهم جوه 58 workflow (XAML) — تغيير حالات، إنشاء سجلات، تواريخ، وقف رواتب — مش ظاهر لحد | [04 §11](04-processes-and-approvals.md#11-منطق-مخفي-يجب-نقله-صراحة-checklist) | 🔴 | domain events + workflow engine (Elsa) بتعريفات مقروءة ومتوثقة |
| 8.2 | ثوابت في الكود: كود المشروع `pro00137`، `HeadOffice`، `BS%`، بداية التقارير `2026-07-01`، أقل سعر خدمة 1,000، 30 يوم، 3 أيام للتأخير، 60 يوم للتنبيه | [05 §0](05-reports-and-kpis.md#0-قواعد-مشتركة-في-كل-التقارير) | 🟠 | إعدادات/سياسات في جداول |
| 8.3 | المشاريع الداخلية بتتعرف بالكود في مكان وبالاسم في مكان | `ManagementDashboardService` vs `DashboardQueryService` | 🟠 | علامة `is_internal` على المشروع |
| 8.4 | التكامل بالـ Excel (قوالب بأسماء أعمدة فيها مسافات مزدوجة: `Basic  Salary`, `Food   Allowance`, `Other   Allowance`) + ACE OLEDB على السيرفر | `GlobalCode.AddTemplateAttendanceColumns`, `MonthlyAttendanceService` | 🟡 | واجهة تحضير داخل النظام + بوابة عميل، والـ Excel تصدير/استيراد اختياري بقالب versioned |
| 8.5 | تكامل أجير وصفحات خارجية عن طريق `CallPageUrl` (HTTP لـ `192.168.2.6:8001`) من جوه الـ workflow | XAML | 🟠 | integration services بـ retry وlog |

## 9. استخدام ضعيف (معناه إن الشغل بيحصل برا النظام)

| الكيان | السجلات | ملاحظة |
|---|---|---|
| `new_attendance` (حضور الإدارة) | 239 — كلهم من استيراد واحد يوم 2026-06-29 | الحضور اليومي مش شغال فعليًا |
| `new_leaverequest` | 6 | |
| `hr_vicrequest` | 30 (عداد `hr_reqnumber` وصل 691 ⇒ أغلب الطلبات القديمة مش موجودة) | |
| `new_paymentreceipt` | 1 | التحصيل برا النظام |
| `new_agent` | 9 كلهم في أول مرحلة اعتماد | |

## 10. ملخص الأولويات للتصميم الجديد
1. **Period Ledger** + توليد الفترات من الأحداث (يحل 1.1–1.8، 3.1–3.2).
2. **سطور أمر التسليم بأسعار + rate card للعقد** (2.1–2.4).
3. **أكواد حالات ثابتة** وفصل حالة العامل عن الفترة (4.1–4.6، 1.7).
4. **فصل الرواتب عن الفوترة**، و AR حقيقي (سندات وتوزيع)، و ZATCA (5.3، 5.7، 5.9).
5. **هوية وصلاحيات بالـ object id** + audit trail + إزالة الأسرار من الإعدادات (7.x).
6. **نقل منطق الـ workflows** لكود/تعريفات مقروءة (8.1).
