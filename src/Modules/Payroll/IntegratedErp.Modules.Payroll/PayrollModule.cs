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
/// approved timesheets for a commercial registration and a period, and approved through the company's process.
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
        services.AddPermissions(PayrollPermissions.All);
        services.AddNumberSequences(
            new NumberSequenceDefinition("payroll", PayrollDbContext.SchemaName, "الرواتب", "Payroll", "مسيرات الرواتب", "Payroll runs", "PR-{YYYY}-{N:5}", NumberReset.Yearly));
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapPayrollEndpoints();
}

/// <summary>
/// Separate duties (09 §11): who calculates is not who reviews, approves or pays. The workers' payroll has its own
/// permissions, apart from the staff's payroll to come.
/// </summary>
internal static class PayrollPermissions
{
    public const string WorkersView = "payroll.workers.view";
    public const string WorkersManage = "payroll.workers.manage";
    public const string WorkersReview = "payroll.workers.review";
    public const string WorkersFinance = "payroll.workers.finance";
    public const string WorkersApprove = "payroll.workers.approve";
    public const string SettingsManage = "payroll.settings.manage";

    private const string GroupAr = "الرواتب";
    private const string GroupEn = "Payroll";

    public static readonly PermissionDefinition[] All =
    [
        new(WorkersView, GroupAr, GroupEn, "عرض مسيرات رواتب العمالة", "View the workers' payroll runs"),
        new(WorkersManage, GroupAr, GroupEn, "إنشاء مسيرات رواتب العمالة وإعادة حسابها وإرسالها", "Create, recalculate and send the workers' payroll runs"),
        new(WorkersReview, GroupAr, GroupEn, "مراجعة مسيرات رواتب العمالة (الموارد البشرية)", "Review the workers' payroll runs (HR)"),
        new(WorkersFinance, GroupAr, GroupEn, "الاعتماد المالي لمسيرات رواتب العمالة", "Finance approval of the workers' payroll runs"),
        new(WorkersApprove, GroupAr, GroupEn, "اعتماد الإدارة العليا لمسيرات رواتب العمالة", "Management approval of the workers' payroll runs"),
        new(SettingsManage, GroupAr, GroupEn, "ربط الكفلاء بالسجلات التجارية للمسيرات", "Link sponsors to the commercial registrations for the payroll"),
    ];
}
