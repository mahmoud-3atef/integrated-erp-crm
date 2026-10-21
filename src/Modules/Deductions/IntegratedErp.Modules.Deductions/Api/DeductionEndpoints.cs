using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Deductions.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Deductions.Api;

/// <summary>Advances (request, payment, settlement, postponement), penalties and other deductions, and the settings.</summary>
internal static class DeductionEndpoints
{
    public static void MapDeductionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/deductions").WithTags("Deductions").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/advances/kpis", async (DeductionQueries queries, CancellationToken ct) => Results.Ok(await queries.AdvanceKpisAsync(ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.View, companyWide: true);
        group.MapGet("/advances", async (string? tab, Guid? employeeId, string? search, DeductionQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.AdvancesAsync(tab, employeeId, search, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.View, companyWide: true);
        group.MapGet("/advances/{id:guid}", async (Guid id, DeductionQueries queries, CancellationToken ct) =>
                await queries.AdvanceAsync(id, ct).ConfigureAwait(false) is { } a ? Results.Ok(a) : Results.NotFound())
            .RequirePermission(DeductionPermissions.View, companyWide: true);
        group.MapPost("/advances/preview", async (AdvanceInput input, Guid? advanceId, AdvanceService service, CancellationToken ct) =>
                await service.PreviewAsync(input, advanceId, ct).ConfigureAwait(false) is var r && r.IsSuccess ? Results.Ok(r.Value) : Problem(r.Error))
            .RequirePermission(DeductionPermissions.Manage, companyWide: true);
        group.MapPost("/advances", async (AdvanceInput input, AdvanceService service, CancellationToken ct) => Saved(await service.RequestAsync(input, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.Manage, companyWide: true);
        group.MapPost("/advances/{id:guid}/resubmit", async (Guid id, AdvanceInput input, AdvanceService service, CancellationToken ct) => Saved(await service.ResubmitAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.Manage, companyWide: true);
        group.MapPut("/advances/{id:guid}/amend", async (Guid id, AdvanceAmendInput input, AdvanceService service, CancellationToken ct) => ToHttp(await service.AmendAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.AdvanceAmend, companyWide: true);
        group.MapPost("/advances/{id:guid}/cancel-approved", async (Guid id, NoteInput input, AdvanceService service, CancellationToken ct) => ToHttp(await service.CancelApprovedAsync(id, input.Note, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.AdvanceCancelApproved, companyWide: true);
        group.MapPost("/advances/{id:guid}/disburse", async (Guid id, DisburseInput input, AdvanceService service, CancellationToken ct) => ToHttp(await service.DisburseAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.Disburse, companyWide: true);
        group.MapPost("/advances/{id:guid}/settle", async (Guid id, NoteInput input, AdvanceService service, CancellationToken ct) => ToHttp(await service.SettleAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.Disburse, companyWide: true);
        group.MapPost("/advances/{id:guid}/installments/{installmentId:guid}/postpone", async (Guid id, Guid installmentId, NoteInput input, AdvanceService service, CancellationToken ct) =>
                ToHttp(await service.PostponeAsync(id, installmentId, input, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.Manage, companyWide: true);

        group.MapGet("/penalties", async (string? tab, Guid? employeeId, string? search, DeductionQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.PenaltiesAsync(tab, employeeId, search, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.View, companyWide: true);
        group.MapGet("/penalties/{id:guid}", async (Guid id, DeductionQueries queries, CancellationToken ct) =>
                await queries.PenaltyAsync(id, ct).ConfigureAwait(false) is { } p ? Results.Ok(p) : Results.NotFound())
            .RequirePermission(DeductionPermissions.View, companyWide: true);
        group.MapPost("/penalties/preview", async (PenaltyInput input, Guid? penaltyId, PenaltyService service, CancellationToken ct) =>
                await service.PreviewAsync(input, penaltyId, ct).ConfigureAwait(false) is var r && r.IsSuccess ? Results.Ok(r.Value) : Problem(r.Error))
            .RequirePermission(DeductionPermissions.Manage, companyWide: true);
        group.MapPost("/penalties", async (PenaltyInput input, PenaltyService service, CancellationToken ct) => Saved(await service.RequestAsync(input, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.Manage, companyWide: true);
        group.MapPost("/penalties/{id:guid}/resubmit", async (Guid id, PenaltyInput input, PenaltyService service, CancellationToken ct) => Saved(await service.ResubmitAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.Manage, companyWide: true);

        // A penalty and another deduction each have their own permissions to change or cancel them (checked by the service).
        group.MapPut("/penalties/{id:guid}/amend", async (Guid id, PenaltyAmendInput input, PenaltyService service, CancellationToken ct) => ToHttp(await service.AmendAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.View, companyWide: true);
        group.MapPost("/penalties/{id:guid}/cancel-approved", async (Guid id, NoteInput input, PenaltyService service, CancellationToken ct) => ToHttp(await service.CancelApprovedAsync(id, input.Note, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.View, companyWide: true);

        group.MapGet("/employees/{id:guid}", async (Guid id, DeductionQueries queries, CancellationToken ct) => Results.Ok(await queries.EmployeeAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.View, companyWide: true);

        group.MapGet("/setup", async (DeductionSetup setup, CancellationToken ct) => Results.Ok(await setup.SetupAsync(ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.View, companyWide: true);
        group.MapPut("/settings", async (SettingsDto input, DeductionSetup setup, CancellationToken ct) => ToHttp(await setup.SaveSettingsAsync(input, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.Settings, companyWide: true);
        group.MapPost("/penalty-types", async (PenaltyTypeInput input, DeductionSetup setup, CancellationToken ct) => Saved(await setup.SaveTypeAsync(null, input, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.Settings, companyWide: true);
        group.MapPut("/penalty-types/{id:guid}", async (Guid id, PenaltyTypeInput input, DeductionSetup setup, CancellationToken ct) => Saved(await setup.SaveTypeAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(DeductionPermissions.Settings, companyWide: true);
    }

    private static IResult Saved(Result<Guid> result) => result.IsSuccess ? Results.Ok(new { id = result.Value }) : Problem(result.Error);

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : error.Code.StartsWith("forbidden.", StringComparison.Ordinal) ? StatusCodes.Status403Forbidden
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}
