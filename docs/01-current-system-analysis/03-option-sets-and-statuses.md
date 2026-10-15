# 03 — الـ Option Sets والحالات، وأماكن المطابقة بنص الـ Label

> المصدر: `StringMap` (LangId 1025 عربي / 1033 إنجليزي) لكل الكيانات اللي البوابة بتستخدمها، + فحص الكود بالكامل (`*.cs`, `*.ashx`) عن أي مقارنة على الـ label.
> القيم اللي فيها "—" معناها الـ label **ناقص** في اللغة دي في الـ CRM.

## 1. أهم الحالات وتوزيعها الفعلي (2026-10-15)

| الكيان | الحالة (`statuscode`) | العدد |
|---|---|---|
| `new_employee` | 100000000 على رأس العمل | 2,558 |
| | 279640003 تم إنهاء خدماته | 316 |
| | 1 جديد | 126 |
| | 279640007 خروج نهائي | 100 |
| | 100000001 Vacation | 51 |
| | 279640013 Suspended | 38 |
| | 279640000 مرتجع (في السكن) | 31 |
| | 279640025 تم نقل كفالته | 5 |
| | 279640001 في السكن (حديث) | 3 |
| `new_empwork` | 100000000 تم تأكيد المباشرة | 7,032 |
| | 1 في انتظار التأكيد | 1 |
| `new_deliverorder` | 279640001 تم التسليم | 1,205 |
| | 279640003 لم يتم التسليم | 37 (منهم 9 اتعمل لهم مباشرات!) |
| | 279640009 إرسال لمسؤول التسليم | 24 |
| | 279640011 Send To Operation Manager To Approve | 1 |
| `mw_lodginorderdetails` | 100000009 approved | 966 |
| | 100000002 للتحقيق HR | 24 |
| | 100000008 أرسل لمشرف المشروع | 9 |
| | 100000007 لفريق التحقيق | 7 |
| | 100000004 الغاء | 6 |
| | 1 في انتظار موافقة مشرف المشروع | 1 |
| `new_invoice` | 279640004 تم التحصيل بالكامل | 419 |
| | 279640007 Cancelled ملغية | 193 |
| | 279640008 انتظار التحصيل | 64 |
| | 1 قيد الإعداد | 22 |
| | 279640003 تحصيل جزئي | 12 |
| | 279640002 / 279640001 / 2 | 2 / 1 / 2 |
| `hr_vicrequest` | 100000022 جديد 8، 100000002 رفض 6، 100000010 موافقة 3، 100000026 انتظار التصفية 3، 100000034 تم الرفض 3، أخرى 7 | 30 |
| `new_leaverequest` | 100000002 / 100000006 / 100000012 | 2 / 2 / 2 |
| `task.new_approvestatus` | 2 موافقة: 7,022 — 3 رفض: 267 — 1 انتظار (مفتوحة): 174 | |

## 2. المطابقة بنص الـ Label بدل القيمة (Label-text matching)

البوابة بتستخدم دالتين **مكتوبتين يدويًا داخل قاعدة الـ CRM**: `dbo.getOptionSetDisplay(attr, entity, value)` (عربي) و `dbo.getOptionSetDisplayen(...)` (إنجليزي) — 122 و 106 استدعاء في الكود. الدالتين بترجّعوا `varchar` (المتغير الداخلي `varchar(50)`) ⇒ أي label أطول من 50 حرف بيتقص، والعربي شغال بس لأن الـ collation `Arabic_CI_AI` (code page 1256).

### 2.1 في SQL (مجمعة)

