using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Operations.Domain;

/// <summary>
/// Where a transfer order stands. The default process: saved ⇒ under preparation, with a confirmation task for its
/// creator ⇒ sent to the operations manager ⇒ transferred (the workers' work periods move to the new project).
/// </summary>
public enum TransferStatus
{
    UnderPreparation,
    SentToOperationsManager,

    /// <summary>In another approval stage (a process of the company's own).</summary>
    InApproval,

    /// <summary>Sent back by an approver to change; saving it starts the approval again.</summary>
    Returned,
    Rejected,

    /// <summary>Approved: the workers are on the new project from the transfer date.</summary>
    Transferred,
    Canceled,

    /// <summary>Cancelled after the transfer: the work periods it opened were taken back (with the reason).</summary>
    CanceledAfterApproval,
}

/// <summary>The order's header fields, as entered.</summary>
public sealed record TransferHeader(
    Guid ProjectId,
    Guid ProjectCrmId,
    string ProjectCode,
    string ProjectName,
    string? CustomerName,
    string? ProjectManager,
    string? ContractType,
    DateOnly TransferOn,
    string? ReceiverName,
    string? ReceiverTitle,
    string? DelayReason,
    string? Notes);

/// <summary>A worker line: the project they leave, and the price on the new project (the package's, or a special price with a reason).</summary>
public sealed record TransferLineValues(
    Guid WorkerId,
    Guid WorkerCrmId,
    string WorkerNo,
    string Name,
    string? ProfessionCode,
    string? NationalityCode,
    string? IqamaNo,
    Guid? FromProjectId,
    Guid? FromProjectCrmId,
    string? FromProjectName,
    DateOnly? FromStartedOn,
    Guid? PackageId,
    string? PackageNo,
    decimal Salary,
    decimal ServiceFee,
    decimal Housing,
    bool HousingBillable,
    decimal Transport,
    bool TransportBillable,
    bool IsSpecialPrice,
    string? SpecialReason)
{
    public decimal TotalPrice => Salary + ServiceFee + Housing + Transport;
}

/// <summary>
/// A transfer order: one or more workers on the job moved from their project to another one
/// (docs/02-target-architecture/05 §2.4), without passing through housing. Each line takes the price of the new
/// project's package for the worker's profession and nationality; a different price is a special price with a reason.
/// On approval the worker's work period on the old project closes on the transfer date and a new one opens on the new
/// project the same day.
/// </summary>
public sealed class TransferOrder : ITenantOwned
{
    private readonly List<TransferLine> _lines = [];

