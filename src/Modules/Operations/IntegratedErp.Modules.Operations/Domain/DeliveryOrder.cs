using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Operations.Domain;

/// <summary>
/// Where a delivery order stands. The default process: saved ⇒ under preparation, with a confirmation task for its
/// creator ⇒ sent to the operations manager ⇒ delivered (the workers' work periods open).
/// </summary>
public enum DeliveryStatus
{
    /// <summary>Saved; the creator confirms it (old system: "قيد الإعداد").</summary>
    UnderPreparation,

    /// <summary>Confirmed by its creator, waiting for the operations manager (old system: 279640011).</summary>
    SentToOperationsManager,

    /// <summary>In another approval stage (a process of the company's own, or old orders sent to others).</summary>
    InApproval,

    /// <summary>Sent back by an approver to change; saving it starts the approval again.</summary>
    Returned,
    Rejected,

    /// <summary>Approved by the operations manager: delivered (old system: "تم التسليم").</summary>
    Delivered,

    /// <summary>Old system only: "لم يتم التسليم".</summary>
    NotDelivered,
    Canceled,
}

/// <summary>Who created the order: this system, or the old CRM (copied, read-only).</summary>
public enum DocumentSource
{
    System,
    Crm,
}

/// <summary>The order's header fields, as entered.</summary>
public sealed record DeliveryHeader(
    Guid ProjectId,
    Guid ProjectCrmId,
    string ProjectCode,
    string ProjectName,
    string? CustomerName,
    string? ProjectManager,
    string? ContractType,
    DateOnly DeliverOn,
    DateOnly StartOn,
    string ReceiverName,
    string? ReceiverTitle,
    string? DelayReason,
    string? Notes);

/// <summary>A worker line with its price (copied from the package, or a special price with a reason).</summary>
public sealed record DeliveryLineValues(
    Guid? WorkerId,
    Guid? WorkerCrmId,
    string WorkerNo,
    string Name,
    string? ProfessionCode,
    string? NationalityCode,
    string? IqamaNo,
    Guid? PackageId,
    string? PackageNo,
    decimal Salary,
    decimal ServiceFee,
    decimal Housing,
    bool HousingBillable,
    decimal Transport,
    bool TransportBillable,
    bool IsSpecialPrice,
    string? SpecialReason,
    DateOnly? StartOn,
    string? WorkStartNo = null,
    DateOnly? StartedOn = null)
{
    public decimal TotalPrice => Salary + ServiceFee + Housing + Transport;
}

/// <summary>
/// A delivery order: one or more workers delivered to a project (docs/02-target-architecture/05 §2.2). Each line takes
/// the price of the package of the worker's profession and nationality; a different price is a special price with a
/// reason. Drafted, sent for approval, then confirmed by the delivery officer for the whole order (no partial delivery).
/// Orders copied from the old system are read-only.
/// </summary>
public sealed class DeliveryOrder : ITenantOwned
{
    private readonly List<DeliveryLine> _lines = [];

