using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Workforce.Application;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Workforce.Api;

/// <summary>
/// Workers (/workers) and company staff (/staff) of the current company, read-only in the parallel phase: separate
/// lists with separate permissions, and salaries need their own permission for each.
/// </summary>
internal static class WorkforceEndpoints
{
    public static void MapWorkforceEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/workforce").WithTags("Workforce").RequireAuthorization(PlatformPolicies.CompanyUser);
        Map(group, "workers", WorkerKind.Worker, WorkforcePermissions.WorkersView, WorkforcePermissions.WorkersSalary);
        Map(group, "staff", WorkerKind.Staff, WorkforcePermissions.StaffView, WorkforcePermissions.StaffSalary);

        group.MapGet("/invoice-check", async (DateOnly? month, string? result, string? search, int? page, int? pageSize, InvoiceCheckQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ListAsync(month, result, search, page ?? 1, pageSize ?? 50, ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.WorkersView, companyWide: true);

        group.MapGet("/history/issues", async (string? code, string? search, Guid? workerId, int? page, int? pageSize, HistoryQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.IssuesAsync(code, search, workerId, page ?? 1, pageSize ?? 50, ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.WorkersView, companyWide: true);
    }

    private static void Map(RouteGroupBuilder group, string path, WorkerKind kind, string view, string salary)
    {
        group.MapGet($"/{path}", async (
                string? search, string? placement, string? sort, bool? desc, int? page, int? pageSize,
                WorkerQueries queries, IPermissionService permissions, CancellationToken ct) =>
            {
                var withSalary = (await permissions.GetCurrentAsync(ct).ConfigureAwait(false)).Has(salary);
                var filter = new WorkerFilter(kind, search, placement, sort, desc ?? false, page ?? 1, pageSize ?? 50);
                return Results.Ok(await queries.ListAsync(filter, withSalary, ct).ConfigureAwait(false));
            })
            .RequirePermission(view, companyWide: true);

        group.MapGet($"/{path}/{{id:guid}}", async (Guid id, WorkerQueries queries, IPermissionService permissions, CancellationToken ct) =>
            {
                var withSalary = (await permissions.GetCurrentAsync(ct).ConfigureAwait(false)).Has(salary);
                return await queries.GetAsync(id, kind, withSalary, ct).ConfigureAwait(false) is { } file ? Results.Ok(file) : Results.NotFound();
            })
            .RequirePermission(view, companyWide: true);

        group.MapGet($"/{path}/{{id:guid}}/periods", async (Guid id, IPeriodLedger ledger, CancellationToken ct) =>
                Results.Ok(await ledger.PeriodsAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(view, companyWide: true);
    }
}
