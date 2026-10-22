using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Operations.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Operations.Api;

/// <summary>Transfer orders: workers on the job moved to another project.</summary>
internal static class TransferOrderEndpoints
{
    public static void MapTransferOrderEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/operations/transfer-orders").WithTags("Operations").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/", async (string? search, string? status, string? sort, bool? desc, int? page, int? pageSize, TransferOrderQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ListAsync(new DeliveryListFilter(search, status, null, sort, desc ?? true, page ?? 1, pageSize ?? 50), ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.TransferView, companyWide: true);

        group.MapGet("/{id:guid}", async (Guid id, TransferOrderQueries queries, CancellationToken ct) =>
                await queries.GetAsync(id, ct).ConfigureAwait(false) is { } order ? Results.Ok(order) : Results.NotFound())
            .RequirePermission(OperationsPermissions.TransferView, companyWide: true);

        group.MapGet("/projects", async (DeliveryOrderQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ProjectsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.TransferCreate, companyWide: true);

        group.MapGet("/target-projects", async (TransferOrderService service, CancellationToken ct) =>
                Results.Ok(await service.TargetProjectsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.TransferCreate, companyWide: true);

        group.MapGet("/on-job-workers", async (Guid? orderId, Guid? fromProjectId, TransferOrderService service, CancellationToken ct) =>
                Results.Ok(await service.OnJobAsync(orderId, fromProjectId, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.TransferCreate, companyWide: true);

        group.MapPost("/prices", async (PriceRequest r, DeliveryOrderService service, IClock clock, CancellationToken ct) =>
                await service.PriceAsync(r.ProjectId, r.WorkerIds, r.On ?? clock.Today, null, ct).ConfigureAwait(false) is var result && result.IsSuccess
                    ? Results.Ok(result.Value)
                    : Problem(result.Error))
            .RequirePermission(OperationsPermissions.TransferCreate, companyWide: true);

        group.MapPost("/", async (TransferInput input, TransferOrderService service, CancellationToken ct) =>
                await service.CreateAsync(input, ct).ConfigureAwait(false) is var result && result.IsSuccess
                    ? Results.Json(result.Value, statusCode: StatusCodes.Status201Created)
                    : Problem(result.Error))
            .RequirePermission(OperationsPermissions.TransferCreate, companyWide: true);

        group.MapPut("/{id:guid}", async (Guid id, TransferInput input, TransferOrderService service, CancellationToken ct) =>
                await service.UpdateAsync(id, input, ct).ConfigureAwait(false) is var result && result.IsSuccess ? Results.Ok(result.Value) : Problem(result.Error))
            .RequirePermission(OperationsPermissions.TransferCreate, companyWide: true);

        group.MapPost("/{id:guid}/submit", async (Guid id, TransferOrderService service, CancellationToken ct) =>
                ToHttp(await service.SubmitAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.TransferCreate, companyWide: true);

        group.MapPut("/{id:guid}/amend", async (Guid id, TransferAmendInput input, TransferOrderService service, CancellationToken ct) =>
                ToHttp(await service.AmendAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.TransferAmend, companyWide: true);
        group.MapPost("/{id:guid}/cancel-approved", async (Guid id, CancelRequest r, TransferOrderService service, CancellationToken ct) =>
                ToHttp(await service.CancelApprovedAsync(id, r.Comment, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.TransferCancelApproved, companyWide: true);
        group.MapPost("/{id:guid}/cancel", async (Guid id, CancelRequest r, TransferOrderService service, CancellationToken ct) =>
                ToHttp(await service.CancelAsync(id, r.Comment, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.TransferCreate, companyWide: true);
    }

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}