    private TransferOrder()
    {
        OrderNo = string.Empty;
        ProjectCode = string.Empty;
        ProjectName = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>TR-2026-00001.</summary>
    public string OrderNo { get; private set; }

    /// <summary>The new project.</summary>
    public Guid ProjectId { get; private set; }

    public Guid ProjectCrmId { get; private set; }

    public string ProjectCode { get; private set; }

    public string ProjectName { get; private set; }

    public string? CustomerName { get; private set; }

    public string? ProjectManager { get; private set; }

    public string? ContractType { get; private set; }

    /// <summary>The first day on the new project (the old project's period ends the day before).</summary>
    public DateOnly TransferOn { get; private set; }

    /// <summary>Who receives the workers on the new project (optional).</summary>
    public string? ReceiverName { get; private set; }

    public string? ReceiverTitle { get; private set; }

    /// <summary>Why the order is registered late (required when the transfer date is more than two days ago).</summary>
    public string? DelayReason { get; private set; }

    public string? Notes { get; private set; }

    public TransferStatus Status { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? SubmittedAt { get; private set; }

    /// <summary>An approval of the order is running (from its submission until the approval ends).</summary>
    public bool AwaitingApproval { get; private set; }

    public DateTimeOffset? TransferredAt { get; private set; }

    public string? TransferredByName { get; private set; }

    public string? LastComment { get; private set; }

    /// <summary>The last change after the transfer: when, by whom and why (each change is in the audit log too).</summary>
    public DateTimeOffset? AmendedAt { get; private set; }

    public string? AmendedByName { get; private set; }

    public string? AmendNote { get; private set; }

    public DateTimeOffset? CanceledAt { get; private set; }

    public string? CanceledByName { get; private set; }

    public IReadOnlyList<TransferLine> Lines => _lines;

    /// <summary>A transferred order: it may still be changed or cancelled (with their own permissions and a reason).</summary>
    public bool IsAmendable => Status == TransferStatus.Transferred;

    public bool IsEditable => Status is TransferStatus.UnderPreparation or TransferStatus.Returned;

    /// <summary>In an approval stage (statuses an approval can end from).</summary>
    public bool IsInApproval => AwaitingApproval
        && Status is TransferStatus.UnderPreparation or TransferStatus.SentToOperationsManager or TransferStatus.InApproval;

    public static TransferOrder Create(string orderNo, TransferHeader header, IEnumerable<TransferLineValues> lines, Guid? userId, string userName, DateTimeOffset at)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(orderNo);
        var order = new TransferOrder
        {
            Id = Guid.CreateVersion7(),
            OrderNo = orderNo,
            Status = TransferStatus.UnderPreparation,
            CreatedBy = userId,
            CreatedByName = userName,
            CreatedAt = at,
        };
        order.SetHeader(header);
        order.SetLines(lines);
        return order;
    }

    public Result Update(TransferHeader header, IEnumerable<TransferLineValues> lines)
    {
        if (!IsEditable)
        {
            return Result.Failure(TransferErrors.NotEditable);
        }

        SetHeader(header);
        SetLines(lines);
        return Result.Success();
    }

    public Result MarkSubmitted(DateTimeOffset at)
    {
        if (!IsEditable || AwaitingApproval)
        {
            return Result.Failure(TransferErrors.NotEditable);
        }

        if (_lines.Count == 0)
        {
            return Result.Failure(TransferErrors.NoWorkers);
        }

        Status = TransferStatus.UnderPreparation;
        AwaitingApproval = true;
        SubmittedAt = at;
        return Result.Success();
    }

    /// <summary>The approval could not start (no process applies): the order waits under preparation.</summary>
    public void SubmissionFailed() => AwaitingApproval = false;

    /// <summary>A step of the approval process sets the status (e.g. "sent to the operations manager").</summary>
    public Result SetStatusFromProcess(TransferStatus status)
    {
        if (!IsInApproval || status is not (TransferStatus.SentToOperationsManager or TransferStatus.InApproval or TransferStatus.UnderPreparation))
        {
            return Result.Failure(TransferErrors.StatusNotSettable);
        }

        Status = status;
        return Result.Success();
    }

    /// <summary>The approval ended without approving it: returned for changes, rejected, or withdrawn.</summary>
    public void ApprovalEnded(TransferStatus status, string? comment)
    {
        if (!IsInApproval)
        {
            return;
        }

        Status = status;
        AwaitingApproval = false;
        LastComment = comment;
    }

    /// <summary>Approved by the last stage: transferred (the workers' periods are then moved in the period ledger).</summary>
    public Result Complete(string approvedBy, string? comment, DateTimeOffset at)
    {
        if (!IsInApproval)
        {
            return Result.Failure(TransferErrors.NotInApproval);
        }

        Status = TransferStatus.Transferred;
        AwaitingApproval = false;
        TransferredAt = at;
        TransferredByName = approvedBy;
        LastComment = comment;
        return Result.Success();
    }

    /// <summary>Approved, but the periods could not move (e.g. the date clashes with a worker's timeline): back to its creator.</summary>
    public void ReturnForFix(string reason)
    {
        Status = TransferStatus.Returned;
        AwaitingApproval = false;
        TransferredAt = null;
        TransferredByName = null;
        LastComment = reason;
    }

    /// <summary>Changed after the transfer: the transfer date, the receiver, the notes, and each changed line's price (with the reason).</summary>
    public Result Amend(DateOnly transferOn, string? receiverName, string? receiverTitle, string? notes, IReadOnlyList<TransferLineChange> lines, string reason, string by, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(lines);
        if (!IsAmendable)
        {
            return Result.Failure(TransferErrors.NotAmendable);
        }

        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500)
        {
            return Result.Failure(TransferErrors.AmendReason);
        }

        foreach (var change in lines)
        {
            if (_lines.FirstOrDefault(l => l.Id == change.LineId) is not { } line)
            {
                return Result.Failure(TransferErrors.LineNotFound);
            }

            line.Amend(change.TotalPrice, change.SpecialReason);
        }

        TransferOn = transferOn;
        ReceiverName = Clean(receiverName);
        ReceiverTitle = Clean(receiverTitle);
        Notes = Clean(notes);
        AmendedAt = at;
        AmendedByName = by;
        AmendNote = reason.Trim();
        return Result.Success();
    }

