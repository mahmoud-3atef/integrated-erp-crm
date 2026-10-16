using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Identity.Contracts;
using IntegratedErp.Modules.Workflow.Application;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Workflow.Api;

/// <summary>Approval routes, my tasks and decisions, and internal requests (always the current company).</summary>
internal static class WorkflowEndpoints
{
    public sealed record StageRequest(string NameAr, string NameEn, ApproverKind Kind, Guid? UserId, Guid? RoleId, string? DynamicKey);

    public sealed record RouteRequest(IReadOnlyList<StageRequest>? Stages, bool IsActive = true);

    public sealed record DecisionRequest(Decision Decision, string? Comment);

    public sealed record SubmitRequest(Guid? DirectManagerUserId);

    public static void MapWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/workflow").WithTags("Workflow").RequireAuthorization(PlatformPolicies.CompanyUser);

        // Routes (company-wide settings).
        group.MapGet("/routes", async (RouteService service, CancellationToken ct) =>
                Results.Ok(await service.ListAsync(ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.RoutesView, companyWide: true);

        group.MapGet("/routes/{documentType}/versions", async (string documentType, RouteService service, CancellationToken ct) =>
                ToHttp(await service.VersionsAsync(documentType, ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.RoutesView, companyWide: true);

        group.MapPut("/routes/{documentType}", async (string documentType, RouteRequest r, RouteService service, CancellationToken ct) =>
            {
                var stages = (r.Stages ?? []).Select(s => new StageInput(s.NameAr ?? string.Empty, s.NameEn ?? string.Empty, s.Kind, s.UserId, s.RoleId, s.DynamicKey)).ToList();
                return ToHttp(await service.PublishAsync(documentType, stages, r.IsActive, ct).ConfigureAwait(false));
            })
            .RequirePermission(WorkflowPermissions.RoutesManage, companyWide: true);

        group.MapGet("/approver-options", async (RouteService service, CancellationToken ct) =>
                Results.Ok(await service.ApproverOptionsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.RoutesView, companyWide: true);

        // My tasks: every signed-in user sees and decides only their own.
        group.MapGet("/tasks", async (string? scope, ApprovalEngine engine, CancellationToken ct) =>
            Results.Ok(await engine.MyTasksAsync(scope != "done", ct).ConfigureAwait(false)));

        group.MapGet("/tasks/count", async (ApprovalEngine engine, CancellationToken ct) =>
            Results.Ok(new { pending = await engine.PendingCountAsync(ct).ConfigureAwait(false) }));

        group.MapPost("/tasks/{id:guid}/decision", async (Guid id, DecisionRequest r, ApprovalEngine engine, CancellationToken ct) =>
            ToHttp(await engine.DecideAsync(id, r.Decision, r.Comment, ct).ConfigureAwait(false)));

        // Internal requests: own requests; all of the company with the view permission.
        group.MapGet("/requests", async (bool? all, InternalRequestService service, CancellationToken ct) =>
            Results.Ok(await service.ListAsync(all == true, ct).ConfigureAwait(false)));

        group.MapGet("/requests/{id:guid}", async (Guid id, InternalRequestService service, CancellationToken ct) =>
            ToHttp(await service.GetAsync(id, ct).ConfigureAwait(false)));

        group.MapPost("/requests", async (RequestInput r, InternalRequestService service, CancellationToken ct) =>
                ToHttp(await service.CreateAsync(r, ct).ConfigureAwait(false), StatusCodes.Status201Created))
            .RequirePermission(WorkflowPermissions.RequestsCreate);

        group.MapPut("/requests/{id:guid}", async (Guid id, RequestInput r, InternalRequestService service, CancellationToken ct) =>
                ToHttp(await service.UpdateAsync(id, r, ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.RequestsCreate);

        // People to pick as the direct manager when submitting.
        group.MapGet("/requests/people", async (IAccessDirectory access, CancellationToken ct) =>
                Results.Ok(await access.ListMembersAsync(ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.RequestsCreate);

        group.MapPost("/requests/{id:guid}/submit", async (Guid id, SubmitRequest? r, InternalRequestService service, CancellationToken ct) =>
                ToHttp(await service.SubmitAsync(id, r?.DirectManagerUserId, ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.RequestsCreate);
    }

    private static IResult ToHttp<T>(Result<T> result, int successStatus = StatusCodes.Status200OK) =>
        result.IsSuccess ? Results.Json(result.Value, statusCode: successStatus) : Problem(result.Error);

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}
