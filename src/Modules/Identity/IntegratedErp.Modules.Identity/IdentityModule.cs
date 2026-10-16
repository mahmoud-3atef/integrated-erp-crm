using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.Modules.Identity.Contracts;
using IntegratedErp.Modules.Identity.Infrastructure.Ldap;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Identity;

/// <summary>
/// Identity module (catalog level): users, company memberships, sign-in providers, MFA, roles.
/// Slice 0.4a: Active Directory sign-in over LDAPS.
/// </summary>
public sealed class IdentityModule : IModule
{
    public string Name => IdentityContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<LdapOptions>().Bind(configuration.GetSection(LdapOptions.Section));
        services.AddSingleton<IDirectory, LdapDirectory>();
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        // Sign-in endpoints arrive in slice 0.4b.
    }
}
