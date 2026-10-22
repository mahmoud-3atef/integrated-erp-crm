using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Operations.Domain;

/// <summary>
/// Where a return order stands. The default process: saved ⇒ under preparation (the creator confirms it) ⇒ sent to
/// sales (who record the customer's wish) ⇒ sent to the operations manager ⇒ completed (the worker is in housing).
/// </summary>
public enum ReturnStatus
{
    UnderPreparation,
    SentToSales,
    SentToOperationsManager,

    /// <summary>In another approval stage (a process of the company's own, or old orders sent to others).</summary>
    InApproval,
    Returned,
    Rejected,

    /// <summary>Approved: the worker is back in housing (old system: approved, 100000009).</summary>
    Completed,
    Canceled,

    /// <summary>Cancelled after its approval: the housing period it opened was taken back (with the reason).</summary>
    CanceledAfterApproval,
}

/// <summary>Why the worker came back (the old system's back reasons).</summary>
public static class ReturnReasons
{
    public const string ClientNoReason = "ClientNoReason";
    public const string WorkerRefuses = "WorkerRefuses";
    public const string Sick = "Sick";
    public const string WorkerAbused = "WorkerAbused";
    public const string ContractCanceled = "ContractCanceled";
    public const string Other = "Other";

    public static readonly string[] All = [ClientNoReason, WorkerRefuses, Sick, WorkerAbused, ContractCanceled, Other];

    /// <summary>The old system's code (new_backreason) and the reason here.</summary>
    public static string FromCrm(int? code) => code switch
    {
        279640000 => ClientNoReason,
        1 => WorkerRefuses,
        6 => Sick,
        100000002 => WorkerAbused,
        279640002 => ContractCanceled,
        _ => Other,
    };
}

/// <summary>What the customer wants after the return (recorded by sales).</summary>
public static class CustomerWishes
{
    public const string Replace = "Replace";
    public const string Cancel = "Cancel";
    public const string Nothing = "Nothing";

    public static readonly string[] All = [Replace, Cancel, Nothing];
}

/// <summary>How the worker entered housing (old system: new_entertype); orders written here are always returns.</summary>
public enum HousingEntry
{
    ReturnedWorker,
    NewArrival,
    BackFromVacation,
}

public sealed record ReturnWorker(
    Guid? WorkerId,
    Guid? WorkerCrmId,
    string WorkerNo,
    string Name,
    string? ProfessionCode,
    string? NationalityCode,
    string? IqamaNo,
    Guid? ProjectId,
    Guid? ProjectCrmId,
    string? ProjectName,
    DateOnly? WorkStartedOn);

public sealed record ReturnDetails(DateOnly ArrivedOn, string Reason, string? ReasonNotes, bool StopSalary, string? HousingName, string? DelayReason, string? Notes, Guid? RoomId = null);

