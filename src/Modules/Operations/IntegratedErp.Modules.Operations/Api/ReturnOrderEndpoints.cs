using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Housing.Contracts;
using IntegratedErp.Modules.Operations.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Operations.Api;

/// <summary>Return orders (worker back to housing): those written here and the old system's housing orders.</summary>
internal static class ReturnOrderEndpoints
{
    public static void MapReturnOrderEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/operations/return-orders").WithTags("Operations").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/", async (string? search, string? status, string? source, string? sort, bool? desc, int? page, int? pageSize, ReturnOrderQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ListAsync(new DeliveryListFilter(search, status, source, sort, desc ?? true, page ?? 1, pageSize ?? 50), ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.ReturnView, companyWide: true);

        group.MapGet("/{id:guid}", async (Guid id, ReturnOrderQueries queries, CancellationToken ct) =>
                await queries.GetAsync(id, ct).ConfigureAwait(false) is { } order ? Results.Ok(order) : Results.NotFound())
            .RequirePermission(OperationsPermissions.ReturnView, companyWide: true);

        group.MapGet("/on-job-workers", async (Guid? orderId, ReturnOrderService service, CancellationToken ct) =>
                Results.Ok(await service.OnJobAsync(orderId, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.ReturnCreate, companyWide: true);

        group.MapGet("/rooms", async (IHousingRooms housing, CancellationToken ct) =>
                Results.Ok(await housing.RoomsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.ReturnCreate, companyWide: true);

        group.MapPost("/", async (ReturnInput input, ReturnOrderService service, CancellationToken ct) =>
                await service.CreateAsync(input, ct).ConfigureAwait(false) is var result && result.IsSuccess
                    ? Results.Json(result.Value, statusCode: StatusCodes.Status201Created)
                    : Problem(result.Error))
            .RequirePermission(OperationsPermissions.ReturnCreate, companyWide: true);

        group.MapPut("/{id:guid}", async (Guid id, ReturnInput input, ReturnOrderService service, CancellationToken ct) =>
                await service.UpdateAsync(id, input, ct).ConfigureAwait(false) is var result && result.IsSuccess ? Results.Ok(result.Value) : Problem(result.Error))
            .RequirePermission(OperationsPermissions.ReturnCreate, companyWide: true);

        group.MapPost("/{id:guid}/submit", async (Guid id, ReturnOrderService service, CancellationToken ct) =>
                ToHttp(await service.SubmitAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.ReturnCreate, companyWide: true);

        group.MapPut("/{id:guid}/amend", async (Guid id, ReturnAmendInput input, ReturnOrderService service, CancellationToken ct) =>
                ToHttp(await service.AmendAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.ReturnAmend, companyWide: true);
        group.MapPost("/{id:guid}/cancel-approved", async (Guid id, CancelRequest r, ReturnOrderService service, CancellationToken ct) =>
                ToHttp(await service.CancelApprovedAsync(id, r.Comment, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.ReturnCancelApproved, companyWide: true);
        group.MapPost("/{id:guid}/cancel", async (Guid id, CancelRequest r, ReturnOrderService service, CancellationToken ct) =>
                ToHttp(await service.CancelAsync(id, r.Comment, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.ReturnCreate, companyWide: true);
    }

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}
