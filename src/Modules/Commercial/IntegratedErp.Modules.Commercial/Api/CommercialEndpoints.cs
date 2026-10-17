using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Commercial.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Commercial.Api;

/// <summary>Customers and projects of the current company (read-only in the parallel phase) and the price packages.</summary>
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

        group.MapGet("/prices", async (string? search, string? status, string? sort, bool? desc, int? page, int? pageSize, PricingQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.PackagesAsync(new ListFilter(search, status, sort, desc ?? true, page ?? 1, pageSize ?? 50), ct).ConfigureAwait(false)))
            .RequirePermission(CommercialPermissions.PricesView, companyWide: true);

        group.MapGet("/prices/{id:guid}", async (Guid id, PricingQueries queries, CancellationToken ct) =>
                await queries.PackageAsync(id, ct).ConfigureAwait(false) is { } package ? Results.Ok(package) : Results.NotFound())
            .RequirePermission(CommercialPermissions.PricesView, companyWide: true);

        group.MapGet("/prices/suggestions", async (string? search, string? status, int? page, int? pageSize, PricingQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.SuggestionsAsync(new ListFilter(search, status, null, true, page ?? 1, pageSize ?? 50), ct).ConfigureAwait(false)))
            .RequirePermission(CommercialPermissions.PricesView, companyWide: true);

        group.MapGet("/prices/workers", async (string? search, string? status, string? sort, bool? desc, int? page, int? pageSize, PricingQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.WorkersAsync(new ListFilter(search, status, sort, desc ?? true, page ?? 1, pageSize ?? 50), ct).ConfigureAwait(false)))
            .RequirePermission(CommercialPermissions.PricesView, companyWide: true);

        group.MapGet("/prices/options", async (string? search, PricingQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.OptionsAsync(search, ct).ConfigureAwait(false)))
            .RequirePermission(CommercialPermissions.PricesView, companyWide: true);

        group.MapGet("/prices/resolve", async (Guid projectId, string profession, string? nationality, DateOnly? on, PricingService service, IClock clock, CancellationToken ct) =>
                await service.FindAsync(projectId, profession, nationality, on ?? clock.Today, ct).ConfigureAwait(false) is { } found ? Results.Ok(found) : Results.NotFound())
            .RequirePermission(CommercialPermissions.PricesView, companyWide: true);

        group.MapPost("/prices", async (PackageInput input, PricingService service, CancellationToken ct) =>
                await service.CreateAsync(input, ct).ConfigureAwait(false) is var result && result.IsSuccess
                    ? Results.Json(new { id = result.Value }, statusCode: StatusCodes.Status201Created)
                    : Problem(result.Error))
            .RequirePermission(CommercialPermissions.PricesManage, companyWide: true);

        group.MapPut("/prices/{id:guid}", async (Guid id, PackageInput input, PricingService service, CancellationToken ct) =>
                ToHttp(await service.UpdateAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(CommercialPermissions.PricesManage, companyWide: true);

        group.MapPost("/prices/{id:guid}/active", async (Guid id, ActiveRequest r, PricingService service, CancellationToken ct) =>
                ToHttp(await service.SetActiveAsync(id, r.Active, ct).ConfigureAwait(false)))
            .RequirePermission(CommercialPermissions.PricesManage, companyWide: true);

        group.MapGet("/projects/{id:guid}/prices", async (Guid id, PricingQueries queries, CancellationToken ct) =>
                await queries.ProjectAsync(id, ct).ConfigureAwait(false) is { } prices ? Results.Ok(prices) : Results.NotFound())
            .RequirePermission(CommercialPermissions.PricesView, companyWide: true);
    }

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}

internal sealed record ActiveRequest(bool Active);