| الحقل | اللغة | الشرط | عدد المرات | الملفات |
|---|---|---|---|---|
| `mw_lodginorderdetails.statuscode` | ar | `LIKE N'%اعتماد%'` | 18 | EmployeeMovementValidationService.cs, GlobalCode.cs, HR_EmployeeDetails.aspx.cs, ManagementDashboardService.cs, SalesProjectDetailsService.cs |
| `mw_lodginorderdetails.statuscode` | ar | `LIKE N'%معتمد%'` | 18 | EmployeeMovementValidationService.cs, GlobalCode.cs, HR_EmployeeDetails.aspx.cs, ManagementDashboardService.cs, SalesProjectDetailsService.cs |
| `mw_lodginorderdetails.statuscode` | ar | `NOT LIKE N'%إلغاء%'` | 19 | EmployeeMovementValidationService.cs, GlobalCode.cs, HR_EmployeeDetails.aspx.cs, HousingOrderQueryService.cs, ManagementDashboardService.cs, SalesProjectDetailsService.cs |
| `mw_lodginorderdetails.statuscode` | ar | `NOT LIKE N'%الغاء%'` | 19 | EmployeeMovementValidationService.cs, GlobalCode.cs, HR_EmployeeDetails.aspx.cs, HousingOrderQueryService.cs, ManagementDashboardService.cs, SalesProjectDetailsService.cs |
| `mw_lodginorderdetails.statuscode` | en | `<> 'canceled'` | 20 | EmployeeMovementValidationService.cs, GlobalCode.cs, HR_EmployeeDetails.aspx.cs, HousingOrderQueryService.cs, ManagementDashboardService.cs, NewArrivalsDashboardService.cs, SalesProjectDetailsService.cs |
| `mw_lodginorderdetails.statuscode` | en | `= 'approved'` | 18 | EmployeeMovementValidationService.cs, GlobalCode.cs, HR_EmployeeDetails.aspx.cs, ManagementDashboardService.cs, SalesProjectDetailsService.cs |
| `mw_lodginorderdetails.statuscode` | en | `NOT LIKE '%ancel%'` | 3 | Attendance.aspx.cs, AttendanceDetails.aspx.cs, FinanceReportService.cs |
| `new_invoice.statuscode` | ar | `NOT LIKE N'%إلغاء%'` | 3 | EmployeeInsightService.cs, EmployeeLifecycleService.cs, ManagementDashboardService.cs |
| `new_invoice.statuscode` | ar | `NOT LIKE N'%الغاء%'` | 3 | EmployeeInsightService.cs, EmployeeLifecycleService.cs, ManagementDashboardService.cs |
| `new_invoice.statuscode` | ar | `NOT LIKE N'%ملغ%'` | 10 | FinanceReportService.cs, ManagementDashboardService.cs, SalesProjectDetailsService.cs |
| `new_invoice.statuscode` | ar | `NOT LIKE N'%ملغي%'` | 3 | EmployeeInsightService.cs, EmployeeLifecycleService.cs, ManagementDashboardService.cs |
| `new_invoice.statuscode` | en | `<> 'canceled'` | 5 | EmployeeComparisonService.cs, EmployeeInsightService.cs, EmployeeLifecycleService.cs, ManagementDashboardService.cs |
| `new_invoice.statuscode` | en | `NOT LIKE '%ancel%'` | 7 | Attendance.aspx.cs, AttendanceDetails.aspx.cs, FinanceReportService.cs, SalesProjectQueryService.cs |
| `new_invoice.statuscode` | en | `NOT LIKE '%cancel%'` | 10 | FinanceReportService.cs, ManagementDashboardService.cs, SalesProjectDetailsService.cs |

**الأثر الفعلي:**
- "أمر تسكين معتمد" = `getOptionSetDisplayen(...) = 'approved'` **أو** العربي فيه "معتمد"/"اعتماد". عمليًا مفيش ولا label عربي للتسكين فيه الكلمتين دول، والـ label العربي لـ 100000009 **فاضي**، فالشرط كله معتمد على الكلمة الإنجليزية `approved` = القيمة **100000009** بس. لو حد عدّل الـ label في الـ CRM هتقع كل التقارير والتحضير والتحقق من الحركة.
- الحالة 100000000 عربي "تمت الموافقة من مشرف المشروع" لكن إنجليزي "Send To Sales Manager" — الـ labels نفسها متناقضة.
- الـ label العربي لحالة الفاتورة الملغاة 279640007 **فاضي** (الإنجليزي "Cancelled ملغية")، فشروط `NOT LIKE N'%ملغ%'` على العربي مابتشيلش حاجة، والشرط `<> 'canceled'` (بـ L واحدة) **مابيطابقش** "Cancelled ملغية" — الفلترة الفعلية جاية من `NOT LIKE '%cancel%'` أو `statuscode <> 279640007` لما يكونوا موجودين في نفس الاستعلام.
- الفواتير الملغاة بتتشال بـ 4 طرق مختلفة (`statuscode <> 279640007`، `NOT LIKE '%cancel%'`، `NOT LIKE '%ancel%'`، `NOT LIKE N'%ملغ%'`/`%ملغي%`/`%الغاء%`/`%إلغاء%`) حسب الملف.
- نفس الشرط متكرر بنسخ (copy/paste) في 6+ ملفات: `EmployeeMovementValidationService`, `GlobalCode`, `HR_EmployeeDetails`, `ManagementDashboardService`, `SalesProjectDetailsService`, `HousingOrderQueryService`.