/// <summary>
/// A return order (docs/02-target-architecture/05 §2.3): a worker back from a project to the company's housing. Saved
/// under preparation, sent through the company's approval process; when approved the worker's work period closes on the
/// arrival day and a housing period opens (with or without salary). Orders copied from the old system are read-only.
/// </summary>
public sealed class ReturnOrder : ITenantOwned
{
    private ReturnOrder()
    {
        OrderNo = string.Empty;
        WorkerNo = string.Empty;
        Name = string.Empty;
        Reason = ReturnReasons.Other;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>RT-2026-00001, or the old system's number (HO04306).</summary>
    public string OrderNo { get; private set; }

    public DocumentSource Source { get; private set; }

    public Guid? CrmId { get; private set; }

    public int? CrmStatus { get; private set; }

    public HousingEntry Entry { get; private set; }

    public Guid? WorkerId { get; private set; }

    public Guid? WorkerCrmId { get; private set; }

    public string WorkerNo { get; private set; }

    public string Name { get; private set; }

    public string? ProfessionCode { get; private set; }

    public string? NationalityCode { get; private set; }

    public string? IqamaNo { get; private set; }

    /// <summary>The project the worker comes back from.</summary>
    public Guid? ProjectId { get; private set; }

    public Guid? ProjectCrmId { get; private set; }

    public string? ProjectName { get; private set; }

    public DateOnly? WorkStartedOn { get; private set; }

    /// <summary>The day the worker arrived in housing (it belongs to the housing period).</summary>
    public DateOnly? ArrivedOn { get; private set; }

    public string Reason { get; private set; }

    public string? ReasonNotes { get; private set; }

    /// <summary>Recorded by sales: replacement, cancellation or nothing.</summary>
    public string? CustomerWish { get; private set; }

    /// <summary>The salary stops while in housing (the default).</summary>
    public bool StopSalary { get; private set; } = true;

    /// <summary>The housing the worker went to: the room's "building — room" when one is chosen.</summary>
    public string? HousingName { get; private set; }

    /// <summary>The room the worker goes to (Housing module); they are put in it when the order completes.</summary>
    public Guid? RoomId { get; private set; }

    public string? DelayReason { get; private set; }

    public string? Notes { get; private set; }

    public ReturnStatus Status { get; private set; }

    public bool AwaitingApproval { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? SubmittedAt { get; private set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    public string? CompletedByName { get; private set; }

    public string? LastComment { get; private set; }

    /// <summary>The last change after the approval: when, by whom and why (each change is in the audit log too).</summary>
    public DateTimeOffset? AmendedAt { get; private set; }

    public string? AmendedByName { get; private set; }

    public string? AmendNote { get; private set; }

    public DateTimeOffset? CanceledAt { get; private set; }

    public string? CanceledByName { get; private set; }

    /// <summary>An approved order of this system: it may still be changed or cancelled (with their own permissions and a reason).</summary>
    public bool IsAmendable => Source == DocumentSource.System && Status == ReturnStatus.Completed;

    public bool IsEditable => Source == DocumentSource.System && Status is ReturnStatus.UnderPreparation or ReturnStatus.Returned;

    public bool IsInApproval => Source == DocumentSource.System && AwaitingApproval
        && Status is ReturnStatus.UnderPreparation or ReturnStatus.SentToSales or ReturnStatus.SentToOperationsManager or ReturnStatus.InApproval;

    public static ReturnOrder Create(string orderNo, ReturnWorker worker, ReturnDetails details, Guid? userId, string userName, DateTimeOffset at)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(orderNo);
        var order = new ReturnOrder
        {
            Id = Guid.CreateVersion7(),
            OrderNo = orderNo,
            Source = DocumentSource.System,
            Entry = HousingEntry.ReturnedWorker,
            Status = ReturnStatus.UnderPreparation,
            CreatedBy = userId,
            CreatedByName = userName,
            CreatedAt = at,
        };
        order.SetWorker(worker);
        order.SetDetails(details);
        return order;
    }

    public Result Update(ReturnWorker worker, ReturnDetails details)
    {
        if (!IsEditable)
        {
            return Result.Failure(ReturnErrors.NotEditable);
        }

        SetWorker(worker);
        SetDetails(details);
        return Result.Success();
    }

    public Result MarkSubmitted(DateTimeOffset at)
    {
        if (!IsEditable || AwaitingApproval)
        {
            return Result.Failure(ReturnErrors.NotEditable);
        }

        Status = ReturnStatus.UnderPreparation;
        AwaitingApproval = true;
        SubmittedAt = at;
        return Result.Success();
    }

    public void SubmissionFailed() => AwaitingApproval = false;

    public Result SetStatusFromProcess(ReturnStatus status)
    {
        if (!IsInApproval || status is not (ReturnStatus.UnderPreparation or ReturnStatus.SentToSales or ReturnStatus.SentToOperationsManager or ReturnStatus.InApproval))
        {
            return Result.Failure(ReturnErrors.StatusNotSettable);
        }

        Status = status;
        return Result.Success();
    }

    /// <summary>Sales record what the customer wants (a required field of their stage).</summary>
    public Result SetCustomerWish(string? wish)
    {
        if (!IsInApproval || (wish is not null && !CustomerWishes.All.Contains(wish)))
        {
            return Result.Failure(ReturnErrors.StatusNotSettable);
        }

        CustomerWish = wish;
        return Result.Success();
    }

    public void ApprovalEnded(ReturnStatus status, string? comment)
    {
        if (!IsInApproval)
        {
            return;
        }

        Status = status;
        AwaitingApproval = false;
        LastComment = comment;
    }

    public Result Complete(string approvedBy, string? comment, DateTimeOffset at)
    {
        if (!IsInApproval)
        {
            return Result.Failure(ReturnErrors.NotInApproval);
        }

        Status = ReturnStatus.Completed;
        AwaitingApproval = false;
        CompletedAt = at;
        CompletedByName = approvedBy;
        LastComment = comment;
        return Result.Success();
    }

    /// <summary>Approved, but the housing period could not open (e.g. a date clashes with the worker's timeline).</summary>
    public void ReturnForFix(string reason)
    {
        Status = ReturnStatus.Returned;
        AwaitingApproval = false;
        CompletedAt = null;
        CompletedByName = null;
        LastComment = reason;
    }

    /// <summary>Changed after its approval (the housing period and room were changed with it).</summary>
    public Result Amend(ReturnDetails details, string reason, string by, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(details);
        if (!IsAmendable)
        {
            return Result.Failure(ReturnErrors.NotAmendable);
        }

        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500)
        {
            return Result.Failure(ReturnErrors.AmendReason);
        }

        SetDetails(details with { DelayReason = DelayReason });
        AmendedAt = at;
        AmendedByName = by;
        AmendNote = reason.Trim();
        return Result.Success();
    }

    /// <summary>Cancelled after its approval (the housing period and room were taken back).</summary>
    public Result CancelApproved(string reason, string by, DateTimeOffset at)
    {
        if (!IsAmendable)
        {
            return Result.Failure(ReturnErrors.NotAmendable);
        }

        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500)
        {
            return Result.Failure(ReturnErrors.AmendReason);
        }

        Status = ReturnStatus.CanceledAfterApproval;
        CanceledAt = at;
        CanceledByName = by;
        LastComment = reason.Trim();
        return Result.Success();
    }

