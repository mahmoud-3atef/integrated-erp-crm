using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Security;

namespace IntegratedErp.Api;

internal static class SystemEndpoints
{
    public static IEndpointRouteBuilder MapSystemEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/system").WithTags("System");

        // Which modules this deployment knows and which are switched on.
        group.MapGet("/modules", (ModuleRegistry registry) => Results.Ok(registry.Describe()))
            .WithName("SystemModules")
            .RequireAuthorization(PlatformPolicies.CompanyUser);

        return endpoints;
    }
}
