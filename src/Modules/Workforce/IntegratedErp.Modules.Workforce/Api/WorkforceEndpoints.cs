using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Workforce.Application;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Workforce.Api;

/// <summary>Workers and staff of the current company (read-only in the parallel phase). Salaries need their own permission.</summary>
internal static class WorkforceEndpoints
{
    public static void MapWorkforceEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/workforce").WithTags("Workforce").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/workers", async (
                string? search, string? placement, string? kind, string? sort, bool? desc, int? page, int? pageSize,
                WorkerQueries queries, IPermissionService permissions, CancellationToken ct) =>
            {
                var withSalary = (await permissions.GetCurrentAsync(ct).ConfigureAwait(false)).Has(WorkforcePermissions.SalaryView);
                var filter = new WorkerFilter(search, placement, kind, sort, desc ?? false, page ?? 1, pageSize ?? 50);
                return Results.Ok(await queries.ListAsync(filter, withSalary, ct).ConfigureAwait(false));
            })
            .RequirePermission(WorkforcePermissions.WorkersView, companyWide: true);

        group.MapGet("/workers/{id:guid}", async (Guid id, WorkerQueries queries, IPermissionService permissions, CancellationToken ct) =>
            {
                var withSalary = (await permissions.GetCurrentAsync(ct).ConfigureAwait(false)).Has(WorkforcePermissions.SalaryView);
                return await queries.GetAsync(id, withSalary, ct).ConfigureAwait(false) is { } worker ? Results.Ok(worker) : Results.NotFound();
            })
            .RequirePermission(WorkforcePermissions.WorkersView, companyWide: true);
    }
}
