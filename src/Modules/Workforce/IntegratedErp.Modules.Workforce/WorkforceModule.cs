using IntegratedErp.BuildingBlocks.Alerts;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Reference;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.Workforce.Api;
using IntegratedErp.Modules.Workforce.Application;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Workforce;

/// <summary>
/// Workforce module: one record per person (identity numbers unique in the company) and the worker / staff file.
/// In the parallel phase the files are built from the old CRM's copy after every sync, read-only here; movements
/// (the period ledger), salary history and documents come in the next slices.
/// </summary>
public sealed class WorkforceModule : IModule
{
    public string Name => WorkforceContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<WorkforceDbContext>(configuration, WorkforceDbContext.SchemaName);
        services.AddScoped<WorkerQueries>();
        services.AddScoped<WorkforceDirectory>();
        services.AddScoped<IWorkforceDirectory>(sp => sp.GetRequiredService<WorkforceDirectory>());
        services.AddScoped<IWorkerSalaries>(sp => sp.GetRequiredService<WorkforceDirectory>());
        services.AddScoped<IStaffRecords>(sp => sp.GetRequiredService<WorkforceDirectory>());
        services.AddScoped<IPeriodLedger, PeriodLedger>();
        services.AddScoped<WorkerImportService>();
        services.AddScoped<ICrmStagingConsumer>(sp => sp.GetRequiredService<WorkerImportService>());
        services.AddScoped<HistoryBuilder>();
        services.AddScoped<HistoryQueries>();
        services.AddScoped<ICrmStagingConsumer>(sp => sp.GetRequiredService<HistoryBuilder>());
        services.AddScoped<InvoiceCheckBuilder>();
        services.AddScoped<ICrmStagingConsumer>(sp => sp.GetRequiredService<InvoiceCheckBuilder>());
        services.AddScoped<InvoiceCheckQueries>();
        services.AddScoped<WorkforceDashboard>();
        services.AddScoped<IWorkforceReport>(sp => sp.GetRequiredService<WorkforceDashboard>());
        services.AddScoped<WorkerShowcaseService>();
        services.AddScoped<WorkerCostService>();
        services.AddScoped<IWorkerCosts>(sp => sp.GetRequiredService<WorkerCostService>());
        services.AddScoped<IWorkerShowcase>(sp => sp.GetRequiredService<WorkerShowcaseService>());
        services.AddReferenceLists(WorkforceReferenceLists.All);
        services.AddNumberSequences(
            new NumberSequenceDefinition("worker", WorkforceDbContext.SchemaName, "العمالة والموظفون", "Workforce", "الرقم الوظيفي للعمالة", "Worker numbers", "BSS{N:6}", NumberReset.Never, InUse: false));
        services.AddOptions<WorkforceOptions>().Bind(configuration.GetSection(WorkforceOptions.Section));
        services.AddPermissions(WorkforcePermissions.All);
        services.AddAlertProvider<WorkforceAlerts>();
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapWorkforceEndpoints();
}

internal static class WorkforcePermissions
{
    public const string WorkersView = "workforce.workers.view";
    public const string WorkersSalary = "workforce.workers.salary";
    public const string StaffView = "workforce.staff.view";
    public const string StaffSalary = "workforce.staff.salary";
    public const string ProfileEdit = "workforce.workers.profile";
    public const string CostsView = "workforce.costs.view";
    public const string CostsManage = "workforce.costs.manage";

    // The showroom (Operations module) shows the workers' photos too.
    public const string ShowroomView = "operations.showroom.view";

    private const string WorkersAr = "شؤون العمالة";
    private const string WorkersEn = "Workers";
    private const string StaffAr = "شؤون الموظفين";
    private const string StaffEn = "Staff";

    public static readonly PermissionDefinition[] All =
    [
        new(WorkersView, WorkersAr, WorkersEn, "عرض العمالة", "View workers"),
        new(WorkersSalary, WorkersAr, WorkersEn, "عرض رواتب العمالة وبدلاتها", "View workers' salaries and allowances"),
        new(ProfileEdit, WorkersAr, WorkersEn, "تعديل الملف التسويقي للعامل وصوره", "Edit a worker's marketing profile and photos"),
        new(CostsView, WorkersAr, WorkersEn, "عرض تكلفة عمالة الموردين", "View the suppliers' worker costs"),
        new(CostsManage, WorkersAr, WorkersEn, "إدخال تكلفة عمالة الموردين وباقاتها", "Enter the suppliers' worker costs and packages"),
        new(StaffView, StaffAr, StaffEn, "عرض موظفي الشركة", "View company staff"),
        new(StaffSalary, StaffAr, StaffEn, "عرض رواتب الموظفين وبدلاتهم", "View staff salaries and allowances"),
    ];
}
