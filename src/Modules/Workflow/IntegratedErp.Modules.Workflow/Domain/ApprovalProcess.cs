using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workflow.Domain;

/// <summary>
/// An approval process of one company for one screen (like a CRM workflow). It has one editable draft and published
/// versions that never change; activating publishes the draft as the next version. Several active processes may
/// target one screen: the first by <see cref="Priority"/> whose start condition matches the record is used.
/// </summary>
public sealed class ApprovalProcess : ITenantOwned
{
    private readonly List<ApprovalProcessVersion> _versions = [];

    private ApprovalProcess()
    {
        Screen = string.Empty;
        NameAr = string.Empty;
        NameEn = string.Empty;
        Draft = string.Empty;
    }

    public ApprovalProcess(string screen, string nameAr, string nameEn, int priority, string draft)
    {
        Id = Guid.CreateVersion7();
        Screen = screen;
        NameAr = nameAr;
        NameEn = nameEn;
        Priority = priority;
        Draft = draft;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>Screen code (declared by the module that owns it).</summary>
    public string Screen { get; private set; }

    public string NameAr { get; private set; }

    public string NameEn { get; private set; }

    /// <summary>Lower runs first when several processes target the same screen.</summary>
    public int Priority { get; private set; }

    /// <summary>The definition being edited (JSON), never used by running approvals.</summary>
    public string Draft { get; private set; }

    public bool DraftChanged { get; private set; }

    public bool IsActive { get; private set; }

    public int CurrentVersion { get; private set; }

    public IReadOnlyCollection<ApprovalProcessVersion> Versions => _versions;

    public ApprovalProcessVersion? Current => _versions.FirstOrDefault(v => v.Version == CurrentVersion);

    public Result Rename(string nameAr, string nameEn, int priority)
    {
        nameAr = (nameAr ?? string.Empty).Trim();
        nameEn = (nameEn ?? string.Empty).Trim();
        if (nameAr.Length is 0 or > 200 || nameEn.Length is 0 or > 200)
        {
            return Result.Failure(Error.Validation("process_name_required", "Arabic and English names are required."));
        }

        if (priority is < 0 or > 1000)
        {
            return Result.Failure(Error.Validation("process_priority_invalid", "Priority must be 0 to 1000."));
        }

        NameAr = nameAr;
        NameEn = nameEn;
        Priority = priority;
        return Result.Success();
    }

    public void SaveDraft(string definition)
    {
        Draft = definition;
        DraftChanged = true;
    }

    /// <summary>Publishes the (already validated) draft as the next version and activates the process.</summary>
    public ApprovalProcessVersion Publish(string publishedBy, DateTimeOffset at)
    {
        var version = new ApprovalProcessVersion(Id, TenantId, CurrentVersion + 1, Draft, publishedBy, at);
        _versions.Add(version);
        CurrentVersion = version.Version;
        DraftChanged = false;
        IsActive = true;
        return version;
    }

    public Result SetActive(bool active)
    {
        if (active && CurrentVersion == 0)
        {
            return Result.Failure(Error.Validation("process_not_published", "Publish the process before activating it."));
        }

        IsActive = active;
        return Result.Success();
    }
}

/// <summary>A published definition: never edited. Running approvals stay on the version they started with.</summary>
public sealed class ApprovalProcessVersion : ITenantOwned
{
    private ApprovalProcessVersion()
    {
        Definition = string.Empty;
        PublishedBy = string.Empty;
    }

    internal ApprovalProcessVersion(Guid processId, Guid tenantId, int version, string definition, string publishedBy, DateTimeOffset publishedAt)
    {
        Id = Guid.CreateVersion7();
        ProcessId = processId;
        TenantId = tenantId;
        Version = version;
        Definition = definition;
        PublishedBy = publishedBy;
        PublishedAt = publishedAt;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid ProcessId { get; private set; }

    public int Version { get; private set; }

    public string Definition { get; private set; }

    public string PublishedBy { get; private set; }

    public DateTimeOffset PublishedAt { get; private set; }
}

public enum InstanceStatus
{
    /// <summary>Waiting for a stage's decision.</summary>
    InProgress,
    Approved,
    Rejected,
    Returned,
    Canceled,

    /// <summary>A step could not run (e.g. the record refused an update); an administrator can retry it.</summary>
    Failed,
}

/// <summary>
/// One run of a record through a process version. <see cref="Cursor"/> records where it stands in the step tree, so
/// it survives restarts. Every change goes with an append-only history entry.
/// </summary>
public sealed class ApprovalInstance : ITenantOwned
{
    private ApprovalInstance()
    {
        Screen = string.Empty;
        Title = string.Empty;
        SubmittedByName = string.Empty;
        Cursor = string.Empty;
        Snapshot = string.Empty;
        ProcessNameAr = string.Empty;
        ProcessNameEn = string.Empty;
        RowVersion = [];
    }

