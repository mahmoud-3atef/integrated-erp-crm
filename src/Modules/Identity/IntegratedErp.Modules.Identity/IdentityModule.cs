using System.Threading.RateLimiting;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Identity.Api;
using IntegratedErp.Modules.Identity.Application;
using IntegratedErp.Modules.Identity.Contracts;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Identity.Infrastructure.Ldap;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Identity;

/// <summary>
/// Identity module (catalog level): users (one identity across companies), company memberships,
/// sign-in through the company AD over LDAPS, mandatory MFA (TOTP), sign-in log and throttling,
/// and per-company roles and permissions (optionally limited to one commercial registration).
/// </summary>
public sealed class IdentityModule : IModule
{
    public string Name => IdentityContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddModuleDbContext<IdentityDbContext>(configuration, IdentityDbContext.SchemaName);
        services.AddOptions<LdapOptions>().Bind(configuration.GetSection(LdapOptions.Section));
        services.AddOptions<IdentityOptions>().Bind(configuration.GetSection(IdentityOptions.Section));
        services.AddSingleton<IDirectory, LdapDirectory>();
        services.AddScoped<SignInService>();
        services.AddScoped<AccessService>();
        services.AddScoped<IUserDirectory, UserDirectory>();
        services.AddScoped<IAccessDirectory, AccessDirectory>();
        services.AddScoped<IPermissionService, PermissionService>();
        services.AddPermissions(IdentityPermissions.All);

        // Per-client limit on sign-in calls (on top of per-name and per-account limits in SignInService).
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(AuthEndpoints.RateLimitPolicy, http =>
                RateLimitPartition.GetFixedWindowLimiter(
                    http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = configuration.GetValue("Identity:RateLimitPerMinute", 30), Window = TimeSpan.FromMinutes(1) }));
        });
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapAuthEndpoints();
        endpoints.MapAccessEndpoints();
    }
}
