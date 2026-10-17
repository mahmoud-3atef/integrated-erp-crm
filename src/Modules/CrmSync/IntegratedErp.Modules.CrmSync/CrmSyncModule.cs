using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.CrmSync.Api;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.CrmSync;

/// <summary>
/// CrmSync module: a read-only copy of the old CRM's records in staging (incremental by modifiedon, or full), run by
/// a background worker on demand or on a schedule, and the import of its countries and professions into the
/// company's nationality and profession lists without duplicates. Nothing is ever written to the CRM.
/// </summary>
public sealed class CrmSyncModule : IModule
{
    public string Name => CrmSyncContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<CrmSyncDbContext>(configuration, CrmSyncDbContext.SchemaName);
        services.AddOptions<CrmSyncOptions>().Bind(configuration.GetSection(CrmSyncOptions.Section));
        services.AddSingleton<ICrmSource, SqlCrmSource>();
        services.AddSingleton<CrmSyncSignal>();
        services.AddScoped<CrmSyncService>();
        services.AddScoped<ReferenceImportService>();
        services.AddScoped<ICrmStaging, CrmStaging>();
        services.AddHostedService<CrmSyncWorker>();
        services.AddPermissions(CrmSyncPermissions.All);
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapCrmSyncEndpoints();
}
