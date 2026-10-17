using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.CrmSync.Api;

/// <summary>Sync status and runs, and the reference list import — for the company the CRM's data belongs to.</summary>
internal static class CrmSyncEndpoints
{
    public sealed record RunRequest(SyncMode Mode);

    /// <summary>Merge item <c>FromCode</c> into <c>ToCode</c>, or link CRM record <c>CrmId</c> to <c>ToCode</c>.</summary>
    public sealed record MergeRequest(string ToCode, string? FromCode, Guid? CrmId);

    public static void MapCrmSyncEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/crm-sync").WithTags("CrmSync").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/status", async (CrmSyncService sync, CancellationToken ct) =>
                Results.Ok(await sync.StatusAsync(ct).ConfigureAwait(false)))
            .RequirePermission(CrmSyncPermissions.View, companyWide: true);

        group.MapPost("/runs", async (RunRequest r, CrmSyncService sync, ICurrentUser user, CancellationToken ct) =>
                ToHttp(await sync.RequestAsync(r.Mode, user.DisplayName, ct).ConfigureAwait(false), StatusCodes.Status202Accepted))
            .RequirePermission(CrmSyncPermissions.Run, companyWide: true);

        group.MapPost("/references/import", async (CrmSyncService sync, ReferenceImportService references, CancellationToken ct) =>
                await sync.IsThisCompanyAsync(ct).ConfigureAwait(false)
                    ? ToHttp(await references.ImportAsync(ct).ConfigureAwait(false))
                    : Problem(CrmSyncService.OtherCompany))
            .RequirePermission(CrmSyncPermissions.Run, companyWide: true);

        group.MapPost("/references/{list}/merge", async (string list, MergeRequest r, CrmSyncService sync, ReferenceImportService references, CancellationToken ct) =>
            {
                if (list is not (ReferenceListCodes.Nationalities or ReferenceListCodes.Professions))
                {
                    return Results.NotFound();
                }

                if (!await sync.IsThisCompanyAsync(ct).ConfigureAwait(false))
                {
                    return Problem(CrmSyncService.OtherCompany);
                }

                var result = r.CrmId is { } crmId
                    ? await references.LinkAsync(list, crmId, r.ToCode, ct).ConfigureAwait(false)
                    : await references.MergeAsync(list, r.FromCode ?? string.Empty, r.ToCode, ct).ConfigureAwait(false);
                return result.IsSuccess ? Results.NoContent() : Problem(result.Error);
            })
            .RequirePermission(CrmSyncPermissions.Run, companyWide: true);

        group.MapGet("/references/{list}", async (string list, ReferenceImportService references, CancellationToken ct) =>
                list is ReferenceListCodes.Nationalities or ReferenceListCodes.Professions
                    ? Results.Ok(await references.ReportAsync(list, ct).ConfigureAwait(false))
                    : Results.NotFound())
            .RequirePermission(CrmSyncPermissions.View, companyWide: true);
    }

    private static IResult ToHttp<T>(Result<T> result, int successStatus = StatusCodes.Status200OK) =>
        result.IsSuccess ? Results.Json(result.Value, statusCode: successStatus) : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}