    /// <summary>Cancelled after the transfer (the work periods were taken back).</summary>
    public Result CancelApproved(string reason, string by, DateTimeOffset at)
    {
        if (!IsAmendable)
        {
            return Result.Failure(TransferErrors.NotAmendable);
        }

        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500)
        {
            return Result.Failure(TransferErrors.AmendReason);
        }

        Status = TransferStatus.CanceledAfterApproval;
        CanceledAt = at;
        CanceledByName = by;
        LastComment = reason.Trim();
        return Result.Success();
    }

    public Result Cancel(string? comment)
    {
        if (!IsEditable || AwaitingApproval)
        {
            return Result.Failure(TransferErrors.NotCancelable);
        }

        Status = TransferStatus.Canceled;
        LastComment = comment;
        return Result.Success();
    }

    private void SetHeader(TransferHeader h)
    {
        ArgumentNullException.ThrowIfNull(h);
        ProjectId = h.ProjectId;
        ProjectCrmId = h.ProjectCrmId;
        ProjectCode = h.ProjectCode;
        ProjectName = h.ProjectName;
        CustomerName = h.CustomerName;
        ProjectManager = h.ProjectManager;
        ContractType = h.ContractType;
        TransferOn = h.TransferOn;
        ReceiverName = Clean(h.ReceiverName);
        ReceiverTitle = Clean(h.ReceiverTitle);
        DelayReason = Clean(h.DelayReason);
        Notes = Clean(h.Notes);
    }

    private void SetLines(IEnumerable<TransferLineValues> lines)
    {
        ArgumentNullException.ThrowIfNull(lines);
        _lines.Clear();
        var order = 0;
        foreach (var values in lines)
        {
            _lines.Add(new TransferLine(Id, ++order, values));
        }
    }

    private static string? Clean(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();
}

/// <summary>A worker on a transfer order: the project they leave, and the new project's price copied at the time.</summary>
public sealed class TransferLine : ITenantOwned
{
    private TransferLine()
    {
        WorkerNo = string.Empty;
        Name = string.Empty;
    }

