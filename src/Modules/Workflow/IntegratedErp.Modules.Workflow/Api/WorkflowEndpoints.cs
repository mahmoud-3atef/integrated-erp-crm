using System.Text.Json;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Identity.Contracts;
using IntegratedErp.Modules.Workflow.Application;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Workflow.Api;

/// <summary>Approval processes (design), the engine's inbox and requests, and internal requests — current company only.</summary>
internal static class WorkflowEndpoints
{
    public sealed record DraftRequest(string NameAr, string NameEn, int Priority, JsonElement Definition);

    public sealed record ActiveRequest(bool IsActive);

    public sealed record DecisionRequest(Decision Decision, string? Comment, Dictionary<string, string?>? Fields);

    public sealed record DelegateRequest(Guid UserId, string? Comment);

    public sealed record ReasonRequest(string? Reason);

    public static void MapWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/workflow").WithTags("Workflow").RequireAuthorization(PlatformPolicies.CompanyUser);

        // ---- Process design (company-wide).
        group.MapGet("/screens", (ProcessService service) => Results.Ok(service.Screens()))
            .RequirePermission(WorkflowPermissions.ProcessesView, companyWide: true);

        group.MapGet("/processes", async (ProcessService service, CancellationToken ct) =>
                Results.Ok(await service.ListAsync(ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.ProcessesView, companyWide: true);

        group.MapGet("/processes/{id:guid}", async (Guid id, ProcessService service, CancellationToken ct) =>
                ToHttp(await service.GetAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.ProcessesView, companyWide: true);

        group.MapPost("/processes", async (ProcessInput input, ProcessService service, CancellationToken ct) =>
                ToHttp(await service.CreateAsync(input, ct).ConfigureAwait(false), StatusCodes.Status201Created))
            .RequirePermission(WorkflowPermissions.ProcessesManage, companyWide: true);

        group.MapPut("/processes/{id:guid}/draft", async (Guid id, DraftRequest r, ProcessService service, CancellationToken ct) =>
                ToHttp(await service.SaveDraftAsync(id, r.NameAr, r.NameEn, r.Priority, r.Definition, ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.ProcessesManage, companyWide: true);

        group.MapPost("/processes/{id:guid}/validate", async (Guid id, ProcessService service, CancellationToken ct) =>
                ToHttp(await service.ValidateAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.ProcessesManage, companyWide: true);

        group.MapPost("/processes/{id:guid}/publish", async (Guid id, ProcessService service, CancellationToken ct) =>
                ToHttp(await service.PublishAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.ProcessesManage, companyWide: true);

        group.MapPut("/processes/{id:guid}/active", async (Guid id, ActiveRequest r, ProcessService service, CancellationToken ct) =>
                ToHttp(await service.SetActiveAsync(id, r.IsActive, ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.ProcessesManage, companyWide: true);

        group.MapGet("/approver-options", async (ProcessService service, CancellationToken ct) =>
                Results.Ok(await service.ApproverOptionsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.ProcessesView, companyWide: true);

        // ---- My tasks and my requests: every user sees and acts on their own only.
        group.MapGet("/inbox", async (string? scope, ApprovalQueries queries, CancellationToken ct) =>
            Results.Ok(await queries.InboxAsync(scope != "done", ct).ConfigureAwait(false)));

        group.MapGet("/inbox/count", async (ApprovalQueries queries, CancellationToken ct) =>
            Results.Ok(new { pending = await queries.PendingCountAsync(ct).ConfigureAwait(false) }));

        group.MapGet("/my-requests", async (ApprovalQueries queries, CancellationToken ct) =>
            Results.Ok(await queries.MineAsync(ct).ConfigureAwait(false)));

        group.MapPost("/work-items/{id:guid}/decision", async (Guid id, DecisionRequest r, ApprovalEngine engine, CancellationToken ct) =>
            ToHttp(await engine.DecideAsync(id, r.Decision, r.Comment, r.Fields, ct).ConfigureAwait(false)));

        group.MapPost("/work-items/{id:guid}/delegate", async (Guid id, DelegateRequest r, ApprovalEngine engine, CancellationToken ct) =>
            ToHttp(await engine.DelegateAsync(id, r.UserId, r.Comment, ct).ConfigureAwait(false)));

        // ---- One approval: participants and monitors.
        group.MapGet("/instances/{id:guid}", async (Guid id, ApprovalQueries queries, CancellationToken ct) =>
            ToHttp(await queries.DetailAsync(id, ct).ConfigureAwait(false)));

        group.MapPost("/instances/{id:guid}/cancel", async (Guid id, ReasonRequest r, ApprovalEngine engine, IPermissionService permissions, CancellationToken ct) =>
        {
            var canManage = (await permissions.GetCurrentAsync(ct).ConfigureAwait(false)).LegalEntitiesFor(WorkflowPermissions.ProcessesManage) is null;
            return ToHttp(await engine.CancelAsync(id, r.Reason, canManage, ct).ConfigureAwait(false));
        });

        // An administrator runs a chosen process on a record (e.g. after a stopped approval was canceled).
        group.MapPost("/instances/start", async (StartRequest r, ApprovalEngine engine, CancellationToken ct) =>
                await engine.RunOnRecordAsync(new ApprovalSubmission(r.Screen, r.RecordId, r.Title, null, r.ProcessId), ct).ConfigureAwait(false) is var started && started.IsSuccess
                    ? Results.Ok(new { id = started.Value })
                    : Problem(started.Error))
            .RequirePermission(WorkflowPermissions.ProcessesManage, companyWide: true);

        group.MapPost("/instances/{id:guid}/retry", async (Guid id, ApprovalEngine engine, CancellationToken ct) =>
                ToHttp(await engine.RetryAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.ProcessesManage, companyWide: true);

        group.MapGet("/instances", async (string? status, ApprovalQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.AllAsync(status, ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.InstancesView, companyWide: true);

        // People to pick (delegate to, direct manager): any signed-in member of the company.
        group.MapGet("/people", async (IAccessDirectory access, CancellationToken ct) =>
            Results.Ok(await access.ListMembersAsync(ct).ConfigureAwait(false)));

        // ---- Internal requests.
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

        group.MapPost("/requests/{id:guid}/submit", async (Guid id, InternalRequestService service, CancellationToken ct) =>
                ToHttp(await service.SubmitAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(WorkflowPermissions.RequestsCreate);
    }

    private static IResult ToHttp<T>(Result<T> result, int successStatus = StatusCodes.Status200OK) =>
        result.IsSuccess ? Results.Json(result.Value, statusCode: successStatus) : Problem(result.Error);

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("forbidden.", StringComparison.Ordinal) ? StatusCodes.Status403Forbidden
            : error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}

internal sealed record StartRequest(string Screen, Guid RecordId, Guid ProcessId, string Title);