    public ApprovalInstance(
        Guid processId,
        Guid versionId,
        int version,
        string processNameAr,
        string processNameEn,
        string screen,
        Guid recordId,
        string title,
        Guid? legalEntityId,
        string snapshot,
        Guid submittedBy,
        string submittedByName,
        DateTimeOffset at)
    {
        Id = Guid.CreateVersion7();
        ProcessId = processId;
        VersionId = versionId;
        Version = version;
        ProcessNameAr = processNameAr;
        ProcessNameEn = processNameEn;
        Screen = screen;
        RecordId = recordId;
        Title = title.Length > 300 ? title[..300] : title;
        LegalEntityId = legalEntityId;
        Snapshot = snapshot;
        SubmittedBy = submittedBy;
        SubmittedByName = submittedByName;
        SubmittedAt = at;
        Status = InstanceStatus.InProgress;
        Cursor = "[]";
        RowVersion = [];
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid ProcessId { get; private set; }

    public Guid VersionId { get; private set; }

    public int Version { get; private set; }

    public string ProcessNameAr { get; private set; }

    public string ProcessNameEn { get; private set; }

    public string Screen { get; private set; }

    public Guid RecordId { get; private set; }

    public string Title { get; private set; }

    public Guid? LegalEntityId { get; private set; }

    /// <summary>The routing fields' values at submission (JSON), for the record of what was approved.</summary>
    public string Snapshot { get; private set; }

    public Guid SubmittedBy { get; private set; }

    public string SubmittedByName { get; private set; }

    public DateTimeOffset SubmittedAt { get; private set; }

    public InstanceStatus Status { get; private set; }

    /// <summary>Stack of positions in the step tree (JSON).</summary>
    public string Cursor { get; private set; }

    /// <summary>The approval stage waiting for decisions, if any.</summary>
    public string? WaitingStepId { get; private set; }

    public string? WaitingStepAr { get; private set; }

    public string? WaitingStepEn { get; private set; }

    public string? Error { get; private set; }

    /// <summary>
    /// The value the company added to the screen's status that the record shows while in approval (set by a process's
    /// update step; docs/02-target-architecture/19). Cleared when a fixed status is set or the approval ends.
    /// </summary>
    public string? StatusValue { get; private set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    /// <summary>Two people acting at once: the second save fails and is told to refresh.</summary>
    public byte[] RowVersion { get; private set; }

    public int HistoryCount { get; private set; }

    public void MoveTo(string cursor) => Cursor = cursor;

    public void Wait(string stepId, string nameAr, string nameEn)
    {
        WaitingStepId = stepId;
        WaitingStepAr = nameAr;
        WaitingStepEn = nameEn;
    }

    public void StopWaiting()
    {
        WaitingStepId = null;
        WaitingStepAr = null;
        WaitingStepEn = null;
    }

    public void SetStatusValue(string? code) => StatusValue = code;

    public void Complete(InstanceStatus status, DateTimeOffset at)
    {
        StopWaiting();
        StatusValue = null;
        Status = status;
        CompletedAt = at;
        Error = null;
    }

    public void Fail(string error)
    {
        Status = InstanceStatus.Failed;
        Error = error.Length > 1000 ? error[..1000] : error;
    }

    public void Resume()
    {
        Status = InstanceStatus.InProgress;
        Error = null;
    }

    /// <summary>The next history sequence number (1, 2, 3… per approval, without gaps).</summary>
    public int NextSequence() => ++HistoryCount;
}

public enum WorkItemStatus
{
    Pending,
    Approved,
    Rejected,
    Returned,

    /// <summary>The stage was decided by others (or the approval ended) before this person acted.</summary>
    Closed,

    /// <summary>Handed to another user (who received a new work item).</summary>
    Delegated,

    /// <summary>Moved to another user by an administrator of the tasks (who received a new work item).</summary>
    Reassigned,
}

/// <summary>An approval task of one person (like a CRM approval task owned by a user).</summary>
public sealed class ApprovalWorkItem : ITenantOwned
{
    private ApprovalWorkItem()
    {
        StepId = string.Empty;
        StepNameAr = string.Empty;
        StepNameEn = string.Empty;
        AssigneeName = string.Empty;
    }

    public ApprovalWorkItem(Guid instanceId, Guid tenantId, string stepId, string stepNameAr, string stepNameEn, int round, Guid assignee, string assigneeName, DateTimeOffset createdAt, DateTimeOffset? dueAt, Guid? delegatedFrom = null)
    {
        Id = Guid.CreateVersion7();
        InstanceId = instanceId;
        TenantId = tenantId;
        StepId = stepId;
        StepNameAr = stepNameAr;
        StepNameEn = stepNameEn;
        Round = round;
        AssigneeUserId = assignee;
        AssigneeName = assigneeName;
        CreatedAt = createdAt;
        DueAt = dueAt;
        DelegatedFrom = delegatedFrom;
        Status = WorkItemStatus.Pending;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid InstanceId { get; private set; }

    public string StepId { get; private set; }

    public string StepNameAr { get; private set; }

    public string StepNameEn { get; private set; }

    /// <summary>Which time this stage opened in the approval (a stage can open again in another branch).</summary>
    public int Round { get; private set; }

    public Guid AssigneeUserId { get; private set; }

    public string AssigneeName { get; private set; }

    /// <summary>The user who handed this task over, when delegated.</summary>
    public Guid? DelegatedFrom { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? DueAt { get; private set; }

    public WorkItemStatus Status { get; private set; }

    public DateTimeOffset? DecidedAt { get; private set; }

    public string? Comment { get; private set; }

    /// <summary>
    /// The Idempotency-Key the decision came with: the same key sent again for this task returns the first result
    /// instead of deciding twice (a double click, a retried request).
    /// </summary>
    public string? DecisionKey { get; private set; }

    public bool IsOpen => Status == WorkItemStatus.Pending;

    public void Decide(WorkItemStatus status, string? comment, DateTimeOffset at, string? decisionKey = null)
    {
        Status = status;
        Comment = comment;
        DecidedAt = at;
        DecisionKey = decisionKey;
    }

    public void Close(DateTimeOffset at)
    {
        if (IsOpen)
        {
            Status = WorkItemStatus.Closed;
            DecidedAt = at;
        }
    }
}

public enum HistoryKind
{
    Submitted,
    StageOpened,
    Approved,
    Rejected,
    Returned,
    Delegated,
    ConditionEvaluated,
    RecordUpdated,

    /// <summary>An «action» step ran the module's action on the record.</summary>
    ActionRun,
    Notified,
    Completed,
    Canceled,
    Failed,
    Retried,

    /// <summary>An administrator of the tasks moved a task from its holder to someone else, with the reason.</summary>
    Reassigned,
}

/// <summary>One entry of an approval's history: written once, never changed or deleted.</summary>
public sealed class ApprovalHistoryEntry : ITenantOwned
{
    private ApprovalHistoryEntry()
    {
        Kind = string.Empty;
    }

    public ApprovalHistoryEntry(
        Guid instanceId,
        Guid tenantId,
        int sequence,
        HistoryKind kind,
        DateTimeOffset at,
        string? stepId = null,
        string? stepNameAr = null,
        string? stepNameEn = null,
        Guid? actorUserId = null,
        string? actorName = null,
        string? onBehalfOf = null,
        string? outcome = null,
        string? comment = null,
        string? details = null,
        string? statusBefore = null,
        string? statusAfter = null)
    {
        Id = Guid.CreateVersion7();
        InstanceId = instanceId;
        TenantId = tenantId;
        Sequence = sequence;
        Kind = kind.ToString();
        At = at;
        StepId = stepId;
        StepNameAr = stepNameAr;
        StepNameEn = stepNameEn;
        ActorUserId = actorUserId;
        ActorName = actorName;
        OnBehalfOf = onBehalfOf;
        Outcome = outcome;
        Comment = comment;
        Details = details;
        StatusBefore = statusBefore;
        StatusAfter = statusAfter;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid InstanceId { get; private set; }

    /// <summary>1, 2, 3… within the approval; unique with the instance.</summary>
    public int Sequence { get; private set; }

    public string Kind { get; private set; }

    public DateTimeOffset At { get; private set; }

    public string? StepId { get; private set; }

    public string? StepNameAr { get; private set; }

    public string? StepNameEn { get; private set; }

    public Guid? ActorUserId { get; private set; }

    public string? ActorName { get; private set; }

    /// <summary>The original assignee when the actor acted on a delegated task.</summary>
    public string? OnBehalfOf { get; private set; }

    public string? Outcome { get; private set; }

    public string? Comment { get; private set; }

    /// <summary>JSON: field changes, condition branch, recipients…</summary>
    public string? Details { get; private set; }

    public string? StatusBefore { get; private set; }

    public string? StatusAfter { get; private set; }
}
