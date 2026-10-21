using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Operations.Application;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Operations.Api;

/// <summary>Worker movements: arrival, vacation and return, absconding and return, suspension and lifting, final exit.</summary>
internal static class MovementEndpoints
{
    public static void MapMovementEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/operations/movements").WithTags("Operations").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/", async (string? type, string? status, string? search, MovementQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ListAsync(type, status, search, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.MovementsView, companyWide: true);

        group.MapGet("/{id:guid}", async (Guid id, MovementQueries queries, CancellationToken ct) =>
                await queries.GetAsync(id, ct).ConfigureAwait(false) is { } movement ? Results.Ok(movement) : Results.NotFound())
            .RequirePermission(OperationsPermissions.MovementsView, companyWide: true);

        // The movement form: workers to choose from, what each can have now, the projects and a return's price.
        group.MapGet("/workers", async (string? search, IWorkforceDirectory workforce, CancellationToken ct) =>
                Results.Ok(string.IsNullOrWhiteSpace(search) ? [] : await workforce.SearchAsync(search, 20, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.MovementsManage, companyWide: true);

        group.MapGet("/options/{workerId:guid}", async (Guid workerId, Guid? except, MovementService service, CancellationToken ct) =>
                await service.OptionsAsync(workerId, except, ct).ConfigureAwait(false) is { } options ? Results.Ok(options) : Results.NotFound())
            .RequirePermission(OperationsPermissions.MovementsManage, companyWide: true);

        group.MapGet("/projects", async (DeliveryOrderQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ProjectsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.MovementsManage, companyWide: true);

        group.MapGet("/quote", async (Guid workerId, Guid projectId, DateOnly? on, MovementService service, IClock clock, CancellationToken ct) =>
                await service.QuoteAsync(workerId, projectId, on ?? clock.Today, ct).ConfigureAwait(false) is var result && result.IsSuccess ? Results.Ok(result.Value) : Problem(result.Error))
            .RequirePermission(OperationsPermissions.MovementsManage, companyWide: true);

        group.MapPost("/", async (MovementInput input, MovementService service, CancellationToken ct) =>
                await service.CreateAsync(input, ct).ConfigureAwait(false) is var result && result.IsSuccess ? Results.Ok(result.Value) : Problem(result.Error))
            .RequirePermission(OperationsPermissions.MovementsManage, companyWide: true);

        group.MapPut("/{id:guid}", async (Guid id, MovementInput input, MovementService service, CancellationToken ct) =>
                await service.UpdateAsync(id, input, ct).ConfigureAwait(false) is var result && result.IsSuccess ? Results.Ok(result.Value) : Problem(result.Error))
            .RequirePermission(OperationsPermissions.MovementsManage, companyWide: true);

        group.MapPost("/{id:guid}/submit", async (Guid id, MovementService service, CancellationToken ct) =>
                ToHttp(await service.SubmitAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.MovementsManage, companyWide: true);

        // Each type of action has its own permissions to change or cancel it after its approval (checked by the service).
        group.MapPut("/{id:guid}/amend", async (Guid id, MovementAmendInput input, MovementService service, CancellationToken ct) =>
                ToHttp(await service.AmendAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.MovementsView, companyWide: true);
        group.MapPost("/{id:guid}/cancel-approved", async (Guid id, CancelRequest r, MovementService service, CancellationToken ct) =>
                ToHttp(await service.CancelApprovedAsync(id, r.Comment, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.MovementsView, companyWide: true);

        group.MapPost("/{id:guid}/cancel", async (Guid id, CancelRequest? r, MovementService service, CancellationToken ct) =>
                ToHttp(await service.CancelAsync(id, r?.Comment, ct).ConfigureAwait(false)))
            .RequirePermission(OperationsPermissions.MovementsManage, companyWide: true);
    }

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : error.Code.StartsWith("forbidden.", StringComparison.Ordinal) ? StatusCodes.Status403Forbidden
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}
