using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.Modules.Organization.Api;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Organization.Application.Settings;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Organization.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Organization;

/// <summary>
/// Organization module: tenants, legal entities (commercial registrations), branches,
/// reference codes and effective-dated settings. Folders follow the module layout:
/// Domain / Application / Infrastructure / Api.
/// </summary>
public sealed class OrganizationModule : IModule
{
    private bool _devEndpoints;

    public string Name => OrganizationContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddModuleDbContext<OrganizationDbContext>(configuration, OrganizationDbContext.SchemaName);
        services.AddScoped<SettingsService>();
        services.AddScoped<OrganizationService>();

        _devEndpoints = configuration.GetValue($"Modules:{Name}:DevEndpoints", defaultValue: false);
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/organization").WithTags(Name);

        group.MapGet("/status", () => Results.Ok(new { module = Name, status = "ready" }))
            .WithName("OrganizationStatus");

        if (_devEndpoints)
        {
            group.MapSettingsEndpoints();
            group.MapOrganizationEndpoints();
        }
    }
}
