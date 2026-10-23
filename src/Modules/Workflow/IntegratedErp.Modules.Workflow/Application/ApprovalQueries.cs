using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workflow.Application;

public sealed record WorkItemDto(
    Guid Id,
    Guid InstanceId,
    string Screen,
    string ScreenNameAr,
    string ScreenNameEn,
    string ProcessNameAr,
    string ProcessNameEn,
    string Title,
    string? Link,
    string StepNameAr,
    string StepNameEn,
    string SubmittedBy,
    DateTimeOffset SubmittedAt,
    DateTimeOffset AssignedAt,
    DateTimeOffset? DueAt,
    bool IsOverdue,
    bool IsDelegated,
    string Status,
    DateTimeOffset? DecidedAt,
    string? Comment);

public sealed record InstanceSummaryDto(
    Guid Id,
    string Screen,
    string ScreenNameAr,
    string ScreenNameEn,
    string ProcessNameAr,
    string ProcessNameEn,
    int Version,
    string Title,
    string? Link,
    string Status,
    string? WaitingStepAr,
    string? WaitingStepEn,
    string SubmittedBy,
    DateTimeOffset SubmittedAt,
    DateTimeOffset? CompletedAt,
    string? Error);

public sealed record FieldValueDto(RecordField Field, string? Value);

/// <summary>What the current user may do on an approval.</summary>
public sealed record AvailableActionsDto(
    Guid? WorkItemId,
    bool CanApprove,
    bool CanReject,
    bool CanReturn,
    bool CanDelegate,
    bool CanCancel,
    bool CanRetry,
    IReadOnlyList<FieldValueDto> RequiredFields,
    IReadOnlyList<ReassignableTaskDto>? Reassignable = null)
{
    /// <summary>The earlier stages a return may go back to (the stages this approval has already opened), oldest first.</summary>
    public IReadOnlyList<ReturnTargetDto> ReturnTargets { get; init; } = [];
}

/// <summary>An earlier stage of the approval a return can go back to.</summary>
public sealed record ReturnTargetDto(string StepId, string NameAr, string NameEn);

/// <summary>An open task of the current stage that an administrator of the tasks may give to someone else.</summary>
public sealed record ReassignableTaskDto(Guid WorkItemId, Guid AssigneeUserId, string AssigneeName);

public sealed record InstanceDetailDto(InstanceSummaryDto Summary, ApprovalStatusInfo Status, IReadOnlyList<FieldValueDto> Record, AvailableActionsDto Actions);

/// <summary>Inbox, "my requests", one approval's detail, and the monitor of all approvals.</summary>
internal sealed class ApprovalQueries(WorkflowDbContext db, ApprovalEngine engine, IPermissionService permissions, IClock clock)
{
    public async Task<IReadOnlyList<WorkItemDto>> InboxAsync(bool pending, CancellationToken cancellationToken)
    {
        var me = engine.Me();
        var query =
            from w in db.WorkItems.AsNoTracking()
            join i in db.Instances.AsNoTracking() on w.InstanceId equals i.Id
            where w.AssigneeUserId == me
            select new { Item = w, Instance = i };
        query = pending
            ? query.Where(x => x.Item.Status == WorkItemStatus.Pending && x.Instance.Status == InstanceStatus.InProgress && x.Instance.WaitingStepId == x.Item.StepId)
            : query.Where(x => x.Item.Status == WorkItemStatus.Approved || x.Item.Status == WorkItemStatus.Rejected || x.Item.Status == WorkItemStatus.Returned || x.Item.Status == WorkItemStatus.Delegated);
        var rows = await (pending ? query.OrderBy(x => x.Item.CreatedAt) : query.OrderByDescending(x => x.Item.DecidedAt))
            .Take(200).ToListAsync(cancellationToken).ConfigureAwait(false);
        var now = clock.UtcNow;
        return rows.Select(x =>
        {
            var screen = engine.AdapterFor(x.Instance.Screen)?.Screen;
            return new WorkItemDto(
                x.Item.Id, x.Instance.Id, x.Instance.Screen, screen?.NameAr ?? x.Instance.Screen, screen?.NameEn ?? x.Instance.Screen,
                x.Instance.ProcessNameAr, x.Instance.ProcessNameEn, x.Instance.Title, screen?.LinkTo(x.Instance.RecordId),
                x.Item.StepNameAr, x.Item.StepNameEn, x.Instance.SubmittedByName, x.Instance.SubmittedAt, x.Item.CreatedAt, x.Item.DueAt,
                x.Item.IsOpen && x.Item.DueAt < now, x.Item.DelegatedFrom is not null, x.Item.Status.ToString(), x.Item.DecidedAt, x.Item.Comment);
        }).ToList();
    }