### 2.2 في C# (Contains/StartsWith على نص عربي)

| النص المطابَق | الملفات |
|---|---|
| `إجاز` | VacationRequestService.cs |
| `إجازة` | Sales_ProjectDetails.aspx.cs |
| `إلغاء` | EmployeeLifecycleService.cs |
| `اجاز` | VacationRequestService.cs |
| `اجازة` | Sales_ProjectDetails.aspx.cs |
| `استقال` | HR_VacationRequestDetails.aspx.cs, VacationRequestService.cs |
| `اعتماد` | VacationRequestService.cs |
| `الجمعة` | MonthlyAttendanceService.cs |
| `السبت` | MonthlyAttendanceService.cs |
| `السكن` | Sales_ProjectDetails.aspx.cs |
| `الغاء` | EmployeeLifecycleService.cs |
| `انتظار` | HR_VacationRequestDetails.aspx.cs, HousingOrderQueryService.cs, LeaveRequestService.cs, Operations_TransferDetails.aspx.cs, VacationRequestService.cs |
| `انتظارالتصفية` | HR_VacationRequestDetails.aspx.cs |
| `تأجيري` | Operations_HousingManagerDetails.aspx.cs |
| `تاجيري` | Operations_HousingManagerDetails.aspx.cs |
| `تم` | HousingOrderQueryService.cs, Operations_TransferDetails.aspx.cs |
| `جديد` | HR_VacationRequestDetails.aspx.cs, Operations_TransferDetails.aspx.cs, Sales_ProjectDetails.aspx.cs, VacationRequestService.cs |
| `خروج` | Operations_TransferDetails.aspx.cs |
| `خروج نهائي` | Sales_ProjectDetails.aspx.cs |
| `خروجنهائ` | HR_VacationRequestDetails.aspx.cs, HR_VacationRequest_Create.aspx.cs, LookupService.cs, VacationRequestService.cs |
| `خروجنهائي` | HR_VacationRequestDetails.aspx.cs, HR_VacationRequest_Create.aspx.cs, LookupService.cs, VacationRequestService.cs |
| `خروجوعودة` | LookupService.cs |
| `داخلي` | LookupService.cs |
| `رجع` | EmployeeComparisonService.cs, EmployeeInsightService.cs, EmployeeLifecycleService.cs, HR_EmployeeTracking.aspx.cs, ManagementDashboard.aspx.cs, ManagementDashboardMobile.aspx.cs |
| `رجيع` | Operations_Housing_Create.aspx.cs |
| `رفض` | EmployeeLifecycleService.cs, LeaveRequestService.cs, VacationRequestService.cs |
| `عطلة` | MonthlyAttendanceService.cs |
| `على رأس العمل` | Sales_ProjectDetails.aspx.cs |
| `عمليات` | HR_VacationRequestDetails.aspx.cs |
| `عميل` | HR_VacationRequestDetails.aspx.cs |
| `غياب` | MonthlyAttendanceService.cs |
| `في السكن` | Operations_Housing_Create.aspx.cs, Operations_TransferDetails.aspx.cs |
| `للشركة` | Operations_HousingManagerDetails.aspx.cs |
| `لمشروع` | Operations_HousingManagerDetails.aspx.cs |
| `محلي` | LookupService.cs |
| `مراجعة` | HR_VacationRequestDetails.aspx.cs |
| `مراجعةالعمليات` | HR_VacationRequestDetails.aspx.cs |
| `مرفوض` | EmployeeLifecycleService.cs, HousingOrderQueryService.cs, Operations_TransferDetails.aspx.cs |
| `معتمد` | LeaveRequestService.cs |
| `معلق` | HousingOrderQueryService.cs, Operations_TransferDetails.aspx.cs |
| `ملغ` | Attendance.aspx.cs, AttendanceDetails.aspx.cs, EmployeeLifecycleService.cs, HR_PayrollInvoices.aspx.cs, Sales_ProjectDetails.aspx.cs |
| `منتهي` | Operations_TransferDetails.aspx.cs |
| `موافق` | VacationRequestService.cs |
| `موافقة` | HR_VacationRequestDetails.aspx.cs |
| `موافقةالعميل` | HR_VacationRequestDetails.aspx.cs |
| `موقوف` | Sales_ProjectDetails.aspx.cs |
| `هروب` | Sales_ProjectDetails.aspx.cs |

