using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Operations.Application;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Operations.Api;

/// <summary>The showroom: the workers available in housing now, for sales and, in its presentation, for a customer.</summary>
internal static class ShowroomEndpoints
{
    public static void MapShowroomEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/operations/showroom").WithTags("Operations").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("", async (bool? presentation, Showroom showroom, CancellationToken ct) =>
                Results.Ok(await showroom.GetAsync(presentation == true, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.ShowroomView, companyWide: true);

        group.MapGet("/{workerId:guid}", async (Guid workerId, bool? presentation, Showroom showroom, CancellationToken ct) =>
                await showroom.FileAsync(workerId, presentation == true, ct).ConfigureAwait(false) is { } file ? Results.Ok(file) : Results.NotFound())
            .RequirePermission(OperationsPermissions.ShowroomView, companyWide: true);
    }
}