    public Task<int> PendingCountAsync(CancellationToken cancellationToken)
    {
        var me = engine.Me();
        return (from w in db.WorkItems
                join i in db.Instances on w.InstanceId equals i.Id
                where w.AssigneeUserId == me && w.Status == WorkItemStatus.Pending && i.Status == InstanceStatus.InProgress && i.WaitingStepId == w.StepId
                select w.Id).CountAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<InstanceSummaryDto>> MineAsync(CancellationToken cancellationToken)
    {
        var me = engine.Me();
        var rows = await db.Instances.AsNoTracking().Where(i => i.SubmittedBy == me).OrderByDescending(i => i.SubmittedAt)
            .Take(200).ToListAsync(cancellationToken).ConfigureAwait(false);
        return rows.Select(Summary).ToList();
    }

    /// <summary>Every approval of the company (like CRM system jobs), for those who monitor them.</summary>
    public async Task<IReadOnlyList<InstanceSummaryDto>> AllAsync(string? status, CancellationToken cancellationToken)
    {
        var query = db.Instances.AsNoTracking();
        if (Enum.TryParse<InstanceStatus>(status, out var only))
        {
            query = query.Where(i => i.Status == only);
        }

        var rows = await query.OrderByDescending(i => i.SubmittedAt).Take(500).ToListAsync(cancellationToken).ConfigureAwait(false);
        return rows.Select(Summary).ToList();
    }

    /// <summary>For the submitter, anyone who held a task on it, and those who monitor approvals.</summary>
    public async Task<Result<InstanceDetailDto>> DetailAsync(Guid instanceId, CancellationToken cancellationToken)
    {
        var instance = await db.Instances.AsNoTracking().FirstOrDefaultAsync(i => i.Id == instanceId, cancellationToken).ConfigureAwait(false);
        var mine = await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false);
        var monitor = mine.LegalEntitiesFor(WorkflowPermissions.InstancesView) is null;
        if (instance is null || (!monitor && !await engine.IsParticipantAsync(instanceId, cancellationToken).ConfigureAwait(false)))
        {
            return Result.Failure<InstanceDetailDto>(Error.NotFound("approval_instance", "Approval not found."));
        }

        var adapter = engine.AdapterFor(instance.Screen);
        var values = adapter is null ? null : await adapter.ReadAsync(instance.RecordId, cancellationToken).ConfigureAwait(false);
        var record = adapter is null || values is null
            ? []
            : adapter.Screen.Fields.Select(f => new FieldValueDto(f, values.GetValueOrDefault(f.Key))).ToList();

        var me = engine.Me();
        var item = instance.Status == InstanceStatus.InProgress
            ? await db.WorkItems.AsNoTracking().FirstOrDefaultAsync(
                w => w.InstanceId == instance.Id && w.AssigneeUserId == me && w.Status == WorkItemStatus.Pending && w.StepId == instance.WaitingStepId,
                cancellationToken).ConfigureAwait(false)
            : null;
        ApprovalStep? step = null;
        if (item is not null)
        {
            step = DefinitionRules.Walk((await engine.DefinitionAsync(instance.VersionId, cancellationToken).ConfigureAwait(false)).Steps)
                .OfType<ApprovalStep>().FirstOrDefault(s => s.Id == item.StepId);
        }

        var running = instance.Status is InstanceStatus.InProgress or InstanceStatus.Failed;
        var canManage = mine.LegalEntitiesFor(WorkflowPermissions.ProcessesManage) is null;
        var reassignable = instance.Status == InstanceStatus.InProgress && mine.LegalEntitiesFor(WorkflowPermissions.TasksReassign) is null
            ? await db.WorkItems.AsNoTracking()
                .Where(w => w.InstanceId == instance.Id && w.Status == WorkItemStatus.Pending && w.StepId == instance.WaitingStepId)
                .OrderBy(w => w.CreatedAt)
                .Select(w => new ReassignableTaskDto(w.Id, w.AssigneeUserId, w.AssigneeName))
                .ToListAsync(cancellationToken).ConfigureAwait(false)
            : [];
        var targets = step?.AllowReturn == true
            ? (await db.WorkItems.AsNoTracking()
                    .Where(w => w.InstanceId == instance.Id && w.StepId != step.Id && w.StageCursor != null)
                    .Select(w => new { w.StepId, w.StepNameAr, w.StepNameEn, w.CreatedAt })
                    .ToListAsync(cancellationToken).ConfigureAwait(false))
                .GroupBy(w => w.StepId)
                .Select(g => g.OrderBy(w => w.CreatedAt).First())
                .OrderBy(w => w.CreatedAt)
                .Select(w => new ReturnTargetDto(w.StepId, w.StepNameAr, w.StepNameEn))
                .ToList()
            : [];
        var actions = new AvailableActionsDto(
            item?.Id,
            step is not null,
            step is not null,
            step?.AllowReturn == true,
            step?.AllowDelegate == true,
            running && (instance.SubmittedBy == me || canManage),
            instance.Status == InstanceStatus.Failed && canManage,
            step is null || adapter is null
                ? []
                : step.RequiredFields.Select(key => adapter.Screen.Fields.First(f => f.Key == key))
                    .Select(f => new FieldValueDto(f, values?.GetValueOrDefault(f.Key))).ToList(),
            reassignable)
        {
            ReturnTargets = targets,
        };

        return Result.Success(new InstanceDetailDto(Summary(instance), await engine.StatusOfAsync(instance, cancellationToken).ConfigureAwait(false), record, actions));
    }

    private InstanceSummaryDto Summary(ApprovalInstance i)
    {
        var screen = engine.AdapterFor(i.Screen)?.Screen;
        return new InstanceSummaryDto(
            i.Id, i.Screen, screen?.NameAr ?? i.Screen, screen?.NameEn ?? i.Screen, i.ProcessNameAr, i.ProcessNameEn, i.Version, i.Title,
            screen?.LinkTo(i.RecordId), i.Status.ToString(), i.WaitingStepAr, i.WaitingStepEn, i.SubmittedByName, i.SubmittedAt, i.CompletedAt, i.Error);
    }
}