أمثلة مهمة:
- نوع طلب الإجازة بيتعرف من النص بعد شيل المسافات: `خروجنهائي` / `خروجنهائ` / `استقال` / `خروجوعودة` / `داخلي` (`VacationRequestService`, `LookupService`) — ده اللي بيحدد هل يتحسب **مكافأة نهاية الخدمة** ولا بدل إجازة!
- اعتماد الاستئذان = النص فيه `معتمد` أو `موافق` (`LeaveRequestService.IsApprovedStatusText`، `PayrollService`).
- أيام العطلة في الحضور = النص فيه `الجمعة` / `السبت` / `عطلة` / `غياب` (`MonthlyAttendanceService`).
- السكن التجاري = اسم النوع `سكن تجاري` / `سكن  تجاري` (بمسافتين) / `Commercial Housing` (`HousingManagerService`)، والتأجيري = `تأجيري`/`تاجيري`.
- حالة العامل "على رأس العمل" في الرواتب = `LIKE '%hiring%worker%'` على الـ label الإنجليزي.

### 2.3 قيم مكتوبة كأرقام ثابتة في الكود (Hard-coded)

| القيمة | المعنى | الملفات |
|---|---|---|
| `new_employee.statuscode IN (279640000, 279640001)` | "في السكن" | `ManagementDashboardService` (5)، `HrEmployeeQueryService`, `EmployeeService` |
| `100000000` / `100000001,279640014` / `279640013,279640018` | قوة العمل الحالية (على رأس العمل + إجازة + موقوف/مريض) | `DashboardQueryService.CurrentStatusCodes`، `SalesProjectQueryService` |
| `new_invoice.statuscode`: 279640002/3/4/7/8 | مرسلة/جزئي/كلي/ملغية/انتظار تحصيل | `EmployeeInvoices.ashx`, `Attendance`, `HR_PayrollInvoices`, `Sales_ProjectDetails` |
| `new_deliverorder.statuscode` 279640011 / 279640001 | الشاشة بتعرض الحالتين دول بس، أي حالة تانية "غير محدد" (حتى "لم يتم التسليم") | `TransferOrderQueryService.GetStatusText` |
| `mw_lodginorderdetails.new_entertype` 100000000/1/2 | نوع الدخول | `Operations_Housing_Create`, `ManagementDashboardService` (CASE عربي ثابت) |
| `task.new_approvestatus` 2 / 3 | موافقة / رفض | `CrmApprovalService` |
| `new_invoice.new_invoicetype = 100000000` و `new_whowillpay = 1` | Project Invoice — **حتى لمسير الرواتب** | `AttendanceInvoiceImportService`, `PayrollService` |
| `new_project.new_businesstype = 1` | قطاع الأعمال عند إنشاء مشروع | `CrmCreateService.CreateProject` |
| كود مشروع `pro00137` و `HeadOffice`، أسماء `InActive Employee`/`HeadOffice`/`Head Office (Care-Pro)` | مشاريع داخلية تستبعد من التقارير | `ManagementDashboardService` (بالكود)، `DashboardQueryService` (بالاسم) — **قاعدتين مختلفتين** |
| رقم الموظف `LIKE 'BS%'` | عمالة قطاع الأعمال | `ManagementDashboardService` |

### 2.4 قيم موجودة في البيانات ومش موجودة في الـ Option Set (Orphans)

`mw_lodginorderdetails.new_backreason`: القيم **2 (40 سجل)، 3 (27)، 5 (4)، 279640003 (67)، 279640004 (7)** مستخدمة في 145 أمر تسكين لكن مالهاش label في `StringMap` ⇒ بتظهر "غير محدد" في تقارير أسباب الرجيع.

## 3. كل الـ Option Sets المستخدمة (القيم والـ labels)

#### `new_employee.new_housing`

| القيمة | العربي | English |
|---|---|---|
| 100000000 | — | العامل في السكن |
| 100000001 | — | العامل خارج السكن |

#### `new_employee.new_sponseredby`

| القيمة | العربي | English |
|---|---|---|
| 100000000 | — | Care-Pro - 05 |
| 100000001 | — | Esad - 01 |
| 100000002 | — | IRC - 02 |
| 100000003 | — | JAWA - 03 |
| 100000004 | — | Mehan - 14 |
| 100000005 | — | Riadty - 09 |
| 100000006 | — | Watan - 12 |
| 100000007 | — | Ewan - 13 |
| 100000008 | — | Care-pro - 07 |
| 100000009 | — | Maharah - 15 |

#### `new_employee.statuscode`

