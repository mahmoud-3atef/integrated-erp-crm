using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.Modules.Leave.Contracts;
using IntegratedErp.BuildingBlocks.Alerts;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Payroll.Api;
using IntegratedErp.Modules.Payroll.Application;
using IntegratedErp.Modules.Payroll.Contracts;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Payroll;

/// <summary>
/// Payroll module (docs/02-target-architecture/09): the payroll runs of the company's workers, calculated from the
/// approved timesheets for a commercial registration and a period, and of the company's staff (4.8), calculated from
/// the closed attendance month; each approved through the company's process.
/// </summary>
public sealed class PayrollModule : IModule
{
    public string Name => PayrollContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<PayrollDbContext>(configuration, PayrollDbContext.SchemaName);
        services.AddScoped<PayrollService>();
        services.AddScoped<PayrollQueries>();
        services.AddScoped<IApprovalRecordAdapter, PayrollAdapter>();
        services.AddScoped<IntegratedErp.Modules.Workflow.Contracts.IEntitySource, PayrollEntities>();
        services.AddScoped<StaffPayrollService>();
        services.AddScoped<StaffPayrollQueries>();
        services.AddScoped<IApprovalRecordAdapter, StaffPayrollAdapter>();
        services.AddScoped<SettlementService>();
        services.AddScoped<SettlementQueries>();
        services.AddScoped<IApprovalRecordAdapter, SettlementAdapter>();
        services.AddScoped<ILeaveUsage, LeaveSettlements>();
        services.AddScoped<IStaffFileLocks, StaffFileLocks>();
        services.AddScoped<IWorkerPeriodLocks, WorkerPeriodLocks>();
        services.AddScoped<IApprovalRecordAdapter, WorkerSettlementAdapter>();
        services.AddScoped<GosiService>();
        services.AddScoped<PayslipService>();
        services.AddScoped<PayslipMailer>();
        services.AddAlertProvider<GosiAlerts>();
        services.AddPermissions(PayrollPermissions.All);
        services.AddNumberSequences(
            new NumberSequenceDefinition("payroll", PayrollDbContext.SchemaName, "الرواتب", "Payroll", "مسيرات الرواتب", "Payroll runs", "PR-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition(StaffPayrollService.Sequence, PayrollDbContext.SchemaName, "الرواتب", "Payroll", "مسيرات رواتب الموظفين", "Staff payroll runs", "SP-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition(SettlementService.VacationSequence, PayrollDbContext.SchemaName, "الرواتب", "Payroll", "مخالصات الإجازات", "Vacation settlements", "SV-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition(SettlementService.FinalSequence, PayrollDbContext.SchemaName, "الرواتب", "Payroll", "مخالصات نهاية الخدمة", "End-of-service settlements", "ST-{YYYY}-{N:5}", NumberReset.Yearly));
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPayrollEndpoints();
        endpoints.MapStaffPayrollEndpoints();
        endpoints.MapGosiEndpoints();
        endpoints.MapSettlementEndpoints();
    }
}

/// <summary>
/// Separate duties (09 §11): who calculates is not who reviews, approves or pays. The workers' payroll and the staff's
/// payroll have their own permissions.
/// </summary>
internal static class PayrollPermissions
{
    public const string WorkersView = "payroll.workers.view";
    public const string WorkersManage = "payroll.workers.manage";
    public const string WorkersReview = "payroll.workers.review";
    public const string WorkersFinance = "payroll.workers.finance";
    public const string WorkersApprove = "payroll.workers.approve";
    public const string SettingsManage = "payroll.settings.manage";
    public const string StaffView = "payroll.staff.view";
    public const string StaffManage = "payroll.staff.manage";
    public const string StaffApproveHr = "payroll.staff.approve.hr";
    public const string StaffApproveFinance = "payroll.staff.approve.finance";
    public const string StaffApproveManagement = "payroll.staff.approve.management";
    public const string GosiView = "payroll.gosi.view";
    public const string GosiManage = "payroll.gosi.manage";
    public const string GosiInvoice = "payroll.gosi.invoice";
    public const string PayslipsSend = "payroll.payslips.send";
    public const string SettlementsView = "payroll.settlements.view";
    public const string SettlementsManage = "payroll.settlements.manage";
    public const string SettlementsApproveHr = "payroll.settlements.approve.hr";
    public const string SettlementsApproveOperations = "payroll.settlements.approve.operations";
    public const string SettlementsApprovePayroll = "payroll.settlements.approve.payroll";
    public const string SettlementsApproveFinance = "payroll.settlements.approve.finance";
    public const string SettlementsPay = "payroll.settlements.pay";

    private const string GroupAr = "الرواتب";
    private const string GroupEn = "Payroll";

    public static readonly PermissionDefinition[] All =
    [
        new(WorkersView, GroupAr, GroupEn, "عرض مسيرات رواتب العمالة", "View the workers' payroll runs"),
        new(WorkersManage, GroupAr, GroupEn, "إنشاء مسيرات رواتب العمالة وإعادة حسابها وإرسالها", "Create, recalculate and send the workers' payroll runs"),
        new(WorkersReview, GroupAr, GroupEn, "مراجعة مسيرات رواتب العمالة (الموارد البشرية)", "Review the workers' payroll runs (HR)"),
        new(WorkersFinance, GroupAr, GroupEn, "الاعتماد المالي لمسيرات رواتب العمالة", "Finance approval of the workers' payroll runs"),
        new(WorkersApprove, GroupAr, GroupEn, "اعتماد الإدارة العليا لمسيرات رواتب العمالة", "Management approval of the workers' payroll runs"),
        new(SettingsManage, GroupAr, GroupEn, "إعدادات الرواتب: ربط الكفلاء، وقواعد الإضافي والتأخير، ونسب التأمينات", "Payroll settings: sponsor links, overtime and lateness rules, GOSI rates"),
        new(StaffView, GroupAr, GroupEn, "عرض مسيرات رواتب الموظفين", "View the staff payroll runs"),
        new(StaffManage, GroupAr, GroupEn, "إنشاء مسيرات رواتب الموظفين وحسابها وتسويتها وإرسالها", "Create, calculate, adjust and send the staff payroll runs"),
        new(StaffApproveHr, GroupAr, GroupEn, "اعتماد مسيرات رواتب الموظفين (الموارد البشرية)", "Approve the staff payroll runs (HR)"),
        new(StaffApproveFinance, GroupAr, GroupEn, "اعتماد مسيرات رواتب الموظفين (المالية)", "Approve the staff payroll runs (finance)"),
        new(StaffApproveManagement, GroupAr, GroupEn, "اعتماد مسيرات رواتب الموظفين (الإدارة العليا)", "Approve the staff payroll runs (senior management)"),
        new(GosiView, GroupAr, GroupEn, "عرض التأمينات الاجتماعية والسعودة", "View GOSI and Saudization"),
        new(GosiManage, GroupAr, GroupEn, "إغلاق مهام التأمينات الاجتماعية (التسجيل وتحديث الأجر والاستبعاد)", "Close GOSI tasks (registration, wage update, exclusion)"),
        new(GosiInvoice, GroupAr, GroupEn, "تسجيل فاتورة التأمينات الاجتماعية ومطابقتها (المالية)", "Record and reconcile GOSI's invoice (finance)"),
        new(PayslipsSend, GroupAr, GroupEn, "إرسال قسائم الرواتب إلى بريد الموظفين", "Email the payslips to the employees"),
        new(SettlementsView, GroupAr, GroupEn, "عرض المخالصات (الإجازات ونهاية الخدمة)", "View the settlements (vacation and end of service)"),
        new(SettlementsManage, GroupAr, GroupEn, "إنشاء المخالصات وتعديلها وإرسالها وإلغاؤها", "Create, change, send and cancel the settlements"),
        new(SettlementsApproveHr, GroupAr, GroupEn, "اعتماد المخالصات (الموارد البشرية)", "Approve the settlements (HR)"),
        new(SettlementsApproveOperations, GroupAr, GroupEn, "اعتماد مخالصات العمالة (التشغيل)", "Approve the workers' settlements (operations)"),
        new(SettlementsApprovePayroll, GroupAr, GroupEn, "اعتماد المخالصات (الرواتب)", "Approve the settlements (payroll)"),
        new(SettlementsApproveFinance, GroupAr, GroupEn, "اعتماد المخالصات (المالية)", "Approve the settlements (finance)"),
        new(SettlementsPay, GroupAr, GroupEn, "تأكيد صرف المخالصات (المالية)", "Confirm the settlements' payment (finance)"),
    ];
}
