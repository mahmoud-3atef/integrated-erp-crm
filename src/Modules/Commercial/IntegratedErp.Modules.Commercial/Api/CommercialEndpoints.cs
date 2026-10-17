using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Commercial.Application;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Commercial.Api;

/// <summary>Customers and projects of the current company (read-only in the parallel phase).</summary>
internal static class CommercialEndpoints
{
    public static void MapCommercialEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/commercial").WithTags("Commercial").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/projects", async (string? search, string? status, string? sort, bool? desc, int? page, int? pageSize, CommercialQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ProjectsAsync(new ListFilter(search, status, sort, desc ?? true, page ?? 1, pageSize ?? 50), ct).ConfigureAwait(false)))
            .RequirePermission(CommercialPermissions.ProjectsView, companyWide: true);

        group.MapGet("/projects/{id:guid}", async (Guid id, CommercialQueries queries, CancellationToken ct) =>
                await queries.ProjectAsync(id, ct).ConfigureAwait(false) is { } project ? Results.Ok(project) : Results.NotFound())
            .RequirePermission(CommercialPermissions.ProjectsView, companyWide: true);

        group.MapGet("/customers", async (string? search, string? status, string? sort, bool? desc, int? page, int? pageSize, CommercialQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.CustomersAsync(new ListFilter(search, status, sort, desc ?? true, page ?? 1, pageSize ?? 50), ct).ConfigureAwait(false)))
            .RequirePermission(CommercialPermissions.CustomersView, companyWide: true);

        group.MapGet("/customers/{id:guid}", async (Guid id, CommercialQueries queries, CancellationToken ct) =>
                await queries.CustomerAsync(id, ct).ConfigureAwait(false) is { } customer ? Results.Ok(customer) : Results.NotFound())
            .RequirePermission(CommercialPermissions.CustomersView, companyWide: true);
    }
}