| القيمة | العربي | English |
|---|---|---|
| 1 | جديد | New |
| 2 | غير نشط | dead |
| 100000000 | على رأس العمل | Hiring Worker |
| 100000001 | Vacation | Vacation |
| 100000004 | هروب | Escaped |
| 279640000 | مرتجع | in Housuing Back Labor |
| 279640001 | في السكن | In Housing-new |
| 279640003 | تم إنهاء خدماته | End Of service |
| 279640007 | خروج نهائي | 🔴 Final Exit |
| 279640009 | خرج ولم يعد | NRBFV |
| 279640010 | في السجن | In Jail |
| 279640011 | متوفي | Daed |
| 279640012 | جاري تسويقه | in housing Remepolize |
| 279640013 | Suspended | Suspended |
| 279640014 | Client Vacation | Client Vacation |
| 279640015 | ON Branches(في الفرع) | ON Branches(في الفرع) |
| 279640016 | Sended To Branches(مرسلة الى الفرع) | Sended To Branches(مرسلة الى الفرع) |
| 279640018 | مريض | مريض |
| 279640019 | — | Worker Temp Housing |
| 279640020 | — | In Housing Reserved |
| 279640025 | تم نقل كفالته | تم نقل كفالته |
| 279640026 | — | خروج نهائي / فيرس سي |

#### `new_empwork.statuscode`

| القيمة | العربي | English |
|---|---|---|
| 1 | في إنتظار التأكيد | Active |
| 2 | غير نشط | Inactive |
| 100000000 | تم تأكيد المباشرة | تم تأكيد المباشرة |

#### `new_deliverorder.statuscode`

| القيمة | العربي | English |
|---|---|---|
| 1 | نشط | Active |
| 2 | غير نشط | Inactive |
| 279640000 | قيد الاعداد | Under preparation |
| 279640001 | تم التسليم | Delivered |
| 279640002 | إرسال إلى نائب الرئيس | Send to audit management |
| 279640003 | لم يتم التسليم | Not delivered |
| 279640006 | العماله المحجوزة | Reserved Labors |
| 279640007 | ارجاع للمبيعات | Return To Sales Man |
| 279640009 | ارسال الى مسؤول التسليم | Send to the delivery administrator |
| 279640010 | أرسل إلى منسق المبيعات | Send To Sales Coordinator |
| 279640011 | — | Send To Operation Manager To Approve |

#### `mw_lodginorderdetails.new_backreason`

| القيمة | العربي | English |
|---|---|---|
| 1 | العامل رافض للعمل | worker refuses to work |
| 4 | أخرى | other |
| 6 | مريض | Sick |
| 100000000 | — | Return From Vacation |
| 100000001 | جازة سنوية | Annual Vacation |
| 100000002 | اساءة الى العامل | Abuse of the worker |
| 100000010 | — | Vacation |
| 100000011 | — | EndOf Service |
| 100000012 | — | Final Exit |
| 279640000 | العميل ارجع العامل بدون سبب | The client returns the worker for no reason |
| 279640002 | إلغاء التعاقد مع العميل | Cancel the contract with the client |

#### `mw_lodginorderdetails.new_delay`

| القيمة | العربي | English |
|---|---|---|
| 1 | — | yes |
| 2 | — | No |

#### `mw_lodginorderdetails.new_entertype`

| القيمة | العربي | English |
|---|---|---|
| 100000000 | حديث الوصول | New Arrival |
| 100000001 | عامل مرتجع | Back Labor |
| 100000002 | عائد من اجازة | Return From Vacation |

#### `mw_lodginorderdetails.new_housingstatus`

| القيمة | العربي | English |
|---|---|---|
| 1 | فى السكن | In Housing |
| 2 | تسليم للعميل | Deliver To Customer |
| 3 | خروج نهائى | Final Exit |
| 4 | هروب | Escaped |
| 5 | أخرى | Other |
| 100000000 | إنتقال لسكن آخر للشركة | Moved to another houing |

#### `mw_lodginorderdetails.statuscode`

| القيمة | العربي | English |
|---|---|---|
| 1 | في إنتظار موافقة مشرف المشروع | Waiting Approval |
| 2 | غير نشط | In Active |
| 100000000 | تمت الموافقة من مشرف المشروع | Send To Sales Manager |
| 100000002 | أرسل إلى قسم الموارد البشرية للتحقيق | Send To HR Department For Investigation |
| 100000003 | ارجاع للمبيعات | Return To Sales Man |
| 100000004 | الغاء | Canceled |
| 100000005 | العامل لم يصل الى السكن | Labor didn't arrive to Housing |
| 100000006 | ارسال الى المبيعات | Send To Sales Man |
| 100000007 | إرسال إلى فريق التحقيق | Send to Investgation Team |
| 100000008 | أرسل إلى مشرف المشروع | Send to Project Supervisor |
| 100000009 | — | approved |

