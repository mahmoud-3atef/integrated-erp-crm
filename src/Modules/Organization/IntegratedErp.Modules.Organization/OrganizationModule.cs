using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.Modules.Organization.Contracts;
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
    public string Name => OrganizationContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        // Persistence and application services arrive in slices 0.2 / 0.6.
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/organization").WithTags(Name);

        group.MapGet("/status", () => Results.Ok(new { module = Name, status = "ready" }))
            .WithName("OrganizationStatus");
    }
}
