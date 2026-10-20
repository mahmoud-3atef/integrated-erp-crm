using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Reports.Application;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Reports.Api;

/// <summary>The executive report: its overview and finance, and the lists behind any clicked figure (also as Excel).</summary>
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