#### `mw_housing.new_housingtype`

| القيمة | العربي | English |
|---|---|---|
| 100000000 | — | سكن الشركة |
| 100000001 | — | سكن تجاري |

#### `mw_housing.statuscode`

| القيمة | العربي | English |
|---|---|---|
| 1 | نشط | Active |
| 2 | غير نشط | In Active |

#### `new_invoice.new_invoicetype`

| القيمة | العربي | English |
|---|---|---|
| 100000000 | Project Invoice | Project Invoice |
| 100000001 | Cash Payroll | Cash Payroll |
| 100000002 | — | فاتورة تكاليف |
| 100000003 | — | employee payroll |

#### `new_invoice.new_whowillpay`

| القيمة | العربي | English |
|---|---|---|
| 1 | شركة الاستقدام | Recruitment Company |
| 2 | العميل | Customer |
| 3 | المنشط نحن, الغير منشط العميل | Active User , Not Active Customer |
| 4 | جزء وجزء | جزء وجزء |

#### `new_invoice.statuscode`

| القيمة | العربي | English |
|---|---|---|
| 1 | قيد الإعداد | Under Preparation |
| 2 | غير نشط | In Active |
| 279640000 | إرسال إلى المالية | Send to Finance |
| 279640001 | قيد المراجعة من المالية | Under Finance Review |
| 279640002 | تم الإرسال إلى العميل | Send to Customer To Approve |
| 279640003 | تم تحصيل جزئي | Partially Collected / تحصيل جزئي |
| 279640004 | تم التحصيل بالكامل | Fully Collected / تم التحصيل |
| 279640005 | تمت المراجعة من المالية | Reviewed By Finance |
| 279640006 | — | Send To Project Supervisor |
| 279640007 | — | Cancelled ملغية |
| 279640008 | — | Waite Paid / انتظار التحصيل |

#### `new_invoicdetail.statuscode`

| القيمة | العربي | English |
|---|---|---|
| 1 | نشط | Active |
| 2 | غير نشط | InActive |

#### `hr_vicrequest.new_exist`

| القيمة | العربي | English |
|---|---|---|
| 1 | خروج نهائي قبل نهاية العقد | Final Exit /خروج نهائي |
| 2 | خروج وعودة قبل نهاية العقد | Re-entry /خروج وعودة |
| 3 | إجازة داخلية | Local vication / اجازة داخلية |
| 4 | نهاية العقد خروج-عودة | . |
| 5 | التصفية بدون اجازات | .. |
| 6 | خروج نهائى لنهاية العقد | . |
| 100000000 | خروج نهائى 640 | . |
| 100000001 | التصفية بعد الاجازات | . |
| 100000002 | مسافر مع العميل | . |

#### `hr_vicrequest.new_vacationtype`

| القيمة | العربي | English |
|---|---|---|
| 1 | نعم يحتاج لتصفية | Yes need settelment |
| 2 | لا يحتاج تصفية | No need settelment |
| 100000000 | يوجد إلتزام خطي من العميل | There is a written commitment from the client |

#### `hr_vicrequest.statuscode`

| القيمة | العربي | English |
|---|---|---|
| 1 | تم الإرسال للمدير العمليات | Send to Direct Manager |
| 2 | غير نشط | Not Active |
| 100000000 | مسئول عمليات الموارد البشرية | Responsible HR operations |
| 100000002 | تم رفض الأجازة | Rejected |
| 100000005 | إرسال إلى المالية | Send to E-Finance |
| 100000006 | إرسال إلى الرواتب | Send to salaries |
| 100000007 | إرسال إلى مسئول الحساب | Send to the Account Representitive |
| 100000009 | مرسل للشئون القانونية | Send to legal affairs |
| 100000010 | تمت الموافقة | Approved |
| 100000012 | تم الإرسال الى الموارد البشرية | Sent to HR |
| 100000015 | ارسال الى مسئول العلاقات الحكومية | Send To Gov Relations |
| 100000017 | — | Return to Vacation Owner To Review |
| 100000018 | — | send to HR Manager |
| 100000019 | — | Send To Finance To Make Clearance |
| 100000020 | — | الارسال لاخذ رد الموظف |
| 100000021 | — | مراجعة التصفية |
| 100000022 | — | جديد |
| 100000023 | — | انتظار موافقة العميل |
| 100000024 | — | انتظار تعميد المدير المباشر |
| 100000025 | — | انتظار مراجعة العمليات |
| 100000026 | — | انتظار التصفية |
| 100000027 | — | تعميد مدير الموارد البشرية |
| 100000028 | — | اعتماد المالية |
| 100000029 | — | تعميد المدير التفيذي |
| 100000030 | — | انتظار صرف المستحقات |
| 100000031 | — | اصدار التأشيرة |
| 100000032 | — | انتظار إخطار العامل |
| 100000033 | — | تمت الموافقة |
| 100000034 | — | تم الرفض |
| 100000035 | — | توقيع العامل علي المحالصة |
| 100000036 | — | تسليم المستندات للعامل |