    internal TransferLine(Guid orderId, int lineNo, TransferLineValues v)
        : this()
    {
        Id = Guid.CreateVersion7();
        OrderId = orderId;
        LineNo = lineNo;
        WorkerId = v.WorkerId;
        WorkerCrmId = v.WorkerCrmId;
        WorkerNo = v.WorkerNo;
        Name = v.Name;
        ProfessionCode = v.ProfessionCode;
        NationalityCode = v.NationalityCode;
        IqamaNo = v.IqamaNo;
        FromProjectId = v.FromProjectId;
        FromProjectCrmId = v.FromProjectCrmId;
        FromProjectName = v.FromProjectName;
        FromStartedOn = v.FromStartedOn;
        PackageId = v.PackageId;
        PackageNo = v.PackageNo;
        Salary = v.Salary;
        ServiceFee = v.ServiceFee;
        Housing = v.Housing;
        HousingBillable = v.HousingBillable;
        Transport = v.Transport;
        TransportBillable = v.TransportBillable;
        TotalPrice = v.TotalPrice;
        IsSpecialPrice = v.IsSpecialPrice;
        SpecialReason = v.SpecialReason;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid OrderId { get; private set; }

    public int LineNo { get; private set; }

    public Guid WorkerId { get; private set; }

    public Guid WorkerCrmId { get; private set; }

    public string WorkerNo { get; private set; }

    public string Name { get; private set; }

    public string? ProfessionCode { get; private set; }

    public string? NationalityCode { get; private set; }

    public string? IqamaNo { get; private set; }

    /// <summary>The project the worker leaves (null in the Commercial module when it was not brought over).</summary>
    public Guid? FromProjectId { get; private set; }

    public Guid? FromProjectCrmId { get; private set; }

    public string? FromProjectName { get; private set; }

    /// <summary>When the worker started on the project they leave.</summary>
    public DateOnly? FromStartedOn { get; private set; }

    public Guid? PackageId { get; private set; }

    public string? PackageNo { get; private set; }

    public decimal Salary { get; private set; }

    public decimal ServiceFee { get; private set; }

    public decimal Housing { get; private set; }

    public bool HousingBillable { get; private set; }

    public decimal Transport { get; private set; }

    public bool TransportBillable { get; private set; }

    /// <summary>The full monthly service price on the new project.</summary>
    public decimal TotalPrice { get; private set; }

    public bool IsSpecialPrice { get; private set; }

    public string? SpecialReason { get; private set; }

    /// <summary>Changed after the transfer: a different price is a special price with its reason.</summary>
    internal void Amend(decimal totalPrice, string? specialReason)
    {
        if (totalPrice != TotalPrice)
        {
            TotalPrice = totalPrice;
            IsSpecialPrice = true;
            PackageId = null;
            PackageNo = null;
            SpecialReason = string.IsNullOrWhiteSpace(specialReason) ? SpecialReason : specialReason.Trim();
        }
    }
}

/// <summary>A transferred line's change: the worker's monthly service price on the new project (with the reason when it is new).</summary>
public sealed record TransferLineChange(Guid LineId, decimal TotalPrice, string? SpecialReason);

public static class TransferErrors
{
    public static readonly Error PeriodLocked = Error.Conflict("transfer_period_locked", "A timesheet, a payroll run or a settlement is already built on a worker's periods from that day.");
    public static readonly Error NotFound = Error.NotFound("transfer_order", "Transfer order not found.");
    public static readonly Error NotEditable = Error.Conflict("transfer_not_editable", "Only a draft or returned order can be changed.");
    public static readonly Error NotInApproval = Error.Conflict("transfer_not_in_approval", "The order is not in approval.");
    public static readonly Error StatusNotSettable = Error.Validation("transfer_status_not_settable", "This status cannot be set by a process.");
    public static readonly Error NotCancelable = Error.Conflict("transfer_not_cancelable", "This order can no longer be canceled.");
    public static readonly Error NoWorkers = Error.Validation("transfer_no_workers", "Add at least one worker.");
    public static readonly Error NotAmendable = Error.Conflict("transfer_not_amendable", "Only a transferred order can be changed or cancelled after its approval.");
    public static readonly Error AmendReason = Error.Validation("transfer_amend_reason", "Give the reason (500 characters at most).");
    public static readonly Error LineNotFound = Error.NotFound("transfer_line", "The worker is not on this order.");
    public static readonly Error LaterPeriod = Error.Conflict("transfer_later_period", "A worker of the order has an action after it: cancel it first.");
    public static readonly Error PeriodOverlap = Error.Conflict("transfer_period_overlap", "The new transfer date overlaps another period of a worker.");
    public static readonly Error SpecialReason = Error.Validation("transfer_special_reason", "A special price needs its reason.");
}