    public Result Cancel(string? comment)
    {
        if (!IsEditable || AwaitingApproval)
        {
            return Result.Failure(ReturnErrors.NotCancelable);
        }

        Status = ReturnStatus.Canceled;
        LastComment = comment;
        return Result.Success();
    }

    public static ReturnOrder FromCrm(Guid crmId) =>
        new() { Id = Guid.CreateVersion7(), Source = DocumentSource.Crm, CrmId = crmId };

    public void UpdateFromCrm(CrmReturnOrder o, ReturnWorker worker)
    {
        ArgumentNullException.ThrowIfNull(o);
        OrderNo = o.OrderNo;
        CrmStatus = o.CrmStatus;
        Status = o.Status;
        Entry = o.Entry;
        Reason = o.Reason;
        HousingName = o.HousingName;
        DelayReason = o.DelayReason;
        ArrivedOn = o.ArrivedOn;
        CreatedByName = o.CreatedByName;
        CreatedAt = o.CreatedAt;
        CompletedAt = o.Status == ReturnStatus.Completed ? o.ModifiedAt : null;
        SetWorker(worker);
    }

    private void SetWorker(ReturnWorker w)
    {
        ArgumentNullException.ThrowIfNull(w);
        WorkerId = w.WorkerId;
        WorkerCrmId = w.WorkerCrmId;
        WorkerNo = w.WorkerNo;
        Name = w.Name;
        ProfessionCode = w.ProfessionCode;
        NationalityCode = w.NationalityCode;
        IqamaNo = w.IqamaNo;
        ProjectId = w.ProjectId;
        ProjectCrmId = w.ProjectCrmId;
        ProjectName = w.ProjectName;
        WorkStartedOn = w.WorkStartedOn;
    }

    /// <summary>Completed, but the worker could not be put in the chosen room (e.g. it filled up meanwhile).</summary>
    public void RoomNotAssigned(string reason) => LastComment = string.IsNullOrWhiteSpace(LastComment) ? reason : $"{LastComment} — {reason}";

    private void SetDetails(ReturnDetails d)
    {
        ArgumentNullException.ThrowIfNull(d);
        ArrivedOn = d.ArrivedOn;
        Reason = d.Reason;
        ReasonNotes = Clean(d.ReasonNotes);
        StopSalary = d.StopSalary;
        HousingName = Clean(d.HousingName);
        RoomId = d.RoomId;
        DelayReason = Clean(d.DelayReason);
        Notes = Clean(d.Notes);
    }

    private static string? Clean(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();
}

public sealed record CrmReturnOrder(
    string OrderNo,
    int? CrmStatus,
    ReturnStatus Status,
    HousingEntry Entry,
    string Reason,
    DateOnly? ArrivedOn,
    string? HousingName,
    string? DelayReason,
    string CreatedByName,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ModifiedAt);

public static class ReturnErrors
{
    public static readonly Error PeriodLocked = Error.Conflict("return_period_locked", "A timesheet, a payroll run or a settlement is already built on a worker's periods from that day.");
    public static readonly Error NotFound = Error.NotFound("return_order", "Return order not found.");
    public static readonly Error NotEditable = Error.Conflict("return_not_editable", "Only an order under preparation or returned can be changed.");
    public static readonly Error NotCancelable = Error.Conflict("return_not_cancelable", "This order can no longer be canceled.");
    public static readonly Error NotInApproval = Error.Conflict("return_not_in_approval", "The order is not in approval.");
    public static readonly Error StatusNotSettable = Error.Validation("return_field_not_settable", "A process cannot set this value.");
    public static readonly Error NotAmendable = Error.Conflict("return_not_amendable", "Only an approved order of this system can be changed or cancelled after its approval.");
    public static readonly Error AmendReason = Error.Validation("return_amend_reason", "Give the reason (500 characters at most).");
    public static readonly Error LaterPeriod = Error.Conflict("return_later_period", "The worker has an action after this order: cancel it first.");
    public static readonly Error PeriodOverlap = Error.Conflict("return_period_overlap", "The new arrival day overlaps another period of the worker.");
}
