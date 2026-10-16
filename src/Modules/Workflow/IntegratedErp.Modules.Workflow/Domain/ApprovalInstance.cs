using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workflow.Domain;

public enum InstanceStatus
{
    InProgress = 0,
    Approved = 1,
    Rejected = 2,
    Returned = 3,
}

public enum ApprovalTaskStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Returned = 3,

    /// <summary>Another approver of the same stage decided first.</summary>
    Closed = 4,
}

public enum Decision
{
    Approve,
    Reject,
    Return,
}

/// <summary>
/// One run of a document through its route (pinned to a route version). A stage is decided by the first of its
/// approvers; approve moves to the next stage (or ends Approved), reject ends Rejected, return ends Returned so the
/// owner can edit and submit again (a new instance). The submitter never approves their own document.
/// </summary>
public sealed class ApprovalInstance : ITenantOwned
{
    private readonly List<ApprovalTask> _tasks = [];

    private ApprovalInstance()
    {
        DocumentType = string.Empty;
        Title = string.Empty;
        SubmittedByName = string.Empty;
        DynamicApprovers = string.Empty;
        RowVersion = [];
    }

    public ApprovalInstance(
        string documentType,
        Guid documentId,
        string title,
        Guid routeVersionId,
        int stageCount,
        Guid? legalEntityId,
        string dynamicApprovers,
        Guid submittedBy,
        string submittedByName,
        DateTimeOffset submittedAt)
    {
        Id = Guid.CreateVersion7();
        DocumentType = documentType;
        DocumentId = documentId;
        Title = title.Length > 300 ? title[..300] : title;
        RouteVersionId = routeVersionId;
        StageCount = stageCount;
        LegalEntityId = legalEntityId;
        DynamicApprovers = dynamicApprovers;
        SubmittedBy = submittedBy;
        SubmittedByName = submittedByName;
        SubmittedAt = submittedAt;
        Status = InstanceStatus.InProgress;
        CurrentStage = 1;
        RowVersion = [];
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string DocumentType { get; private set; }

    public Guid DocumentId { get; private set; }

    public string Title { get; private set; }

    public Guid RouteVersionId { get; private set; }

    public int StageCount { get; private set; }

    public Guid? LegalEntityId { get; private set; }

    /// <summary>JSON map of dynamic approver key → user id, as supplied at submission.</summary>
    public string DynamicApprovers { get; private set; }

    public Guid SubmittedBy { get; private set; }

    public string SubmittedByName { get; private set; }

    public DateTimeOffset SubmittedAt { get; private set; }

    public InstanceStatus Status { get; private set; }

    public int CurrentStage { get; private set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    /// <summary>Optimistic concurrency: two approvers deciding at once cannot both move the instance.</summary>
    public byte[] RowVersion { get; private set; }

    public IReadOnlyCollection<ApprovalTask> Tasks => _tasks;

    /// <summary>Opens a stage for its approvers (never the submitter).</summary>
    public void OpenStage(int order, string nameAr, string nameEn, IReadOnlyCollection<(Guid UserId, string Name)> approvers, bool escalated)
    {
        foreach (var (userId, name) in approvers.Where(a => a.UserId != SubmittedBy))
        {
            _tasks.Add(new ApprovalTask(Id, TenantId, order, nameAr, nameEn, userId, name, escalated));
        }
    }

    /// <summary>
    /// Records a decision on a pending task of the current stage. Returns whether a next stage must be opened.
    /// </summary>
    public Result<bool> Decide(Guid taskId, Guid userId, Decision decision, string? comment, DateTimeOffset at)
    {
        var task = _tasks.FirstOrDefault(t => t.Id == taskId);
        if (task is null || task.AssigneeUserId != userId)
        {
            return Result.Failure<bool>(Error.NotFound("approval_task", "Task not found."));
        }

        if (Status != InstanceStatus.InProgress || task.Status != ApprovalTaskStatus.Pending || task.StageOrder != CurrentStage)
        {
            return Result.Failure<bool>(Error.Conflict("approval_task_closed", "This task is no longer open."));
        }

        comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        if (decision != Decision.Approve && comment is null)
        {
            return Result.Failure<bool>(Error.Validation("approval_comment_required", "A reason is required to reject or return."));
        }

        if (comment?.Length > 1000)
        {
            return Result.Failure<bool>(Error.Validation("approval_comment_too_long", "The comment is limited to 1000 characters."));
        }

        task.Decide(decision, comment, at);
        foreach (var other in _tasks.Where(t => t.StageOrder == CurrentStage && t.Status == ApprovalTaskStatus.Pending))
        {
            other.Close(at);
        }

        switch (decision)
        {
            case Decision.Approve when CurrentStage < StageCount:
                CurrentStage++;
                return Result.Success(true);
            case Decision.Approve:
                Complete(InstanceStatus.Approved, at);
                break;
            case Decision.Reject:
                Complete(InstanceStatus.Rejected, at);
                break;
            default:
                Complete(InstanceStatus.Returned, at);
                break;
        }

        return Result.Success(false);
    }

    private void Complete(InstanceStatus status, DateTimeOffset at)
    {
        Status = status;
        CompletedAt = at;
    }
}

public sealed class ApprovalTask : ITenantOwned
{
    private ApprovalTask()
    {
        StageNameAr = string.Empty;
        StageNameEn = string.Empty;
        AssigneeName = string.Empty;
    }

    internal ApprovalTask(Guid instanceId, Guid tenantId, int stageOrder, string stageNameAr, string stageNameEn, Guid assigneeUserId, string assigneeName, bool escalated)
    {
        Id = Guid.CreateVersion7();
        InstanceId = instanceId;
        TenantId = tenantId;
        StageOrder = stageOrder;
        StageNameAr = stageNameAr;
        StageNameEn = stageNameEn;
        AssigneeUserId = assigneeUserId;
        AssigneeName = assigneeName;
        IsEscalated = escalated;
        Status = ApprovalTaskStatus.Pending;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid InstanceId { get; private set; }

    public int StageOrder { get; private set; }

    public string StageNameAr { get; private set; }

    public string StageNameEn { get; private set; }

    public Guid AssigneeUserId { get; private set; }

    public string AssigneeName { get; private set; }

    /// <summary>The stage had no approver when it opened, so it went to the company administrators.</summary>
    public bool IsEscalated { get; private set; }

    public ApprovalTaskStatus Status { get; private set; }

    public DateTimeOffset? DecidedAt { get; private set; }

    public string? Comment { get; private set; }

    internal void Decide(Decision decision, string? comment, DateTimeOffset at)
    {
        Status = decision switch
        {
            Decision.Approve => ApprovalTaskStatus.Approved,
            Decision.Reject => ApprovalTaskStatus.Rejected,
            _ => ApprovalTaskStatus.Returned,
        };
        Comment = comment;
        DecidedAt = at;
    }

    internal void Close(DateTimeOffset at)
    {
        Status = ApprovalTaskStatus.Closed;
        DecidedAt = at;
    }
}
