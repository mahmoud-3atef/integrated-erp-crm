using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Organization.Application.Settings;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Organization.Api;

/// <summary>The company's numbering of its documents (patterns, resets, numbers to start from).</summary>
internal static class NumberingEndpoints
{
    public static void MapNumberingEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/numbering", async (NumberingService service, CancellationToken ct) => Results.Ok(await service.ListAsync(ct).ConfigureAwait(false)))
            .RequirePermission(OrganizationPermissions.SettingsView, companyWide: true);

        group.MapPut("/numbering/{key}", async (string key, NumberingInput input, NumberingService service, CancellationToken ct) =>
                ToHttp(await service.UpdateAsync(key, input, ct).ConfigureAwait(false)))
            .RequirePermission(OrganizationPermissions.SettingsManage, companyWide: true);

        group.MapDelete("/numbering/{key}", async (string key, NumberingService service, CancellationToken ct) =>
                ToHttp(await service.ResetAsync(key, ct).ConfigureAwait(false)))
            .RequirePermission(OrganizationPermissions.SettingsManage, companyWide: true);
    }

    private static IResult ToHttp(Result result) => result.IsSuccess
        ? Results.NoContent()
        : Results.Problem(
            result.Error.Message,
            statusCode: result.Error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound : StatusCodes.Status400BadRequest,
            title: result.Error.Code);
}
