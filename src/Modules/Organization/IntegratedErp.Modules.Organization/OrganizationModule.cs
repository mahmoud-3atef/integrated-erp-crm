using IntegratedErp.BuildingBlocks.Attachments;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Reference;
using IntegratedErp.BuildingBlocks.Security;
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
/// reference lists with fixed codes, the module registry and effective-dated settings. Folders follow the module layout:
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
        services.AddScoped<ITenantDirectory, TenantDirectory>();
        services.AddScoped<ILegalEntityDirectory, LegalEntityDirectory>();
        services.AddScoped<CompanySetupService>();
        services.AddScoped<IReferenceData>(sp => sp.GetRequiredService<CompanySetupService>());
        services.AddScoped<IReferenceDataImport>(sp => sp.GetRequiredService<CompanySetupService>());
        services.AddReferenceLists(OrganizationReferenceLists.All);
        services.AddAttachmentOwners<OrganizationAttachmentOwners>(OrganizationAttachmentOwners.All);
        services.AddPermissions(OrganizationPermissions.All);

        _devEndpoints = configuration.GetValue($"Modules:{Name}:DevEndpoints", defaultValue: false);
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/organization").WithTags(Name);

        group.MapGet("/status", () => Results.Ok(new { module = Name, status = "ready" }))
            .WithName("OrganizationStatus");

        // Signed-in company users; each endpoint adds its own permission.
        var secured = group.MapGroup(string.Empty).RequireAuthorization(PlatformPolicies.CompanyUser);
        secured.MapOrganizationEndpoints();
        secured.MapCompanySetupEndpoints();

        if (_devEndpoints)
        {
            // Raw effective-dated settings API; the settings screens come with the modules that own them.
            secured.MapSettingsEndpoints();
        }
    }
}
