using System.Text.Json;
using IntegratedErp.BuildingBlocks.Approvals;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Documents.Contracts;
using IntegratedErp.Modules.Identity.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace IntegratedErp.Modules.Workflow.Application;

public sealed record TaskDto(
    Guid Id,
    Guid InstanceId,
    string DocumentType,
    string DocumentTypeNameAr,
    string DocumentTypeNameEn,
    Guid DocumentId,
    string Title,
    string? Link,
    int StageOrder,
    int StageCount,
    string StageNameAr,
    string StageNameEn,
    string SubmittedBy,
    DateTimeOffset SubmittedAt,
    string Status,
    bool IsEscalated,
    DateTimeOffset? DecidedAt,
    string? Comment);

/// <summary>
/// The approval engine: starts a document on its company route (pinned to the current route version), opens each
/// stage for its approvers, records decisions, tells the owning module the outcome, and notifies the people involved.
/// </summary>
internal sealed partial class ApprovalEngine(
    WorkflowDbContext db,
    ApprovalDocumentCatalog documents,
    IAccessDirectory access,
    IEnumerable<IApprovalOutcomeHandler> handlers,
    IEnumerable<INotifier> notifiers,
    ITenantContext tenant,
    ICurrentUser user,
    IClock clock,
    ILogger<ApprovalEngine> logger) : IApprovalService
{
    public static readonly Error UnknownDocumentType = Error.Validation("approval_document_unknown", "Unknown document type.");
    public static readonly Error NoRoute = Error.Validation("approval_no_route", "No active approval route is defined for this document type.");
    public static readonly Error AlreadyInApproval = Error.Conflict("approval_in_progress", "The document is already in approval.");
    public static readonly Error ChangedMeanwhile = Error.Conflict("approval_changed", "Someone else decided this first. Refresh and try again.");

    public async Task<Result<Guid>> SubmitAsync(ApprovalSubmission submission, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(submission);
        if (documents.Find(submission.DocumentType) is not { } definition)
        {
            return Result.Failure<Guid>(UnknownDocumentType);
        }

        var route = await db.Routes.Include(r => r.Versions).ThenInclude(v => v.Stages)
            .FirstOrDefaultAsync(r => r.DocumentType == submission.DocumentType, cancellationToken).ConfigureAwait(false);
        if (route is not { IsActive: true, Current: { } version })
        {
            return Result.Failure<Guid>(NoRoute);
        }

        if (await db.Instances.AnyAsync(
                i => i.DocumentType == submission.DocumentType && i.DocumentId == submission.DocumentId && i.Status == InstanceStatus.InProgress,
                cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(AlreadyInApproval);
        }

        var submitter = CurrentUserId();
        var dynamic = submission.DynamicApprovers ?? new Dictionary<string, Guid>();
        var members = await MemberNamesAsync(cancellationToken).ConfigureAwait(false);
        var stages = version.Stages.OrderBy(s => s.Order).ToList();

        // Every stage must have someone other than the submitter today; otherwise say which stage, before starting.
        var resolved = new List<IReadOnlyCollection<(Guid, string)>>();
        foreach (var stage in stages)
        {
            var approvers = (await ResolveAsync(stage, submission.LegalEntityId, dynamic, members, cancellationToken).ConfigureAwait(false))
                .Where(a => a.UserId != submitter).ToList();
            if (approvers.Count == 0)
            {
                return Result.Failure<Guid>(Error.Validation("approval_stage_unassigned", $"Stage {stage.Order} ({stage.NameEn}) has no approver other than the submitter."));
            }

            resolved.Add(approvers.Select(a => (a.UserId, a.Name)).ToList());
        }

        var instance = new ApprovalInstance(
            submission.DocumentType,
            submission.DocumentId,
            submission.Title,
            version.Id,
            stages.Count,
            submission.LegalEntityId,
            JsonSerializer.Serialize(dynamic),
            submitter,
            user.DisplayName,
            clock.UtcNow);
        instance.OpenStage(1, stages[0].NameAr, stages[0].NameEn, resolved[0], escalated: false);
        db.Instances.Add(instance);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        await NotifyTasksAsync(instance, definition, 1, cancellationToken).ConfigureAwait(false);
        return Result.Success(instance.Id);
    }

    public async Task<Result> DecideAsync(Guid taskId, Decision decision, string? comment, CancellationToken cancellationToken)
    {
        var instance = await db.Instances.Include(i => i.Tasks)
            .FirstOrDefaultAsync(i => i.Tasks.Any(t => t.Id == taskId), cancellationToken).ConfigureAwait(false);
        if (instance is null)
        {
            return Result.Failure(Error.NotFound("approval_task", "Task not found."));
        }

        var decided = instance.Decide(taskId, CurrentUserId(), decision, comment, clock.UtcNow);
        if (decided.IsFailure)
        {
            return decided;
        }

        var definition = documents.Find(instance.DocumentType);
        if (decided.Value)
        {
            var opened = await OpenCurrentStageAsync(instance, cancellationToken).ConfigureAwait(false);
            if (opened.IsFailure)
            {
                return opened;
            }
        }
        else
        {
            // The owning module updates its document in the same request (same transaction when it shares this database context).
            var outcome = instance.Status switch
            {
                InstanceStatus.Approved => ApprovalOutcome.Approved,
                InstanceStatus.Rejected => ApprovalOutcome.Rejected,
                _ => ApprovalOutcome.Returned,
            };
            foreach (var handler in handlers.Where(h => h.DocumentType == instance.DocumentType))
            {
                await handler.OnCompletedAsync(instance.DocumentId, outcome, comment?.Trim(), cancellationToken).ConfigureAwait(false);
            }
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure(ChangedMeanwhile);
        }

        if (definition is not null)
        {
            if (decided.Value)
            {
                await NotifyTasksAsync(instance, definition, instance.CurrentStage, cancellationToken).ConfigureAwait(false);
            }
            else
            {
                await NotifyOutcomeAsync(instance, definition, comment, cancellationToken).ConfigureAwait(false);
            }
        }

        return Result.Success();
    }

    public async Task<IReadOnlyList<TaskDto>> MyTasksAsync(bool pending, CancellationToken cancellationToken)
    {
        var me = CurrentUserId();
        var query =
            from t in db.Tasks.AsNoTracking()
            join i in db.Instances.AsNoTracking() on t.InstanceId equals i.Id
            where t.AssigneeUserId == me
            select new { Task = t, Instance = i };
        query = pending
            ? query.Where(x => x.Task.Status == ApprovalTaskStatus.Pending && x.Instance.Status == InstanceStatus.InProgress && x.Instance.CurrentStage == x.Task.StageOrder)
            : query.Where(x => x.Task.Status != ApprovalTaskStatus.Pending && x.Task.Status != ApprovalTaskStatus.Closed);
        var rows = await (pending ? query.OrderBy(x => x.Instance.SubmittedAt) : query.OrderByDescending(x => x.Task.DecidedAt))
            .Take(100).ToListAsync(cancellationToken).ConfigureAwait(false);

        return rows.Select(x =>
        {
            var definition = documents.Find(x.Instance.DocumentType);
            return new TaskDto(
                x.Task.Id, x.Instance.Id, x.Instance.DocumentType, definition?.NameAr ?? x.Instance.DocumentType, definition?.NameEn ?? x.Instance.DocumentType,
                x.Instance.DocumentId, x.Instance.Title, definition?.LinkTo(x.Instance.DocumentId), x.Task.StageOrder, x.Instance.StageCount,
                x.Task.StageNameAr, x.Task.StageNameEn, x.Instance.SubmittedByName, x.Instance.SubmittedAt, x.Task.Status.ToString(),
                x.Task.IsEscalated, x.Task.DecidedAt, x.Task.Comment);
        }).ToList();
    }

    public Task<int> PendingCountAsync(CancellationToken cancellationToken)
    {
        var me = CurrentUserId();
        return (from t in db.Tasks
                join i in db.Instances on t.InstanceId equals i.Id
                where t.AssigneeUserId == me && t.Status == ApprovalTaskStatus.Pending && i.Status == InstanceStatus.InProgress && i.CurrentStage == t.StageOrder
                select t.Id).CountAsync(cancellationToken);
    }

    public async Task<ApprovalTimeline?> TimelineAsync(string documentType, Guid documentId, CancellationToken cancellationToken)
    {
        var instance = await db.Instances.AsNoTracking().Include(i => i.Tasks)
            .Where(i => i.DocumentType == documentType && i.DocumentId == documentId)
            .OrderByDescending(i => i.SubmittedAt)
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (instance is null)
        {
            return null;
        }

        var stages = await db.RouteVersions.AsNoTracking().Where(v => v.Id == instance.RouteVersionId)
            .SelectMany(v => v.Stages).OrderBy(s => s.Order).ToListAsync(cancellationToken).ConfigureAwait(false);
        var steps = stages.Select(stage =>
        {
            var tasks = instance.Tasks.Where(t => t.StageOrder == stage.Order).ToList();
            var decided = tasks.FirstOrDefault(t => t.Status is ApprovalTaskStatus.Approved or ApprovalTaskStatus.Rejected or ApprovalTaskStatus.Returned);
            var status = decided?.Status.ToString()
                ?? (tasks.Count > 0 && instance.Status == InstanceStatus.InProgress ? "Pending" : "Waiting");
            return new ApprovalTimelineStep(
                stage.Order, stage.NameAr, stage.NameEn, status, tasks.Select(t => t.AssigneeName).Distinct().ToList(),
                decided?.AssigneeName, decided?.DecidedAt, decided?.Comment);
        }).ToList();

        return new ApprovalTimeline(instance.Id, instance.Status.ToString(), instance.CurrentStage, instance.StageCount, instance.SubmittedByName, instance.SubmittedAt, steps);
    }

    /// <summary>Whether the current user takes part in the document's approval (submitter or approver).</summary>
    public async Task<bool> IsParticipantAsync(string documentType, Guid documentId, CancellationToken cancellationToken)
    {
        var me = CurrentUserId();
        return await db.Instances.AnyAsync(
            i => i.DocumentType == documentType && i.DocumentId == documentId && (i.SubmittedBy == me || i.Tasks.Any(t => t.AssigneeUserId == me)),
            cancellationToken).ConfigureAwait(false);
    }

    private async Task<Result> OpenCurrentStageAsync(ApprovalInstance instance, CancellationToken cancellationToken)
    {
        var stage = await db.RouteVersions.Where(v => v.Id == instance.RouteVersionId).SelectMany(v => v.Stages)
            .FirstAsync(s => s.Order == instance.CurrentStage, cancellationToken).ConfigureAwait(false);
        var dynamic = JsonSerializer.Deserialize<Dictionary<string, Guid>>(instance.DynamicApprovers) ?? [];
        var members = await MemberNamesAsync(cancellationToken).ConfigureAwait(false);
        var approvers = (await ResolveAsync(stage, instance.LegalEntityId, dynamic, members, cancellationToken).ConfigureAwait(false))
            .Where(a => a.UserId != instance.SubmittedBy).ToList();
        var escalated = false;
        if (approvers.Count == 0)
        {
            // Roles or people changed since submission: the company administrators take the stage.
            escalated = true;
            foreach (var admin in (await access.ListRolesAsync(cancellationToken).ConfigureAwait(false)).Where(r => r.IsAdministrator && r.IsActive))
            {
                approvers.AddRange((await access.MembersInRoleAsync(admin.Id, null, cancellationToken).ConfigureAwait(false))
                    .Where(id => id != instance.SubmittedBy && members.ContainsKey(id))
                    .Select(id => (id, members[id])));
            }
        }

        if (approvers.Count == 0)
        {
            return Result.Failure(Error.Validation("approval_stage_unassigned", $"Stage {stage.Order} ({stage.NameEn}) has no approver."));
        }

        instance.OpenStage(stage.Order, stage.NameAr, stage.NameEn, approvers.Select(a => (a.UserId, a.Name)).Distinct().ToList(), escalated);
        return Result.Success();
    }

    private async Task<List<(Guid UserId, string Name)>> ResolveAsync(
        ApprovalStage stage, Guid? legalEntityId, IReadOnlyDictionary<string, Guid> dynamic, Dictionary<Guid, string> members, CancellationToken cancellationToken)
    {
        IEnumerable<Guid> ids = stage.Kind switch
        {
            ApproverKind.User when stage.UserId is { } id => [id],
            ApproverKind.Role when stage.RoleId is { } roleId => await access.MembersInRoleAsync(roleId, legalEntityId, cancellationToken).ConfigureAwait(false),
            ApproverKind.Dynamic when stage.DynamicKey is { } key && dynamic.TryGetValue(key, out var id) => [id],
            _ => [],
        };

        // Only active members of this company can approve.
        return ids.Distinct().Where(members.ContainsKey).Select(id => (id, members[id])).ToList();
    }

    private async Task<Dictionary<Guid, string>> MemberNamesAsync(CancellationToken cancellationToken) =>
        (await access.ListMembersAsync(cancellationToken).ConfigureAwait(false)).ToDictionary(m => m.UserAccountId, m => m.DisplayName);

    private Task NotifyTasksAsync(ApprovalInstance instance, ApprovalDocumentDefinition definition, int stage, CancellationToken cancellationToken)
    {
        var recipients = instance.Tasks.Where(t => t.StageOrder == stage && t.Status == ApprovalTaskStatus.Pending).Select(t => t.AssigneeUserId).Distinct().ToList();
        return NotifyAsync(
            new NotificationRequest(
                recipients,
                "workflow.task_assigned",
                $"بانتظار اعتمادك: {definition.NameAr}",
                $"Awaiting your approval: {definition.NameEn}",
                $"«{instance.Title}» من {instance.SubmittedByName} — المرحلة {stage} من {instance.StageCount}.",
                $"“{instance.Title}” from {instance.SubmittedByName} — stage {stage} of {instance.StageCount}.",
                "/workflow/tasks"),
            cancellationToken);
    }

    private Task NotifyOutcomeAsync(ApprovalInstance instance, ApprovalDocumentDefinition definition, string? comment, CancellationToken cancellationToken)
    {
        var (ar, en) = instance.Status switch
        {
            InstanceStatus.Approved => ("تم اعتماد", "Approved"),
            InstanceStatus.Rejected => ("تم رفض", "Rejected"),
            _ => ("أُعيد للتعديل", "Returned for changes"),
        };
        var reasonAr = string.IsNullOrWhiteSpace(comment) ? string.Empty : $" السبب: {comment.Trim()}";
        var reasonEn = string.IsNullOrWhiteSpace(comment) ? string.Empty : $" Reason: {comment.Trim()}";
        return NotifyAsync(
            new NotificationRequest(
                [instance.SubmittedBy],
                "workflow.completed",
                $"{ar}: {definition.NameAr}",
                $"{en}: {definition.NameEn}",
                $"«{instance.Title}» — {ar}.{reasonAr}",
                $"“{instance.Title}” — {en}.{reasonEn}",
                definition.LinkTo(instance.DocumentId)),
            cancellationToken);
    }

    /// <summary>Best effort after the decision is saved: a failed notification never undoes an approval.</summary>
    private async Task NotifyAsync(NotificationRequest request, CancellationToken cancellationToken)
    {
        foreach (var notifier in notifiers)
        {
            try
            {
                await notifier.NotifyAsync(request, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogNotifyFailed(logger, request.Kind, ex);
            }
        }
    }

    private Guid CurrentUserId() =>
        tenant.TenantId is not null && Guid.TryParse(user.UserId, out var id) ? id : throw new InvalidOperationException("A signed-in company user is required.");

    [LoggerMessage(Level = LogLevel.Warning, Message = "Notification {Kind} could not be sent")]
    private static partial void LogNotifyFailed(ILogger logger, string kind, Exception exception);
}
