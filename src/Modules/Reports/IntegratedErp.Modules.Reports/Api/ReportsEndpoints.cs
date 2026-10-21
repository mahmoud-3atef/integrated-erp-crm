using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Reports.Application;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Reports.Api;

/// <summary>The executive and the movement reports: their figures, and the lists behind any clicked figure (also as Excel).</summary>
internal static class ReportsEndpoints
{
    // The finance figures also need the right to see the invoices.
    private const string InvoicesView = "billing.invoices.view";

    public static void MapReportsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/reports/executive").WithTags("Executive report").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/overview", async (DateOnly? from, DateOnly? to, ExecutiveReport report, IPermissionService permissions, IClock clock, CancellationToken ct) =>
            {
                if (Range(from, to, clock) is not { } range)
                {
                    return BadPeriod();
                }

                var finance = (await permissions.GetCurrentAsync(ct).ConfigureAwait(false)).LegalEntitiesFor(InvoicesView) is null;
                return Results.Ok(await report.OverviewAsync(range.From, range.To, finance, ct).ConfigureAwait(false));
            })
            .RequirePermission(ReportsPermissions.ExecutiveView, companyWide: true);

        group.MapGet("/finance", async (DateOnly? from, DateOnly? to, Guid? project, ExecutiveReport report, IClock clock, CancellationToken ct) =>
                Range(from, to, clock) is { } range ? Results.Ok(await report.FinanceAsync(range.From, range.To, project, ct).ConfigureAwait(false)) : BadPeriod())
            .RequirePermission(ReportsPermissions.ExecutiveView, companyWide: true)
            .RequirePermission(InvoicesView, companyWide: true);

        group.MapGet("/invoices", async (DateOnly? from, DateOnly? to, Guid? project, string? manager, int? status, int? bucket, string? month, bool? open, bool? excel, ExecutiveReport report, IClock clock, CancellationToken ct) =>
            {
                if (Range(from, to, clock) is not { } range)
                {
                    return BadPeriod();
                }

                var rows = await report.InvoicesAsync(new ReportFilter(range.From, range.To, project, manager, status, bucket, month, null, open == true), ct).ConfigureAwait(false);
                return excel == true
                    ? Results.File(ReportWorkbook.Invoices(rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "invoices.xlsx")
                    : Results.Ok(rows);
            })
            .RequirePermission(ReportsPermissions.ExecutiveView, companyWide: true)
            .RequirePermission(InvoicesView, companyWide: true);

        group.MapGet("/moves", async (DateOnly? from, DateOnly? to, Guid? project, string? manager, string? month, string? kind, bool? excel, ExecutiveReport report, IClock clock, CancellationToken ct) =>
            {
                if (Range(from, to, clock) is not { } range)
                {
                    return BadPeriod();
                }

                var rows = await report.MovesAsync(new ReportFilter(range.From, range.To, project, manager, null, null, month, kind), ct).ConfigureAwait(false);
                return excel == true
                    ? Results.File(ReportWorkbook.Moves(rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "moves.xlsx")
                    : Results.Ok(rows);
            })
            .RequirePermission(ReportsPermissions.ExecutiveView, companyWide: true);

        MapMovement(endpoints);
        MapCeo(endpoints);
    }

    private const string Xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    /// <summary>The CEO report's profitability (docs/03-migration-plan/16), always of a whole invoiced month.</summary>
    private static void MapCeo(IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/reports/ceo").WithTags("CEO report").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("", async (string? month, CeoReport report, CancellationToken ct) =>
                await report.OverviewAsync(Month(month), ct).ConfigureAwait(false) is { } overview ? Results.Ok(overview) : Results.NoContent())
            .RequirePermission(ReportsPermissions.ExecutiveView, companyWide: true)
            .RequirePermission(ReportsPermissions.ProfitView, companyWide: true);

        group.MapGet("/profit", async (string? month, CeoReport report, CancellationToken ct) =>
                await report.ProfitAsync(Month(month), ct).ConfigureAwait(false) is { } tab ? Results.Ok(tab) : Results.NoContent())
            .RequirePermission(ReportsPermissions.ProfitView, companyWide: true);

        // A worker's cost shows a company worker's salary: the salaries' permission too.
        group.MapGet("/workers", async (string? month, Guid? project, string? supplier, string? source, bool? losing, bool? housing, bool? lost, string? search, bool? excel, CeoReport report, CancellationToken ct) =>
            {
                var rows = await report.WorkersAsync(Month(month), new WorkerProfitFilter(project, supplier, source, losing == true, housing == true, search, lost == true), ct).ConfigureAwait(false);
                return excel == true ? Results.File(ReportWorkbook.WorkerProfit(rows), Xlsx, "worker-profit.xlsx") : Results.Ok(rows);
            })
            .RequirePermission(ReportsPermissions.ProfitView, companyWide: true)
            .RequirePermission(SalariesView, companyWide: true);
    }

    private const string SalariesView = "workforce.workers.salary";

    private static DateOnly? Month(string? month) => month is not null && DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", out var m) ? m : null;

    private static void MapMovement(IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/reports/movement").WithTags("Workforce movement report").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("", async (DateOnly? from, DateOnly? to, MovementReport report, IClock clock, CancellationToken ct) =>
                Range(from, to, clock) is { } range ? Results.Ok(await report.OverviewAsync(range.From, range.To, ct).ConfigureAwait(false)) : BadPeriod())
            .RequirePermission(ReportsPermissions.MovementView, companyWide: true);

        group.MapGet("/moves", async (DateOnly? from, DateOnly? to, Guid? project, string? manager, string? month, string? kind, bool? excel, ExecutiveReport report, IClock clock, CancellationToken ct) =>
            {
                if (Range(from, to, clock) is not { } range)
                {
                    return BadPeriod();
                }

                var rows = await report.MovesAsync(new ReportFilter(range.From, range.To, project, manager, null, null, month, kind), ct).ConfigureAwait(false);
                return excel == true ? Results.File(ReportWorkbook.Moves(rows), Xlsx, "moves.xlsx") : Results.Ok(rows);
            })
            .RequirePermission(ReportsPermissions.MovementView, companyWide: true);

        group.MapGet("/arrivals", async (DateOnly? from, DateOnly? to, string? month, bool? delivered, bool? excel, MovementReport report, IClock clock, CancellationToken ct) =>
            {
                if (Range(from, to, clock) is not { } range)
                {
                    return BadPeriod();
                }

                var rows = await report.ArrivalsAsync(range.From, range.To, month, delivered, ct).ConfigureAwait(false);
                return excel == true ? Results.File(ReportWorkbook.Arrivals(rows), Xlsx, "arrivals.xlsx") : Results.Ok(rows);
            })
            .RequirePermission(ReportsPermissions.MovementView, companyWide: true);

        group.MapGet("/returns", async (DateOnly? from, DateOnly? to, string? month, string? reason, bool? excel, MovementReport report, IClock clock, CancellationToken ct) =>
            {
                if (Range(from, to, clock) is not { } range)
                {
                    return BadPeriod();
                }

                var rows = await report.ReturnsAsync(range.From, range.To, month, reason, ct).ConfigureAwait(false);
                return excel == true ? Results.File(ReportWorkbook.Returns(rows), Xlsx, "returns.xlsx") : Results.Ok(rows);
            })
            .RequirePermission(ReportsPermissions.MovementView, companyWide: true);

        group.MapGet("/waiting", async (bool? excel, MovementReport report, CancellationToken ct) =>
            {
                var rows = await report.WaitingAsync(ct).ConfigureAwait(false);
                return excel == true ? Results.File(ReportWorkbook.Waiting(rows), Xlsx, "waiting.xlsx") : Results.Ok(rows);
            })
            .RequirePermission(ReportsPermissions.MovementView, companyWide: true);
    }

    /// <summary>The period asked for (this month by default), at most two years and never before 2025.</summary>
    private static (DateOnly From, DateOnly To)? Range(DateOnly? from, DateOnly? to, IClock clock)
    {
        var today = clock.Today;
        var start = from ?? new DateOnly(today.Year, today.Month, 1);
        var end = to ?? start.AddMonths(1).AddDays(-1);
        return end < start || end.DayNumber - start.DayNumber > 731 || start < new DateOnly(2025, 1, 1) ? null : (start, end);
    }

    private static IResult BadPeriod() => Results.Problem("Choose a period of two years at most, from 2025.", statusCode: StatusCodes.Status400BadRequest, title: "validation.report_period");
}