#### `new_leaverequest.new_leavetype`

| القيمة | العربي | English |
|---|---|---|
| 100000000 | تأخير | delay |
| 100000001 | خروج | Exit |
| 100000002 | اجازة سنوية  تخصم من رصيد الاجازات | Absence - Deduction from Vacation Balance |
| 100000003 | مهمة عمل | Job Assignment |
| 100000004 | أجازة / إستئذان مرضى | Sick Absence |
| 100000005 | أجازة أخرى | Other Vacation |

#### `new_leaverequest.statuscode`

| القيمة | العربي | English |
|---|---|---|
| 1 | إرسال إلى المدير المباشر | Active |
| 2 | غير نشط | Inactive |
| 100000000 | إرسال إلى الموارد البشرية | Send to HR |
| 100000001 | تمت موافقة الموارد البشرية | Approved From HR |
| 100000002 | تم الرفض | Rejected |
| 100000003 | إرجاع الطلب للأسباب | Returns demand for the reasons |
| 100000004 | ارسل الي المدير | Send to Manager |
| 100000005 | جديد | New |
| 100000006 | ارسال إلى مسئولى Headoffice Timesheet | Send to Time Sheet Head Office |
| 100000007 | موافقه من المدير | Approved from Manager |
| 100000009 | موافقه من مسؤل الكيلن الرئيسي | Approved From Time Sheet Head Office |
| 100000010 | ارسل الي ceo | Send To CEO |
| 100000011 | موافقه من قبل ceo | Approved From CEO |
| 100000012 | إرسال إلى المدير المباشر | Send To Direct Manager |

#### `new_attendance.new_vacationtype`

| القيمة | العربي | English |
|---|---|---|
| 1 | مرضية | Morbidity |
| 3 | اضطرارية | Compelling |
| 4 | سنوية | Annual |
| 5 | الزواج | marriage |
| 6 | الوفاة | Death |
| 7 | المولود | Baby |
| 8 | غياب | Absence |
| 9 | اخرى | Other |

#### `new_attendance.statuscode`

| القيمة | العربي | English |
|---|---|---|
| 1 | نشط | نشط |
| 2 | غير نشط | غير نشط |

#### `new_project.new_businesstype`

| القيمة | العربي | English |
|---|---|---|
| 1 | قطاع الأعمال | Business sector |
| 2 | قطاع الأفراد | Individuals sector |
| 3 | الكيان الرئيسي | Head Office |

#### `new_project.new_contractstatus`

| القيمة | العربي | English |
|---|---|---|
| 1 | ساري | Valid |
| 100000000 | يرغب في التجديد | Wants to renewal |
| 100000001 | لا يرغب في التجديد | Does not want to renewal |
| 100000002 | تم إلغاء العقد | The contract is canceled |
| 100000003 | انتهت فترة العقد | Over the contract period |

#### `new_project.new_contracttype`

| القيمة | العربي | English |
|---|---|---|
| 1 | مبلغ مقطوع | Cost Plus |
| 2 | التكلفة الاجمالية | Total Cost |
| 3 | — | Total Cost multi Salaries |

#### `new_project.statuscode`

| القيمة | العربي | English |
|---|---|---|
| 1 | نشط | Active |
| 2 | غير نشط | InActive |

#### `new_agent.statuscode`

| القيمة | العربي | English |
|---|---|---|
| 1 | نشط | Active |
| 2 | غير نشط | InActive |
| 100000000 | إرسال إلى قسم الإستقدام | Send To Recruitment department |
| 100000001 | إرسال إلى الشئون القانونية | Send To Law Affairs |
| 100000002 | إرسال إلى المدير المالى | Send To Finance Manager |
| 100000003 | إرسال إلى نائب المدير | Send To V.P |
| 100000004 | تم الرفض | Rejected |
| 100000005 | إرسال إلى المدير العام | Send to General Manager |
| 100000006 | إرسال إلى نائب المدير المالى | Send To V.P.F |
| 100000007 | — | Approved From GM |

