using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Operations.Application;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Operations.Api;

/// <summary>Delivery orders: those written here and those copied from the old system.</summary>
internal static class OperationsEndpoints
{
    public static void MapOperationsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/operations/delivery-orders").WithTags("Operations").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/", async (string? search, string? status, string? source, string? sort, bool? desc, int? page, int? pageSize, DeliveryOrderQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ListAsync(new DeliveryListFilter(search, status, source, sort, desc ?? true, page ?? 1, pageSize ?? 50), ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.DeliveryView, companyWide: true);

        group.MapGet("/{id:guid}", async (Guid id, DeliveryOrderQueries queries, CancellationToken ct) =>
                await queries.GetAsync(id, ct).ConfigureAwait(false) is { } order ? Results.Ok(order) : Results.NotFound())
            .RequirePermission(OperationsPermissions.DeliveryView, companyWide: true);

        group.MapGet("/projects", async (DeliveryOrderQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ProjectsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.DeliveryCreate, companyWide: true);

        group.MapGet("/workers", async (string search, IWorkforceDirectory workforce, CancellationToken ct) =>
                Results.Ok(await workforce.SearchAsync(search, 30, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.DeliveryCreate, companyWide: true);

        group.MapPost("/prices", async (PriceRequest r, DeliveryOrderService service, IClock clock, CancellationToken ct) =>
                ToHttp(await service.PriceAsync(r.ProjectId, r.WorkerIds, r.On ?? clock.Today, r.OrderId, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.DeliveryCreate, companyWide: true);

        group.MapPost("/", async (DeliveryInput input, DeliveryOrderService service, CancellationToken ct) =>
                await service.CreateAsync(input, ct).ConfigureAwait(false) is var result && result.IsSuccess
                    ? Results.Json(new { id = result.Value }, statusCode: StatusCodes.Status201Created)
                    : Problem(result.Error))
            .RequirePermission(OperationsPermissions.DeliveryCreate, companyWide: true);

        group.MapPut("/{id:guid}", async (Guid id, DeliveryInput input, DeliveryOrderService service, CancellationToken ct) =>
                ToHttp(await service.UpdateAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.DeliveryCreate, companyWide: true);

        group.MapPost("/{id:guid}/submit", async (Guid id, DeliveryOrderService service, CancellationToken ct) =>
                ToHttp(await service.SubmitAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.DeliveryCreate, companyWide: true);

        group.MapPost("/{id:guid}/confirm", async (Guid id, ConfirmInput input, DeliveryOrderService service, CancellationToken ct) =>
                ToHttp(await service.ConfirmAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.DeliveryConfirm, companyWide: true);

        group.MapPost("/{id:guid}/cancel", async (Guid id, CancelRequest r, DeliveryOrderService service, CancellationToken ct) =>
                ToHttp(await service.CancelAsync(id, r.Comment, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.DeliveryCreate, companyWide: true);
    }

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult ToHttp<T>(Result<T> result) => result.IsSuccess ? Results.Ok(result.Value) : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}

internal sealed record PriceRequest(Guid ProjectId, IReadOnlyList<Guid> WorkerIds, DateOnly? On, Guid? OrderId);

internal sealed record CancelRequest(string? Comment);
