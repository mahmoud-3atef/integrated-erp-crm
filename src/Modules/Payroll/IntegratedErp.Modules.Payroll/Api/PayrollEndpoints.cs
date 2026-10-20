using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Payroll.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Payroll.Api;

/// <summary>The company workers' payroll runs: list, create, recalculate, send, the run's KPIs, its lines and exports, and the sponsor links.</summary>
internal static class PayrollEndpoints
{
    public static void MapPayrollEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/payroll").WithTags("Payroll").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/runs", async (Guid? legalEntityId, PayrollQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ListAsync(legalEntityId, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.WorkersView, companyWide: true);

        group.MapGet("/runs/next-period", async (Guid legalEntityId, PayrollService service, CancellationToken ct) =>
                await service.NextPeriodAsync(legalEntityId, ct).ConfigureAwait(false) is var (from, to) ? Results.Ok(new { from, to }) : Results.NotFound())
            .RequirePermission(PayrollPermissions.WorkersManage, companyWide: true);

        group.MapPost("/runs", async (CreateRunInput input, PayrollService service, CancellationToken ct) =>
                await service.CreateAsync(input, ct).ConfigureAwait(false) is var result && result.IsSuccess ? Results.Ok(new { id = result.Value }) : Problem(result.Error))
            .RequirePermission(PayrollPermissions.WorkersManage, companyWide: true);

        group.MapGet("/runs/{id:guid}", async (Guid id, PayrollQueries queries, CancellationToken ct) =>
                await queries.GetAsync(id, ct).ConfigureAwait(false) is { } run ? Results.Ok(run) : Results.NotFound())
            .RequirePermission(PayrollPermissions.WorkersView, companyWide: true);

        group.MapGet("/runs/{id:guid}/lines", async (Guid id, string? search, string? note, Guid? project, string? sort, bool? desc, int? page, int? pageSize, PayrollQueries queries, CancellationToken ct) =>
                await queries.LinesAsync(id, new LineQuery(search, note, project, sort, desc ?? false, page ?? 1, pageSize ?? 25), ct).ConfigureAwait(false) is { } lines
                    ? Results.Ok(lines)
                    : Results.NotFound())
            .RequirePermission(PayrollPermissions.WorkersView, companyWide: true);

        group.MapGet("/runs/{id:guid}/lines/{lineId:guid}", async (Guid id, Guid lineId, PayrollQueries queries, CancellationToken ct) =>
                await queries.LineAsync(id, lineId, ct).ConfigureAwait(false) is { } line ? Results.Ok(line) : Results.NotFound())
            .RequirePermission(PayrollPermissions.WorkersView, companyWide: true);

        group.MapGet("/runs/{id:guid}/payslips", async (Guid id, Guid? line, string? search, string? note, Guid? project, PayslipService payslips, CancellationToken ct) =>
                await payslips.WorkersAsync(id, new PayslipQuery(line, search, project, note), ct).ConfigureAwait(false) is { } batch ? Results.Ok(batch) : Results.NotFound())
            .RequirePermission(PayrollPermissions.WorkersView, companyWide: true);
        group.MapGet("/runs/{id:guid}/exclusions", async (Guid id, PayrollQueries queries, CancellationToken ct) =>
                await queries.ExclusionsAsync(id, ct).ConfigureAwait(false) is { } list ? Results.Ok(list) : Results.NotFound())
            .RequirePermission(PayrollPermissions.WorkersView, companyWide: true);

        // The register of the filtered scope (or the whole run), as the screen shows it.
        group.MapGet("/runs/{id:guid}/excel", async (Guid id, string? search, string? note, Guid? project, string? sort, bool? desc, PayrollQueries queries, CancellationToken ct) =>
            {
                var query = new LineQuery(search, note, project, sort, desc ?? false, 1, int.MaxValue);
                if (await queries.ScopeAsync(id, query, ct).ConfigureAwait(false) is not { } scope)
                {
                    return Results.NotFound();
                }

                var filtered = !string.IsNullOrWhiteSpace(search) || !string.IsNullOrWhiteSpace(note) || project is not null;
                return Results.File(PayrollWorkbook.Build(scope.Run, scope.Lines, filtered), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{scope.Run.RunNo}.xlsx");
            })
            .RequirePermission(PayrollPermissions.WorkersView, companyWide: true);

        group.MapPost("/runs/{id:guid}/recalculate", async (Guid id, PayrollService service, CancellationToken ct) =>
                ToHttp(await service.RecalculateAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.WorkersManage, companyWide: true);

        group.MapPost("/runs/{id:guid}/submit", async (Guid id, PayrollService service, CancellationToken ct) =>
                ToHttp(await service.SubmitAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.WorkersManage, companyWide: true);

        group.MapDelete("/runs/{id:guid}", async (Guid id, PayrollService service, CancellationToken ct) =>
                ToHttp(await service.DeleteAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.WorkersManage, companyWide: true);

        group.MapGet("/sponsors", async (PayrollQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.SponsorsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.WorkersView, companyWide: true);

        group.MapPut("/sponsors", async (IReadOnlyList<SponsorLinkInput> links, PayrollService service, CancellationToken ct) =>
                ToHttp(await service.LinkSponsorsAsync(links, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.SettingsManage, companyWide: true);
    }

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}
