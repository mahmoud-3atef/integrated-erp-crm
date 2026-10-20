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
        services.AddScoped<StaffPayrollService>();
        services.AddScoped<StaffPayrollQueries>();
        services.AddScoped<IApprovalRecordAdapter, StaffPayrollAdapter>();
        services.AddPermissions(PayrollPermissions.All);
        services.AddNumberSequences(
            new NumberSequenceDefinition("payroll", PayrollDbContext.SchemaName, "الرواتب", "Payroll", "مسيرات الرواتب", "Payroll runs", "PR-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition(StaffPayrollService.Sequence, PayrollDbContext.SchemaName, "الرواتب", "Payroll", "مسيرات رواتب الموظفين", "Staff payroll runs", "SP-{YYYY}-{N:5}", NumberReset.Yearly));
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPayrollEndpoints();
        endpoints.MapStaffPayrollEndpoints();
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
    ];
}