#### `new_candidate.new_sectortype`

| القيمة | العربي | English |
|---|---|---|
| 1 | الكيان الرئيسي | Head Office |
| 2 | قطاع الأعمال | Business sector |
| 3 | قطاع الأفراد | Individuals |
| 100000000 | قطاع الساعات | Hourly sector |
| 100000001 | قطاع نقل الكفالة | Sponsorship transfer sector |

#### `new_candidate.statuscode`

| القيمة | العربي | English |
|---|---|---|
| 1 | للترشيح | For Selecting |
| 2 | غير متاح | Not Available |
| 100000000 | في إنتظار تحديد موعد للمقابلة | waiting schedule interview |
| 100000001 | في إنتظار المقابلة | waiting interview |
| 100000002 | تم اختيار الموظف | Selected |
| 100000003 | في إنتظار الكشف الطبي في بلده | Waiting Medical Checkup |
| 100000004 | تم عمل الكشف الطبي | Medcial Checkup Done |
| 100000005 | في إنتظار موعد الحجز | Waiting Reservation |
| 100000006 | تم حجز موعد السفر | Reservation done |
| 100000007 | وصل العامل | Arrived |
| 100000008 | في انتظار التأشيرة | Waiting Visa Stamped |
| 100000009 | تحت إجراءات السفر | Under Processing |
| 100000010 | تم تفويض الوكيل للمشروع | Agent is Authorized |
| 279640000 | تأشيرة مسروقة | Other |
| 279640001 | فقد رحلة الطيران | Missed flight Plan |
| 279640002 | Problem In Data-Arrived | Problem In Data-Arrived |
| 279640003 | — | Reject From AirPort |
| 279640004 | — | Reject To Travel |
| 279640005 | — | Postponed |
| 279640006 | — | labor Deliver Visa From Embassy |

#### `new_ajeercontract.new_contractstatus`

| القيمة | العربي | English |
|---|---|---|
| 1 | نشط | Active |
| 2 | غير نشظ | InActive |
| 3 | انهاء/قفل | Terminated |
| 4 | موافقة | Accepted |
| 5 | تغير | Changed |
| 6 | رفض | Rejected |

#### `new_ajeercontract.statuscode`

| القيمة | العربي | English |
|---|---|---|
| 1 | نشط | active |
| 2 | غير نشط | Inactive |

#### `task.new_approvestatus`

| القيمة | العربي | English |
|---|---|---|
| 1 | فى إنتظار الموافقة | Waiting Approval |
| 2 | موافقة على المهمة √ | Approved √ |
| 3 | رفض المهمة X | Rejected X |
| 4 | تعيين لمستخدم آخر | Assigned to Another One |

#### `task.statuscode`

| القيمة | العربي | English |
|---|---|---|
| 2 | لم يتم البدء | Not Started |
| 3 | قيد التقدم | In Progress |
| 4 | في انتظار شخص آخر | Waiting on someone else |
| 5 | تم | Completed |
| 6 | تم الإلغاء | Canceled |
| 7 | مؤجل | Deferred |

#### `new_thijridate.new_housingtype` (نوع تسكين السرير)

| القيمة | English (الـ label متخزن بالعربي في خانة الإنجليزي) |
|---|---|
| 100000000 | سكن تاجيري |
| 100000001 | سكن لمشروع |
| 100000002 | سكن للشركة |

#### `new_thijridate.new_bedtype` (نوع السرير)

| القيمة | English |
|---|---|
| 100000000 | manger |
| 100000001 | normal labor |
| 100000002 | Supervisour |

## 4. توصيات للنظام الجديد
1. كل حالة = **enum/lookup table بكود ثابت** (`APPROVED`, `CANCELLED`…) والـ labels للعرض بس (عربي/إنجليزي) — ممنوع أي منطق على النص.
2. فصل "حالة الطلب في مسار الاعتماد" (Workflow state) عن "حالة العامل" (مشتقة من سجل الفترات) عن "حالة الدفع/التحصيل".
3. توحيد تعريف "ملغي" و"معتمد" و"المشاريع الداخلية" في مكان واحد (domain service) بدل تكراره في 6+ ملفات.
4. ترحيل القيم اليتيمة (`new_backreason` 2/3/5/279640003/279640004) لقيم معروفة بعد مراجعة مع العمليات.
