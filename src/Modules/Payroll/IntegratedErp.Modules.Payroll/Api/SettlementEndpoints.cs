using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Payroll.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Payroll.Api;

/// <summary>The settlements (4.11): the approved leaves to settle, the list, create, change, send, pay and cancel, and one settlement.</summary>
internal static class SettlementEndpoints
{
    public static void MapSettlementEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/payroll/settlements").WithTags("Settlements").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("", async (string? party, string? kind, string? status, string? search, string? sort, bool? desc, int? page, int? pageSize, SettlementQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ListAsync(new SettlementQuery(party, kind, status, search, sort, desc ?? true, page ?? 1, pageSize ?? 25), ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.SettlementsView, companyWide: true);
        group.MapGet("/leaves", async (SettlementService service, CancellationToken ct) => Results.Ok(await service.LeavesAsync(ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.SettlementsManage, companyWide: true);
        group.MapPost("", async (CreateSettlementInput input, SettlementService service, CancellationToken ct) =>
                await service.CreateAsync(input, ct).ConfigureAwait(false) is var r && r.IsSuccess ? Results.Ok(new { id = r.Value }) : Problem(r.Error))
            .RequirePermission(PayrollPermissions.SettlementsManage, companyWide: true);
        group.MapGet("/{id:guid}", async (Guid id, SettlementQueries queries, CancellationToken ct) =>
                await queries.GetAsync(id, ct).ConfigureAwait(false) is { } s ? Results.Ok(s) : Results.NotFound())
            .RequirePermission(PayrollPermissions.SettlementsView, companyWide: true);
        group.MapPut("/{id:guid}", async (Guid id, SettlementEditInput input, SettlementService service, CancellationToken ct) =>
                ToHttp(await service.UpdateAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.SettlementsManage, companyWide: true);
        group.MapPost("/{id:guid}/submit", async (Guid id, SettlementService service, CancellationToken ct) =>
                ToHttp(await service.SubmitAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.SettlementsManage, companyWide: true);
        group.MapPost("/{id:guid}/pay", async (Guid id, SettlementPaymentInput input, SettlementService service, CancellationToken ct) =>
                ToHttp(await service.PayAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.SettlementsPay, companyWide: true);
        group.MapPost("/{id:guid}/cancel", async (Guid id, CancelSettlementInput input, SettlementService service, CancellationToken ct) =>
                ToHttp(await service.CancelAsync(id, input.Comment, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.SettlementsManage, companyWide: true);
    }

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}

internal sealed record CancelSettlementInput(string? Comment);
