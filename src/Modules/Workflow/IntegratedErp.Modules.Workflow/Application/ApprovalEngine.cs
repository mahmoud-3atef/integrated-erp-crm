using System.Text.Json;
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

public enum Decision
{
    Approve,
    Reject,
    Return,
}

/// <summary>
/// Runs approval processes. A submitted record starts the first matching active process (pinned to its current
/// version); the engine walks the steps, stops at each approval stage until it is decided, and asks the owning
/// module (through its adapter) to update the record. Every step leaves an append-only history entry.
/// </summary>
internal sealed partial class ApprovalEngine(
    WorkflowDbContext db,
    IEnumerable<IApprovalRecordAdapter> adapters,
    IAccessDirectory access,
    IEnumerable<INotifier> notifiers,
    ITenantContext tenant,
    ICurrentUser user,
    IClock clock,
    ILogger<ApprovalEngine> logger) : IApprovalService
{
    private const int MaxStepsPerRun = 200;

    public static readonly Error UnknownScreen = Error.Validation("approval_screen_unknown", "Unknown screen.");
    public static readonly Error RecordNotFound = Error.NotFound("approval_record", "The record was not found.");
    public static readonly Error NoProcess = Error.Validation("approval_no_process", "No active approval process applies to this record.");
    public static readonly Error AlreadyRunning = Error.Conflict("approval_in_progress", "The record is already in approval.");
    public static readonly Error ChangedMeanwhile = Error.Conflict("approval_changed", "Someone else acted first. Refresh and try again.");
    public static readonly Error WorkItemNotFound = Error.NotFound("approval_task", "Task not found.");
    public static readonly Error WorkItemClosed = Error.Conflict("approval_task_closed", "This task is no longer open.");
    public static readonly Error ReasonRequired = Error.Validation("approval_comment_required", "A reason is required to reject or return.");
    public static readonly Error NotAllowed = new("forbidden.approval", "You cannot do this on this approval.");

    private readonly Dictionary<Guid, ProcessDefinition> _definitions = [];
    private Dictionary<Guid, string>? _members;

    public IReadOnlyList<ApprovalScreen> Screens => adapters.Select(a => a.Screen).ToList();

    public IApprovalRecordAdapter? AdapterFor(string screen) => adapters.FirstOrDefault(a => a.Screen.Code == screen);

    // ------------------------------------------------------------------ Submit

    public async Task<Result<Guid>> SubmitAsync(ApprovalSubmission submission, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(submission);
        if (AdapterFor(submission.Screen) is not { } adapter)
        {
            return Result.Failure<Guid>(UnknownScreen);
        }

        if (await adapter.ReadAsync(submission.RecordId, cancellationToken).ConfigureAwait(false) is not { } values)
        {
            return Result.Failure<Guid>(RecordNotFound);
        }

        if (await db.Instances.AnyAsync(
                i => i.Screen == submission.Screen && i.RecordId == submission.RecordId && (i.Status == InstanceStatus.InProgress || i.Status == InstanceStatus.Failed),
                cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(AlreadyRunning);
        }

        await EnsureDefaultProcessAsync(adapter.Screen, cancellationToken).ConfigureAwait(false);
        var fields = adapter.Screen.Fields.ToDictionary(f => f.Key, StringComparer.Ordinal);
        var processes = await db.Processes.AsNoTracking().Include(p => p.Versions)
            .Where(p => p.Screen == submission.Screen && p.IsActive && (submission.ProcessId == null || p.Id == submission.ProcessId))
            .OrderBy(p => p.Priority).ThenBy(p => p.NameEn)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        // A process chosen by an administrator runs whatever its start condition says.
        var match = processes
            .Select(p => (Process: p, Version: p.Current))
            .Where(x => x.Version is not null)
            .Select(x => (x.Process, Version: x.Version!, Definition: DefinitionJson.Read(x.Version!.Definition)))
            .FirstOrDefault(x => submission.ProcessId is not null || FieldValues.Matches(x.Definition.StartCondition, fields, values));
        if (match.Process is null)
        {
            return Result.Failure<Guid>(NoProcess);
        }

        var starting = await adapter.StartingAsync(submission.RecordId, cancellationToken).ConfigureAwait(false);
        if (starting.IsFailure)
        {
            return Result.Failure<Guid>(starting.Error);
        }

        var instance = new ApprovalInstance(
            match.Process.Id, match.Version.Id, match.Version.Version, match.Process.NameAr, match.Process.NameEn,
            submission.Screen, submission.RecordId, submission.Title, submission.LegalEntityId,
            JsonSerializer.Serialize(values), Me(), user.DisplayName, clock.UtcNow);
        instance.MoveTo(ProcessCursor.Start().Serialize());
        db.Instances.Add(instance);
        _definitions[instance.VersionId] = match.Definition;
        History(instance, HistoryKind.Submitted, actor: true, statusAfter: instance.Status);

        await RunAsync(instance, adapter, cancellationToken).ConfigureAwait(false);
        try
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("ux_approval_instance_running_record", StringComparison.Ordinal) == true)
        {
            // Two submissions at once: the unique index let only one through.
            _pending.Clear();
            return Result.Failure<Guid>(AlreadyRunning);
        }

        await FlushNotificationsAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(instance.Id);
    }

    /// <summary>
    /// The first submission of a screen that the company has no process for: its default process (if it declares
    /// one) is created and published, so it works at once and can then be changed in "Approval processes".
    /// </summary>
    private async Task EnsureDefaultProcessAsync(ApprovalScreen screen, CancellationToken cancellationToken)
    {
        if (screen.DefaultProcess is not { } template || await db.Processes.AnyAsync(p => p.Screen == screen.Code, cancellationToken).ConfigureAwait(false))
        {
            return;
        }

        var definition = DefinitionJson.Read(template.DefinitionJson);
        if (DefinitionRules.Validate(definition, screen).IsFailure)
        {
            return; // a broken template never blocks the screen: it simply has no process yet
        }

        var process = new ApprovalProcess(screen.Code, template.NameAr, template.NameEn, 100, DefinitionJson.Write(definition));
        process.Publish("النظام / System", clock.UtcNow);
        db.Processes.Add(process);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    // ------------------------------------------------------------------ Decide / delegate / cancel / retry

    public async Task<Result> DecideAsync(Guid workItemId, Decision decision, string? comment, IReadOnlyDictionary<string, string?>? fieldValues, CancellationToken cancellationToken)
    {
        var me = Me();
        var item = await db.WorkItems.FirstOrDefaultAsync(w => w.Id == workItemId && w.AssigneeUserId == me, cancellationToken).ConfigureAwait(false);
        if (item is null)
        {
            return Result.Failure(WorkItemNotFound);
        }

        var instance = await db.Instances.FirstAsync(i => i.Id == item.InstanceId, cancellationToken).ConfigureAwait(false);
        if (!item.IsOpen || instance.Status != InstanceStatus.InProgress || instance.WaitingStepId != item.StepId)
        {
            return Result.Failure(WorkItemClosed);
        }

        comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        if (decision != Decision.Approve && comment is null)
        {
            return Result.Failure(ReasonRequired);
        }

        if (comment?.Length > 1000)
        {
            return Result.Failure(Error.Validation("approval_comment_too_long", "The comment is limited to 1000 characters."));
        }

        var adapter = AdapterFor(instance.Screen)!;
        var definition = await DefinitionAsync(instance.VersionId, cancellationToken).ConfigureAwait(false);
        var step = (ApprovalStep)DefinitionRules.Walk(definition.Steps).First(s => s.Id == item.StepId);
        if (decision == Decision.Return && !step.AllowReturn)
        {
            return Result.Failure(Error.Validation("approval_return_not_allowed", "This stage does not allow returning."));
        }

        // Fields the approver must fill (CRM "mandatory fields" on the task) are saved on the record first.
        if (decision == Decision.Approve && step.RequiredFields.Count > 0)
        {
            var filled = await FillRequiredAsync(instance, adapter, step, fieldValues, cancellationToken).ConfigureAwait(false);
            if (filled.IsFailure)
            {
                return filled;
            }
        }

        var now = clock.UtcNow;
        item.Decide(decision switch
        {
            Decision.Approve => WorkItemStatus.Approved,
            Decision.Reject => WorkItemStatus.Rejected,
            _ => WorkItemStatus.Returned,
        }, comment, now);
        var onBehalf = item.DelegatedFrom is { } from ? await NameOfAsync(from, cancellationToken).ConfigureAwait(false) : null;
        History(
            instance,
            decision switch { Decision.Approve => HistoryKind.Approved, Decision.Reject => HistoryKind.Rejected, _ => HistoryKind.Returned },
            step, actor: true, onBehalfOf: onBehalf, comment: comment);

        // Stage outcome: one rejection or return decides at once; approval needs one (Any) or everyone (All).
        var stageItems = await db.WorkItems.Where(w => w.InstanceId == instance.Id && w.StepId == item.StepId && w.Round == item.Round)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var stillOpen = stageItems.Where(w => w.IsOpen && w.Id != item.Id).ToList();
        if (decision == Decision.Approve && step.Rule == CompletionRule.All && stillOpen.Count > 0)
        {
            return await SaveAsync(cancellationToken).ConfigureAwait(false);
        }

        stillOpen.ForEach(w => w.Close(now));
        instance.StopWaiting();
        var cursor = ProcessCursor.Parse(instance.Cursor);
        var branch = decision switch { Decision.Approve => ProcessCursor.Approve, Decision.Reject => ProcessCursor.Reject, _ => ProcessCursor.Return };
        cursor.Advance(step, branch, definition);
        instance.MoveTo(cursor.Serialize());

        if (decision == Decision.Reject && step.OnReject.Count == 0)
        {
            await CompleteAsync(instance, adapter, InstanceStatus.Rejected, comment, cancellationToken).ConfigureAwait(false);
        }
        else if (decision == Decision.Return && step.OnReturn.Count == 0)
        {
            await CompleteAsync(instance, adapter, InstanceStatus.Returned, comment, cancellationToken).ConfigureAwait(false);
        }
        else
        {
            await RunAsync(instance, adapter, cancellationToken).ConfigureAwait(false);
        }

        return await SaveAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<Result> DelegateAsync(Guid workItemId, Guid toUserId, string? comment, CancellationToken cancellationToken)
    {
        var me = Me();
        var item = await db.WorkItems.FirstOrDefaultAsync(w => w.Id == workItemId && w.AssigneeUserId == me, cancellationToken).ConfigureAwait(false);
        if (item is null)
        {
            return Result.Failure(WorkItemNotFound);
        }

        var instance = await db.Instances.FirstAsync(i => i.Id == item.InstanceId, cancellationToken).ConfigureAwait(false);
        if (!item.IsOpen || instance.Status != InstanceStatus.InProgress)
        {
            return Result.Failure(WorkItemClosed);
        }

        var step = (ApprovalStep)DefinitionRules.Walk((await DefinitionAsync(instance.VersionId, cancellationToken).ConfigureAwait(false)).Steps).First(s => s.Id == item.StepId);
        var members = await MembersAsync(cancellationToken).ConfigureAwait(false);
        if (!step.AllowDelegate || toUserId == me || toUserId == instance.SubmittedBy || !members.TryGetValue(toUserId, out var toName))
        {
            return Result.Failure(Error.Validation("approval_delegate_invalid", "The task cannot be delegated to this person."));
        }

        if (await db.WorkItems.AnyAsync(w => w.InstanceId == instance.Id && w.StepId == item.StepId && w.Round == item.Round && w.AssigneeUserId == toUserId && w.Status == WorkItemStatus.Pending, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(Error.Validation("approval_delegate_invalid", "This person already has the task."));
        }

        var now = clock.UtcNow;
        comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        item.Decide(WorkItemStatus.Delegated, comment, now);
        db.WorkItems.Add(new ApprovalWorkItem(instance.Id, instance.TenantId, item.StepId, item.StepNameAr, item.StepNameEn, item.Round, toUserId, toName, now, item.DueAt, item.AssigneeUserId));
        History(instance, HistoryKind.Delegated, step, actor: true, comment: comment, details: JsonSerializer.Serialize(new { to = toName }));
        QueueNotification([toUserId], instance, "workflow.task_assigned",
            $"بانتظار اعتمادك: {instance.ProcessNameAr}", $"Awaiting your approval: {instance.ProcessNameEn}",
            $"فوّض إليك {user.DisplayName} مهمة «{step.NameAr}» في «{instance.Title}».", $"{user.DisplayName} delegated “{step.NameEn}” on “{instance.Title}” to you.",
            "/workflow/inbox");
        return await SaveAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>The submitter withdraws, or an administrator of processes cancels.</summary>
    public async Task<Result> CancelAsync(Guid instanceId, string? reason, bool canManage, CancellationToken cancellationToken)
    {
        var instance = await db.Instances.FirstOrDefaultAsync(i => i.Id == instanceId, cancellationToken).ConfigureAwait(false);
        if (instance is null)
        {
            return Result.Failure(Error.NotFound("approval_instance", "Approval not found."));
        }

        if (instance.SubmittedBy != Me() && !canManage)
        {
            return Result.Failure(NotAllowed);
        }

        if (instance.Status is not (InstanceStatus.InProgress or InstanceStatus.Failed))
        {
            return Result.Failure(Error.Conflict("approval_finished", "This approval has already ended."));
        }

        reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        if (reason is null)
        {
            return Result.Failure(ReasonRequired);
        }

        var adapter = AdapterFor(instance.Screen)!;
        await CompleteAsync(instance, adapter, InstanceStatus.Canceled, reason, cancellationToken).ConfigureAwait(false);
        return await SaveAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Runs a failed approval again from the step that failed (after the cause was fixed).</summary>
    public async Task<Result> RetryAsync(Guid instanceId, CancellationToken cancellationToken)
    {
        var instance = await db.Instances.FirstOrDefaultAsync(i => i.Id == instanceId, cancellationToken).ConfigureAwait(false);
        if (instance is not { Status: InstanceStatus.Failed })
        {
            return Result.Failure(Error.Conflict("approval_not_failed", "Only a failed approval can be retried."));
        }

        instance.Resume();
        History(instance, HistoryKind.Retried, actor: true, statusBefore: InstanceStatus.Failed, statusAfter: InstanceStatus.InProgress);
        await RunAsync(instance, AdapterFor(instance.Screen)!, cancellationToken).ConfigureAwait(false);
        return await SaveAsync(cancellationToken).ConfigureAwait(false);
    }

    // ------------------------------------------------------------------ Reads

    public async Task<ApprovalStatusInfo?> StatusAsync(string screen, Guid recordId, CancellationToken cancellationToken)
    {
        var instance = await db.Instances.AsNoTracking().Where(i => i.Screen == screen && i.RecordId == recordId)
            .OrderByDescending(i => i.SubmittedAt).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        return instance is null ? null : await StatusOfAsync(instance, cancellationToken).ConfigureAwait(false);
    }

    public async Task<ApprovalStatusInfo> StatusOfAsync(ApprovalInstance instance, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(instance);
        var history = await db.History.AsNoTracking().Where(h => h.InstanceId == instance.Id).OrderBy(h => h.Sequence)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var waiting = instance.Status == InstanceStatus.InProgress
            ? await db.WorkItems.AsNoTracking().Where(w => w.InstanceId == instance.Id && w.Status == WorkItemStatus.Pending)
                .Select(w => w.AssigneeName).ToListAsync(cancellationToken).ConfigureAwait(false)
            : [];
        var items = await db.WorkItems.AsNoTracking().Where(w => w.InstanceId == instance.Id)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return new ApprovalStatusInfo(
            instance.Id, instance.ProcessNameAr, instance.ProcessNameEn, instance.Version, instance.Status.ToString(),
            instance.WaitingStepAr, instance.WaitingStepEn, waiting, instance.SubmittedByName, instance.SubmittedAt,
            Stages(items),
            history.Select(h => new ApprovalTimelineEntry(
                h.Sequence, h.Kind, h.StepNameAr, h.StepNameEn, h.ActorName, h.OnBehalfOf, h.Outcome, h.Comment,
                h.Kind == nameof(HistoryKind.RecordUpdated) && h.Details is not null ? JsonSerializer.Deserialize<Dictionary<string, string?>>(h.Details) : null,
                h.At)).ToList());
    }

    /// <summary>Each opening of a stage (step and round), in order, as the stage bar shows it.</summary>
    private static List<ApprovalStageInfo> Stages(List<ApprovalWorkItem> items) =>
        items.GroupBy(w => (w.StepId, w.Round))
            .OrderBy(g => g.Min(w => w.CreatedAt))
            .Select(g =>
            {
                var decided = g.Where(w => w.Status is WorkItemStatus.Approved or WorkItemStatus.Rejected or WorkItemStatus.Returned)
                    .OrderByDescending(w => w.DecidedAt).ToList();
                var state = g.Any(w => w.Status == WorkItemStatus.Rejected) ? "Rejected"
                    : g.Any(w => w.Status == WorkItemStatus.Returned) ? "Returned"
                    : g.Any(w => w.IsOpen) ? "Current"
                    : decided.Count > 0 ? "Done"
                    : "Canceled";
                var last = decided.FirstOrDefault();
                var onBehalf = last?.DelegatedFrom is { } from ? g.FirstOrDefault(w => w.AssigneeUserId == from)?.AssigneeName : null;
                var first = g.OrderBy(w => w.CreatedAt).First();
                return new ApprovalStageInfo(
                    g.Key.StepId, first.StepNameAr, first.StepNameEn, state,
                    g.Where(w => w.Status != WorkItemStatus.Delegated).Select(w => w.AssigneeName).Distinct().ToList(),
                    last?.AssigneeName, onBehalf, first.CreatedAt,
                    state == "Current" ? null : last?.DecidedAt ?? g.Max(w => w.DecidedAt),
                    last?.Comment);
            })
            .ToList();

    public async Task<bool> IsParticipantAsync(string screen, Guid recordId, CancellationToken cancellationToken)
    {
        var me = Me();
        return await db.Instances.AnyAsync(
                i => i.Screen == screen && i.RecordId == recordId
                     && (i.SubmittedBy == me || db.WorkItems.Any(w => w.InstanceId == i.Id && w.AssigneeUserId == me)),
                cancellationToken).ConfigureAwait(false);
    }

    public async Task<bool> IsParticipantAsync(Guid instanceId, CancellationToken cancellationToken)
    {
        var me = Me();
        return await db.Instances.AnyAsync(
                i => i.Id == instanceId && (i.SubmittedBy == me || db.WorkItems.Any(w => w.InstanceId == i.Id && w.AssigneeUserId == me)),
                cancellationToken).ConfigureAwait(false);
    }

    public async Task<ProcessDefinition> DefinitionAsync(Guid versionId, CancellationToken cancellationToken)
    {
        if (!_definitions.TryGetValue(versionId, out var definition))
        {
            var json = await db.ProcessVersions.Where(v => v.Id == versionId).Select(v => v.Definition).FirstAsync(cancellationToken).ConfigureAwait(false);
            _definitions[versionId] = definition = DefinitionJson.Read(json);
        }

        return definition;
    }

    // ------------------------------------------------------------------ Running steps

    /// <summary>Runs steps from the cursor until a stage waits for people, the process ends, or a step fails.</summary>
    private async Task RunAsync(ApprovalInstance instance, IApprovalRecordAdapter adapter, CancellationToken cancellationToken)
    {
        var definition = await DefinitionAsync(instance.VersionId, cancellationToken).ConfigureAwait(false);
        var fields = adapter.Screen.Fields.ToDictionary(f => f.Key, StringComparer.Ordinal);
        var cursor = ProcessCursor.Parse(instance.Cursor);

        for (var guard = 0; guard < MaxStepsPerRun; guard++)
        {
            var step = cursor.Next(definition);
            instance.MoveTo(cursor.Serialize());
            if (step is null)
            {
                await CompleteAsync(instance, adapter, InstanceStatus.Approved, null, cancellationToken).ConfigureAwait(false);
                return;
            }

            switch (step)
            {
                case ApprovalStep stage:
                    var opened = await OpenStageAsync(instance, stage, adapter, cancellationToken).ConfigureAwait(false);
                    if (!opened)
                    {
                        Fail(instance, stage,
                            $"لا يوجد من يعتمد مرحلة «{stage.NameAr}»: لا أحد يحمل الدور أو الصلاحية المحددة لها (ولا يعتمد أحد طلبه بنفسه). "
                            + "امنح الصلاحية لدور وأسنده لمستخدم من «الأدوار والصلاحيات»، ثم اضغط «إعادة المحاولة». "
                            + $"/ Stage \"{stage.NameEn}\" has no approver: grant its role or permission to someone, then retry.");
                    }

                    return;

                case ConditionStep condition:
                {
                    var values = await ValuesAsync(instance, adapter, cancellationToken).ConfigureAwait(false);
                    if (values is null)
                    {
                        Fail(instance, step, "The record no longer exists.");
                        return;
                    }

                    var index = condition.Branches.ToList().FindIndex(b => FieldValues.Matches(b.Condition, fields, values));
                    var branch = index >= 0 ? $"b{index}" : ProcessCursor.Else;
                    History(instance, HistoryKind.ConditionEvaluated, details: JsonSerializer.Serialize(new { branch }), stepId: step.Id);
                    cursor.Advance(step, branch, definition);
                    break;
                }

                case UpdateStep update:
                {
                    var values = await ValuesAsync(instance, adapter, cancellationToken).ConfigureAwait(false);
                    if (values is null)
                    {
                        Fail(instance, step, "The record no longer exists.");
                        return;
                    }

                    var changes = update.Changes.ToDictionary(
                        c => c.FieldKey,
                        c => c.FromField is { } from ? values.GetValueOrDefault(from) : c.Value,
                        StringComparer.Ordinal);
                    var applied = await adapter.ApplyAsync(instance.RecordId, update.Target, changes, cancellationToken).ConfigureAwait(false);
                    if (applied.IsFailure)
                    {
                        Fail(instance, step, $"The record refused the update: {applied.Error.Message}");
                        return;
                    }

                    // Changes of a related table are recorded as "table.field" so the history says which table changed.
                    var recorded = update.Target is { } table ? changes.ToDictionary(c => $"{table}.{c.Key}", c => c.Value, StringComparer.Ordinal) : changes;
                    History(instance, HistoryKind.RecordUpdated, details: JsonSerializer.Serialize(recorded), stepId: step.Id);
                    cursor.Advance(step, null, definition);
                    break;
                }

                case NotifyStep notify:
                {
                    var values = await ValuesAsync(instance, adapter, cancellationToken).ConfigureAwait(false) ?? new Dictionary<string, string?>();
                    var recipients = await RecipientsAsync(instance, notify.To, values, cancellationToken).ConfigureAwait(false);
                    var texts = new Dictionary<string, string?>(values, StringComparer.Ordinal) { ["title"] = instance.Title, ["submitter"] = instance.SubmittedByName };
                    QueueNotification(recipients, instance, "workflow.process_message",
                        FieldValues.Fill(notify.TitleAr, texts), FieldValues.Fill(notify.TitleEn, texts),
                        FieldValues.Fill(notify.BodyAr, texts), FieldValues.Fill(notify.BodyEn, texts),
                        adapter.Screen.LinkTo(instance.RecordId));
                    History(instance, HistoryKind.Notified, details: JsonSerializer.Serialize(new { recipients = recipients.Count }), stepId: step.Id);
                    cursor.Advance(step, null, definition);
                    break;
                }

                case StopStep stop:
                    await CompleteAsync(instance, adapter, stop.Outcome switch
                    {
                        StopOutcome.Approved => InstanceStatus.Approved,
                        StopOutcome.Rejected => InstanceStatus.Rejected,
                        _ => InstanceStatus.Canceled,
                    }, null, cancellationToken).ConfigureAwait(false);
                    return;
            }

            instance.MoveTo(cursor.Serialize());
        }

        Fail(instance, null, "The process ran too many steps at once.");
    }

    private async Task<bool> OpenStageAsync(ApprovalInstance instance, ApprovalStep stage, IApprovalRecordAdapter adapter, CancellationToken cancellationToken)
    {
        var members = await MembersAsync(cancellationToken).ConfigureAwait(false);
        var values = await ValuesAsync(instance, adapter, cancellationToken).ConfigureAwait(false) ?? new Dictionary<string, string?>();
        var people = new HashSet<Guid>();
        foreach (var assignee in stage.Assignees)
        {
            switch (assignee.Kind)
            {
                case AssigneeKind.User when assignee.UserId is { } id:
                    people.Add(id);
                    break;
                case AssigneeKind.Role when assignee.RoleId is { } roleId:
                    people.UnionWith(await access.MembersInRoleAsync(roleId, instance.LegalEntityId, cancellationToken).ConfigureAwait(false));
                    break;
                case AssigneeKind.UserField when assignee.FieldKey is { } key && Guid.TryParse(values.GetValueOrDefault(key), out var fromRecord):
                    people.Add(fromRecord);
                    break;
                case AssigneeKind.Submitter:
                    people.Add(instance.SubmittedBy);
                    break;
                case AssigneeKind.Permission when assignee.Permission is { } permission:
                    people.UnionWith(await access.MembersWithPermissionAsync(permission, instance.LegalEntityId, cancellationToken).ConfigureAwait(false));
                    break;
            }
        }

        // Nobody approves their own request (unless the stage is the submitter's own confirmation); only active
        // members of this company can approve.
        var submitterStage = stage.Assignees.Any(a => a.Kind == AssigneeKind.Submitter);
        people.RemoveWhere(id => (id == instance.SubmittedBy && !submitterStage) || !members.ContainsKey(id));
        var escalated = false;
        if (people.Count == 0)
        {
            escalated = true;
            foreach (var admin in (await access.ListRolesAsync(cancellationToken).ConfigureAwait(false)).Where(r => r.IsAdministrator && r.IsActive))
            {
                people.UnionWith((await access.MembersInRoleAsync(admin.Id, null, cancellationToken).ConfigureAwait(false))
                    .Where(id => id != instance.SubmittedBy && members.ContainsKey(id)));
            }
        }

        if (people.Count == 0)
        {
            return false;
        }

        var now = clock.UtcNow;
        // A stage can open more than once in one approval (in different branches): each opening is a new round.
        var saved = await db.WorkItems.Where(w => w.InstanceId == instance.Id && w.StepId == stage.Id).Select(w => (int?)w.Round).MaxAsync(cancellationToken).ConfigureAwait(false) ?? 0;
        var local = db.WorkItems.Local.Where(w => w.InstanceId == instance.Id && w.StepId == stage.Id).Select(w => w.Round).DefaultIfEmpty(0).Max();
        var round = Math.Max(saved, local) + 1;
        var due = stage.DueHours is { } hours ? now.AddHours(hours) : (DateTimeOffset?)null;
        foreach (var id in people)
        {
            db.WorkItems.Add(new ApprovalWorkItem(instance.Id, instance.TenantId, stage.Id, stage.NameAr, stage.NameEn, round, id, members[id], now, due));
        }

        instance.Wait(stage.Id, stage.NameAr, stage.NameEn);
        History(instance, HistoryKind.StageOpened, stage, details: JsonSerializer.Serialize(new { assignees = people.Select(id => members[id]).ToList(), escalated, rule = stage.Rule.ToString() }));
        QueueNotification(people, instance, "workflow.task_assigned",
            $"بانتظار اعتمادك: {instance.ProcessNameAr}", $"Awaiting your approval: {instance.ProcessNameEn}",
            $"«{instance.Title}» من {instance.SubmittedByName} — مرحلة «{stage.NameAr}».", $"“{instance.Title}” from {instance.SubmittedByName} — stage “{stage.NameEn}”.",
            "/workflow/inbox");
        return true;
    }

    private async Task<Result> FillRequiredAsync(ApprovalInstance instance, IApprovalRecordAdapter adapter, ApprovalStep step, IReadOnlyDictionary<string, string?>? given, CancellationToken cancellationToken)
    {
        var fields = adapter.Screen.Fields.ToDictionary(f => f.Key, StringComparer.Ordinal);
        var current = await adapter.ReadAsync(instance.RecordId, cancellationToken).ConfigureAwait(false) ?? new Dictionary<string, string?>();
        var changes = new Dictionary<string, string?>(StringComparer.Ordinal);
        foreach (var key in step.RequiredFields)
        {
            var value = given?.GetValueOrDefault(key);
            if (string.IsNullOrWhiteSpace(value))
            {
                if (string.IsNullOrWhiteSpace(current.GetValueOrDefault(key)))
                {
                    return Result.Failure(Error.Validation("approval_field_required", $"\"{fields[key].NameEn}\" must be filled before approving."));
                }

                continue;
            }

            if (!FieldValues.IsValid(fields[key], value.Trim()))
            {
                return Result.Failure(Error.Validation("approval_field_invalid", $"The value of \"{fields[key].NameEn}\" is not valid."));
            }

            changes[key] = value.Trim();
        }

        if (changes.Count == 0)
        {
            return Result.Success();
        }

        var applied = await adapter.ApplyAsync(instance.RecordId, null, changes, cancellationToken).ConfigureAwait(false);
        if (applied.IsFailure)
        {
            return applied;
        }

        History(instance, HistoryKind.RecordUpdated, step, actor: true, details: JsonSerializer.Serialize(changes));
        return Result.Success();
    }

    private async Task CompleteAsync(ApprovalInstance instance, IApprovalRecordAdapter adapter, InstanceStatus status, string? comment, CancellationToken cancellationToken)
    {
        var before = instance.Status;
        var now = clock.UtcNow;
        foreach (var open in await db.WorkItems.Where(w => w.InstanceId == instance.Id && w.Status == WorkItemStatus.Pending).ToListAsync(cancellationToken).ConfigureAwait(false))
        {
            open.Close(now);
        }

        instance.Complete(status, now);
        History(
            instance, status == InstanceStatus.Canceled ? HistoryKind.Canceled : HistoryKind.Completed,
            actor: status == InstanceStatus.Canceled, outcome: status.ToString(), comment: comment, statusBefore: before, statusAfter: status);

        // The owning module applies the business effect to its own record.
        await adapter.EndedAsync(instance.RecordId, status switch
        {
            InstanceStatus.Approved => ApprovalEnd.Approved,
            InstanceStatus.Rejected => ApprovalEnd.Rejected,
            InstanceStatus.Returned => ApprovalEnd.Returned,
            _ => ApprovalEnd.Canceled,
        }, comment, cancellationToken).ConfigureAwait(false);

        var (ar, en) = status switch
        {
            InstanceStatus.Approved => ("تم الاعتماد", "Approved"),
            InstanceStatus.Rejected => ("تم الرفض", "Rejected"),
            InstanceStatus.Returned => ("أُعيد للتعديل", "Returned for changes"),
            _ => ("أُلغي", "Canceled"),
        };
        QueueNotification([instance.SubmittedBy], instance, "workflow.completed",
            $"{ar}: {instance.Title}", $"{en}: {instance.Title}",
            comment is null ? $"{instance.ProcessNameAr} — {ar}." : $"{instance.ProcessNameAr} — {ar}. السبب: {comment}",
            comment is null ? $"{instance.ProcessNameEn} — {en}." : $"{instance.ProcessNameEn} — {en}. Reason: {comment}",
            adapter.Screen.LinkTo(instance.RecordId));
    }

    private void Fail(ApprovalInstance instance, Step? step, string error)
    {
        var before = instance.Status;
        instance.Fail(error);
        History(instance, HistoryKind.Failed, stepId: step?.Id, comment: error, statusBefore: before, statusAfter: InstanceStatus.Failed);
        LogStepFailed(logger, instance.Id, error);
    }

    private static async Task<IReadOnlyDictionary<string, string?>?> ValuesAsync(ApprovalInstance instance, IApprovalRecordAdapter adapter, CancellationToken cancellationToken) =>
        await adapter.ReadAsync(instance.RecordId, cancellationToken).ConfigureAwait(false);

    private async Task<List<Guid>> RecipientsAsync(ApprovalInstance instance, IReadOnlyList<Recipient> to, IReadOnlyDictionary<string, string?> values, CancellationToken cancellationToken)
    {
        var people = new HashSet<Guid>();
        foreach (var recipient in to)
        {
            switch (recipient.Kind)
            {
                case RecipientKind.Submitter:
                    people.Add(instance.SubmittedBy);
                    break;
                case RecipientKind.User when recipient.UserId is { } id:
                    people.Add(id);
                    break;
                case RecipientKind.Role when recipient.RoleId is { } roleId:
                    people.UnionWith(await access.MembersInRoleAsync(roleId, instance.LegalEntityId, cancellationToken).ConfigureAwait(false));
                    break;
                case RecipientKind.UserField when recipient.FieldKey is { } key && Guid.TryParse(values.GetValueOrDefault(key), out var fromRecord):
                    people.Add(fromRecord);
                    break;
            }
        }

        return [.. people];
    }

    // ------------------------------------------------------------------ History, notifications, helpers

    private void History(
        ApprovalInstance instance,
        HistoryKind kind,
        ApprovalStep? step = null,
        bool actor = false,
        string? onBehalfOf = null,
        string? outcome = null,
        string? comment = null,
        string? details = null,
        string? stepId = null,
        InstanceStatus? statusBefore = null,
        InstanceStatus? statusAfter = null) =>
        db.History.Add(new ApprovalHistoryEntry(
            instance.Id, instance.TenantId, instance.NextSequence(), kind, clock.UtcNow,
            step?.Id ?? stepId, step?.NameAr, step?.NameEn,
            actor ? Me() : null, actor ? user.DisplayName : null, onBehalfOf, outcome, comment, details,
            statusBefore?.ToString(), statusAfter?.ToString()));

    private readonly List<NotificationRequest> _pending = [];

    private void QueueNotification(IEnumerable<Guid> recipients, ApprovalInstance instance, string kind, string titleAr, string titleEn, string bodyAr, string bodyEn, string link)
    {
        var to = recipients.Distinct().ToList();
        if (to.Count > 0)
        {
            _pending.Add(new NotificationRequest(to, kind, titleAr, titleEn, bodyAr, bodyEn, link));
        }
    }

    /// <summary>Notifications go out only after the approval change is saved (best effort: never undoes it).</summary>
    private async Task FlushNotificationsAsync(CancellationToken cancellationToken)
    {
        foreach (var request in _pending)
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

        _pending.Clear();
    }

    private async Task<Result> SaveAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (DbUpdateConcurrencyException)
        {
            _pending.Clear();
            return Result.Failure(ChangedMeanwhile);
        }

        await FlushNotificationsAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    private async Task<Dictionary<Guid, string>> MembersAsync(CancellationToken cancellationToken) =>
        _members ??= (await access.ListMembersAsync(cancellationToken).ConfigureAwait(false)).ToDictionary(m => m.UserAccountId, m => m.DisplayName);

    private async Task<string?> NameOfAsync(Guid userId, CancellationToken cancellationToken) =>
        (await MembersAsync(cancellationToken).ConfigureAwait(false)).GetValueOrDefault(userId);

    public Guid Me() =>
        tenant.TenantId is not null && Guid.TryParse(user.UserId, out var id) ? id : throw new InvalidOperationException("A signed-in company user is required.");

    [LoggerMessage(Level = LogLevel.Warning, Message = "Approval {InstanceId} stopped: {Error}")]
    private static partial void LogStepFailed(ILogger logger, Guid instanceId, string error);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Notification {Kind} could not be sent")]
    private static partial void LogNotifyFailed(ILogger logger, string kind, Exception exception);
}

/// <summary>Definitions are stored as JSON with camelCase names and string enums.</summary>
internal static class DefinitionJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() },
    };

    public static ProcessDefinition Read(string json) =>
        string.IsNullOrWhiteSpace(json) ? ProcessDefinition.Empty : JsonSerializer.Deserialize<ProcessDefinition>(json, Options) ?? ProcessDefinition.Empty;

    public static string Write(ProcessDefinition definition) => JsonSerializer.Serialize(definition, Options);
}
