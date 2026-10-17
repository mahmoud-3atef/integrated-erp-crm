using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Persistence;
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
        services.AddScoped<IWorkforceDirectory, WorkforceDirectory>();
        services.AddScoped<IPeriodLedger, PeriodLedger>();
        services.AddScoped<WorkerImportService>();
        services.AddScoped<ICrmStagingConsumer>(sp => sp.GetRequiredService<WorkerImportService>());
        services.AddPermissions(WorkforcePermissions.All);
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapWorkforceEndpoints();
}

internal static class WorkforcePermissions
{
    public const string WorkersView = "workforce.workers.view";
    public const string WorkersSalary = "workforce.workers.salary";
    public const string StaffView = "workforce.staff.view";
    public const string StaffSalary = "workforce.staff.salary";

    private const string WorkersAr = "شؤون العمالة";
    private const string WorkersEn = "Workers";
    private const string StaffAr = "شؤون الموظفين";
    private const string StaffEn = "Staff";

    public static readonly PermissionDefinition[] All =
    [
        new(WorkersView, WorkersAr, WorkersEn, "عرض العمالة", "View workers"),
        new(WorkersSalary, WorkersAr, WorkersEn, "عرض رواتب العمالة وبدلاتها", "View workers' salaries and allowances"),
        new(StaffView, StaffAr, StaffEn, "عرض موظفي الشركة", "View company staff"),
        new(StaffSalary, StaffAr, StaffEn, "عرض رواتب الموظفين وبدلاتهم", "View staff salaries and allowances"),
    ];
}
