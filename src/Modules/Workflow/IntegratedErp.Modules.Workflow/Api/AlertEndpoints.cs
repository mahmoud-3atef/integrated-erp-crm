using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Workflow.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Workflow.Api;

/// <summary>The alerts center: the user's alerts, hiding one for some days, and the company's alert settings.</summary>
internal static class AlertEndpoints
{
    public static void MapAlertEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/alerts").WithTags("Alerts").RequireAuthorization(PlatformPolicies.CompanyUser);

        // Each alert is filtered by its own view permission: every signed-in user may ask.
        group.MapGet("/", async (string? code, AlertCenter center, CancellationToken ct) =>
            Results.Ok(await center.ListAsync(code, ct).ConfigureAwait(false)));

        group.MapGet("/count", async (AlertCenter center, CancellationToken ct) =>
            Results.Ok((await center.ListAsync(null, ct).ConfigureAwait(false)).Counts));

        group.MapPost("/dismiss", async (DismissInput input, AlertCenter center, CancellationToken ct) =>
            ToHttp(await center.DismissAsync(input, ct).ConfigureAwait(false)));

        group.MapPost("/restore", async (AlertCenter center, CancellationToken ct) =>
            ToHttp(await center.RestoreAsync(ct).ConfigureAwait(false)));

        group.MapGet("/settings", async (AlertCenter center, CancellationToken ct) =>
                Results.Ok(await center.SettingsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.AlertsManage, companyWide: true);

        group.MapPut("/settings/{code}", async (string code, AlertSettingInput input, AlertCenter center, CancellationToken ct) =>
                ToHttp(await center.SaveSettingAsync(code, input, ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.AlertsManage, companyWide: true);

        // The morning digest now (for an administrator who changed the settings, or to try it).
        group.MapPost("/digest", async (AlertCenter center, CancellationToken ct) =>
                Results.Ok(new { told = await center.DigestAsync(force: true, ct).ConfigureAwait(false) }))
            .RequirePermission(WorkflowPermissions.AlertsManage, companyWide: true);
    }

    private static IResult ToHttp(Result result) => result.IsSuccess
        ? Results.NoContent()
        : Results.Problem(
            result.Error.Message,
            statusCode: result.Error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound : StatusCodes.Status400BadRequest,
            title: result.Error.Code);
}
