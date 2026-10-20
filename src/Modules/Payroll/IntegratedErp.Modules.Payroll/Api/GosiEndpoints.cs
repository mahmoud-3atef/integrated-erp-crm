using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Payroll.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Payroll.Api;

/// <summary>GOSI: the monthly statement and the invoice, the tasks on GOSI's portal, and Saudization with its settings.</summary>
internal static class GosiEndpoints
{
    public static void MapGosiEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/payroll/gosi").WithTags("GOSI").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/statement", async (Guid legalEntityId, string period, string? search, string? kind, int? page, int? pageSize, GosiService gosi, CancellationToken ct) =>
                Results.Ok(await gosi.StatementAsync(legalEntityId, period, search, kind, page ?? 1, pageSize ?? 25, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.GosiView, companyWide: true);
        group.MapPut("/invoices", async (GosiInvoiceInput input, GosiService gosi, CancellationToken ct) => ToHttp(await gosi.SaveInvoiceAsync(input, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.GosiInvoice, companyWide: true);
        group.MapGet("/tasks", async (string? status, GosiService gosi, CancellationToken ct) => Results.Ok(await gosi.TasksAsync(status, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.GosiView, companyWide: true);
        group.MapPost("/tasks/{id:guid}/close", async (Guid id, GosiTaskCloseInput input, GosiService gosi, CancellationToken ct) => ToHttp(await gosi.CloseTaskAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.GosiManage, companyWide: true);
        group.MapGet("/saudization", async (GosiService gosi, CancellationToken ct) => Results.Ok(await gosi.SaudizationAsync(ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.GosiView, companyWide: true);
        group.MapGet("/saudization/settings", async (GosiService gosi, CancellationToken ct) => Results.Ok(await gosi.SaudizationSettingsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.GosiView, companyWide: true);
        group.MapPut("/saudization/settings", async (SaudizationSettingsDto input, GosiService gosi, CancellationToken ct) => ToHttp(await gosi.SaveSaudizationSettingsAsync(input, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.SettingsManage, companyWide: true);
    }

    private static IResult ToHttp(Result result) => result.IsSuccess
        ? Results.NoContent()
        : Results.Problem(
            result.Error.Message,
            statusCode: result.Error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
                : result.Error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
                : StatusCodes.Status400BadRequest,
            title: result.Error.Code);
}
