using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Reports.Api;
using IntegratedErp.Modules.Reports.Application;
using IntegratedErp.Modules.Reports.Contracts;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Reports;

/// <summary>
/// Reports module (docs/03-migration-plan/14): the executive report for senior management, from the other modules'
/// numbers and, in the parallel phase, the old system's invoices; it owns no tables.
/// </summary>
public sealed class ReportsModule : IModule
{
    public string Name => ReportsContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddMemoryCache();
        services.AddOptions<ReportsOptions>().Bind(configuration.GetSection(ReportsOptions.Section));
        services.AddScoped<LegacyInvoices>();
        services.AddScoped<ExecutiveReport>();
        services.AddPermissions(ReportsPermissions.All);
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapReportsEndpoints();
}

internal static class ReportsPermissions
{
    public const string ExecutiveView = "reports.executive.view";

    public static readonly PermissionDefinition[] All =
    [
        new(ExecutiveView, "التقارير", "Reports", "عرض تقرير الإدارة العليا", "View the executive report"),
    ];
}