    private DeliveryOrder()
    {
        OrderNo = string.Empty;
        ProjectCode = string.Empty;
        ProjectName = string.Empty;
        ReceiverName = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>DO-2026-00001, or the old system's number (D003162).</summary>
    public string OrderNo { get; private set; }

    public DocumentSource Source { get; private set; }

    public Guid? CrmId { get; private set; }

    /// <summary>The old system's status code (orders copied from it).</summary>
    public int? CrmStatus { get; private set; }

    /// <summary>The project in the Commercial module (null when it is not brought over, e.g. created before 2025).</summary>
    public Guid? ProjectId { get; private set; }

    public Guid? ProjectCrmId { get; private set; }

    public string ProjectCode { get; private set; }

    public string ProjectName { get; private set; }

    public string? CustomerName { get; private set; }

    public string? ProjectManager { get; private set; }

    public string? ContractType { get; private set; }

    public DateOnly? DeliverOn { get; private set; }

    /// <summary>The default start of work of the lines.</summary>
    public DateOnly? StartOn { get; private set; }

    /// <summary>The person authorised to receive the workers.</summary>
    public string ReceiverName { get; private set; }

    public string? ReceiverTitle { get; private set; }

    /// <summary>Why the order is registered late (required when the delivery date is more than two days ago).</summary>
    public string? DelayReason { get; private set; }

    public string? Notes { get; private set; }

    public DeliveryStatus Status { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? SubmittedAt { get; private set; }

    /// <summary>An approval of the order is running (from its submission until the approval ends).</summary>
    public bool AwaitingApproval { get; private set; }

    public DateTimeOffset? DeliveredAt { get; private set; }

    public string? DeliveredByName { get; private set; }

    public string? LastComment { get; private set; }

    public IReadOnlyList<DeliveryLine> Lines => _lines;

    public bool IsEditable => Source == DocumentSource.System && Status is DeliveryStatus.UnderPreparation or DeliveryStatus.Returned;

    /// <summary>In an approval stage (statuses an approval can end from).</summary>
    public bool IsInApproval => Source == DocumentSource.System && AwaitingApproval
        && Status is DeliveryStatus.UnderPreparation or DeliveryStatus.SentToOperationsManager or DeliveryStatus.InApproval;

    public static DeliveryOrder Create(string orderNo, DeliveryHeader header, IEnumerable<DeliveryLineValues> lines, Guid? userId, string userName, DateTimeOffset at)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(orderNo);
        var order = new DeliveryOrder
        {
            Id = Guid.CreateVersion7(),
            OrderNo = orderNo,
            Source = DocumentSource.System,
            Status = DeliveryStatus.UnderPreparation,
            CreatedBy = userId,
            CreatedByName = userName,
            CreatedAt = at,
        };
        order.SetHeader(header);
        order.SetLines(lines);
        return order;
    }

    public Result Update(DeliveryHeader header, IEnumerable<DeliveryLineValues> lines)
    {
        if (!IsEditable)
        {
            return Result.Failure(DeliveryErrors.NotEditable);
        }

        SetHeader(header);
        SetLines(lines);
        return Result.Success();
    }

    public Result MarkSubmitted(DateTimeOffset at)
    {
        if (!IsEditable || AwaitingApproval)
        {
            return Result.Failure(DeliveryErrors.NotEditable);
        }

        if (_lines.Count == 0)
        {
            return Result.Failure(DeliveryErrors.NoWorkers);
        }

        Status = DeliveryStatus.UnderPreparation;
        AwaitingApproval = true;
        SubmittedAt = at;
        return Result.Success();
    }

    /// <summary>The approval could not start (no process applies): the order waits under preparation.</summary>
    public void SubmissionFailed() => AwaitingApproval = false;

    /// <summary>A step of the approval process sets the status (e.g. "sent to the operations manager").</summary>
    public Result SetStatusFromProcess(DeliveryStatus status)
    {
        if (!IsInApproval || status is not (DeliveryStatus.SentToOperationsManager or DeliveryStatus.InApproval or DeliveryStatus.UnderPreparation))
        {
            return Result.Failure(DeliveryErrors.StatusNotSettable);
        }

        Status = status;
        return Result.Success();
    }

    /// <summary>The approval ended without approving it: returned for changes, rejected, or withdrawn.</summary>
    public void ApprovalEnded(DeliveryStatus status, string? comment)
    {
        if (!IsInApproval)
        {
            return;
        }

        Status = status;
        AwaitingApproval = false;
        LastComment = comment;
    }

    /// <summary>
    /// Approved by the last stage (the operations manager): delivered, every worker starting on their line's date
    /// (the order's when the line has none). The workers' work periods are then opened in the period ledger.
    /// </summary>
    public Result Deliver(string approvedBy, string? comment, DateTimeOffset at)
    {
        if (!IsInApproval)
        {
            return Result.Failure(DeliveryErrors.NotInApproval);
        }

        foreach (var line in _lines)
        {
            line.Confirm(line.StartOn ?? StartOn ?? DeliverOn!.Value);
        }

        Status = DeliveryStatus.Delivered;
        AwaitingApproval = false;
        DeliveredAt = at;
        DeliveredByName = approvedBy;
        LastComment = comment;
        return Result.Success();
    }

    /// <summary>Delivered, but the work periods could not open (e.g. a date clashes with a worker's timeline): back to its creator.</summary>
    public void ReturnForFix(string reason)
    {
        Status = DeliveryStatus.Returned;
        AwaitingApproval = false;
        DeliveredAt = null;
        DeliveredByName = null;
        LastComment = reason;
        foreach (var line in _lines)
        {
            line.Confirm(null);
        }
    }

    public Result Cancel(string? comment)
    {
        if (!IsEditable || AwaitingApproval)
        {
            return Result.Failure(DeliveryErrors.NotCancelable);
        }

        Status = DeliveryStatus.Canceled;
        LastComment = comment;
        return Result.Success();
    }

    /// <summary>An order copied from the old system (read-only here).</summary>
    public static DeliveryOrder FromCrm(Guid crmId)
    {
        return new DeliveryOrder { Id = Guid.CreateVersion7(), Source = DocumentSource.Crm, CrmId = crmId, CreatedByName = string.Empty };
    }

    /// <summary>Refreshes an order copied from the old system.</summary>
    public void UpdateFromCrm(CrmDeliveryOrder o, IEnumerable<DeliveryLineValues> lines)
    {
        ArgumentNullException.ThrowIfNull(o);
        OrderNo = o.OrderNo;
        CrmStatus = o.CrmStatus;
        Status = o.Status;
        ProjectId = o.ProjectId;
        ProjectCrmId = o.ProjectCrmId;
        ProjectCode = o.ProjectCode;
        ProjectName = o.ProjectName;
        CustomerName = o.CustomerName;
        ProjectManager = o.ProjectManager;
        ContractType = o.ContractType;
        DeliverOn = o.DeliverOn;
        StartOn = o.StartOn;
        ReceiverName = o.ReceiverName;
        ReceiverTitle = o.ReceiverTitle;
        CreatedByName = o.CreatedByName;
        CreatedAt = o.CreatedAt;
        DeliveredAt = o.Status == DeliveryStatus.Delivered ? o.ModifiedAt : null;
        SetLines(lines);
    }

    private void SetHeader(DeliveryHeader h)
    {
        ArgumentNullException.ThrowIfNull(h);
        ProjectId = h.ProjectId;
        ProjectCrmId = h.ProjectCrmId;
        ProjectCode = h.ProjectCode;
        ProjectName = h.ProjectName;
        CustomerName = h.CustomerName;
        ProjectManager = h.ProjectManager;
        ContractType = h.ContractType;
        DeliverOn = h.DeliverOn;
        StartOn = h.StartOn;
        ReceiverName = h.ReceiverName.Trim();
        ReceiverTitle = Clean(h.ReceiverTitle);
        DelayReason = Clean(h.DelayReason);
        Notes = Clean(h.Notes);
    }

    private void SetLines(IEnumerable<DeliveryLineValues> lines)
    {
        ArgumentNullException.ThrowIfNull(lines);
        _lines.Clear();
        var order = 0;
        foreach (var values in lines)
        {
            _lines.Add(new DeliveryLine(Id, ++order, values));
        }
    }

    private static string? Clean(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();
}

/// <summary>A worker on a delivery order, with the price copied from the package at the time.</summary>
public sealed class DeliveryLine : ITenantOwned
{
    private DeliveryLine()
    {
        WorkerNo = string.Empty;
        Name = string.Empty;
    }

    internal DeliveryLine(Guid orderId, int lineNo, DeliveryLineValues v)
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
        StartOn = v.StartOn;
        WorkStartNo = v.WorkStartNo;
        StartedOn = v.StartedOn;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid OrderId { get; private set; }

    public int LineNo { get; private set; }

    public Guid? WorkerId { get; private set; }

    public Guid? WorkerCrmId { get; private set; }

    public string WorkerNo { get; private set; }

    public string Name { get; private set; }

    public string? ProfessionCode { get; private set; }

    public string? NationalityCode { get; private set; }

    public string? IqamaNo { get; private set; }

    public Guid? PackageId { get; private set; }

    public string? PackageNo { get; private set; }

    public decimal Salary { get; private set; }

    public decimal ServiceFee { get; private set; }

    public decimal Housing { get; private set; }

    public bool HousingBillable { get; private set; }

    public decimal Transport { get; private set; }

    public bool TransportBillable { get; private set; }

    /// <summary>The full monthly service price of the worker.</summary>
    public decimal TotalPrice { get; private set; }

    public bool IsSpecialPrice { get; private set; }

    public string? SpecialReason { get; private set; }

    /// <summary>Planned start of work (the order's when empty).</summary>
    public DateOnly? StartOn { get; private set; }

    /// <summary>Confirmed start of work.</summary>
    public DateOnly? StartedOn { get; private set; }

    /// <summary>The old system's work start (SW000000), on orders copied from it.</summary>
    public string? WorkStartNo { get; private set; }

    internal void Confirm(DateOnly? startedOn) => StartedOn = startedOn;
}

/// <summary>An order as read from the old system.</summary>
public sealed record CrmDeliveryOrder(
    string OrderNo,
    int? CrmStatus,
    DeliveryStatus Status,
    Guid? ProjectId,
    Guid? ProjectCrmId,
    string ProjectCode,
    string ProjectName,
    string? CustomerName,
    string? ProjectManager,
    string? ContractType,
    DateOnly? DeliverOn,
    DateOnly? StartOn,
    string ReceiverName,
    string? ReceiverTitle,
    string CreatedByName,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ModifiedAt);

public static class DeliveryErrors
{
    public static readonly Error NotFound = Error.NotFound("delivery_order", "Delivery order not found.");
    public static readonly Error NotEditable = Error.Conflict("delivery_not_editable", "Only a draft or returned order can be changed.");
    public static readonly Error NotInApproval = Error.Conflict("delivery_not_in_approval", "The order is not in approval.");
    public static readonly Error StatusNotSettable = Error.Validation("delivery_status_not_settable", "This status cannot be set by a process.");
    public static readonly Error NotCancelable = Error.Conflict("delivery_not_cancelable", "This order can no longer be canceled.");
    public static readonly Error NoWorkers = Error.Validation("delivery_no_workers", "Add at least one worker.");
    public static readonly Error StartBeforeDelivery = Error.Validation("delivery_start_before", "The start of work cannot be before the delivery date.");
}
