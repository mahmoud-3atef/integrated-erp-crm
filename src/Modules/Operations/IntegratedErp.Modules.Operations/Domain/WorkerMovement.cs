using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Operations.Domain;

/// <summary>The worker movements beyond delivery, return and transfer (docs/02-target-architecture/05 §2.1, 2.7–2.10).</summary>
public enum MovementType
{
    /// <summary>A new worker arrives: into housing.</summary>
    Arrival,

    /// <summary>Leaves on vacation (regular, or on the customer and billed).</summary>
    VacationDeparture,

    /// <summary>Back from vacation: to housing, to the previous project, or to a new one.</summary>
    VacationReturn,

    /// <summary>Stopped coming (absconding): no salary, no billing.</summary>
    Absconding,

    /// <summary>Back after an absconding report: into housing.</summary>
    AbscondingReturn,

    /// <summary>Suspended (sickness, investigation, prison…): no salary, no billing.</summary>
    Suspension,

    /// <summary>The suspension lifted: into housing.</summary>
    SuspensionLift,

    /// <summary>Leaves the company for good (final exit, end of service, sponsorship moved out).</summary>
    FinalExit,
}

/// <summary>Where a movement document stands. It is executed (the worker's period opens) when approved.</summary>
public enum MovementStatus
{
    InApproval,

    /// <summary>Sent back by an approver: changed and sent again.</summary>
    Returned,
    Rejected,

    /// <summary>Approved and applied to the worker's timeline.</summary>
    Executed,
    Canceled,

    /// <summary>Cancelled after its execution: the period it opened was taken back (with the reason).</summary>
    CanceledAfterApproval,
}

public enum VacationKind
{
    /// <summary>Not billed, no salary from the project.</summary>
    Regular,

    /// <summary>On the customer: billed at the worker's price on the project.</summary>
    Client,
}

/// <summary>Where a worker back from vacation goes.</summary>
public enum ReturnTarget
{
    Housing,
    SameProject,
    NewProject,
}

public enum SuspensionReason
{
    Sickness,
    Investigation,
    Prison,
    Other,
}

public enum ExitKind
{
    FinalExit,
    EndOfService,
    SponsorshipTransfer,
}

/// <summary>A project and the worker's price on it, for a worker back from vacation straight to work.</summary>
public sealed record MovementWork(
    Guid ProjectId,
    Guid ProjectCrmId,
    string ProjectName,
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

/// <summary>The worker as the document saw them (number, name, where they were).</summary>
public sealed record MovementWorker(Guid WorkerId, string WorkerNo, string Name, string? IqamaNo, string FromPlacement, Guid? FromProjectCrmId, string? FromProjectName);

/// <summary>What a movement says, by its type (the fields its type does not use stay empty).</summary>
public sealed record MovementDetails(
    DateOnly EffectiveOn,
    DateOnly? ExpectedReturnOn,
    VacationKind? VacationKind,
    ReturnTarget? ReturnTo,
    MovementWork? Work,
    bool PaySalary,
    SuspensionReason? SuspensionReason,
    ExitKind? ExitKind,
    string? Place,
    string? DelayReason,
    string? Notes);

/// <summary>
/// A worker movement (docs/02-target-architecture/05): one worker, one change of where they are — arrival, vacation and
/// return, absconding and return, suspension and its lifting, final exit. Numbered and sent through the company's
/// approval process when made; approved, it is executed at once: the worker's current period closes and the new one
/// opens on the movement's date (a vacation on the customer keeps being billed).
/// </summary>
public sealed class WorkerMovement : ITenantOwned
{
    private WorkerMovement()
    {
        MovementNo = string.Empty;
        WorkerNo = string.Empty;
        WorkerName = string.Empty;
        FromPlacement = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string MovementNo { get; private set; }

    public MovementType Type { get; private set; }

    public Guid WorkerId { get; private set; }

    public string WorkerNo { get; private set; }

    public string WorkerName { get; private set; }

    public string? IqamaNo { get; private set; }

    /// <summary>Where the worker was when the document was made (Working, Housing, Vacation…).</summary>
    public string FromPlacement { get; private set; }

    public Guid? FromProjectCrmId { get; private set; }

    public string? FromProjectName { get; private set; }

    public DateOnly EffectiveOn { get; private set; }

    public DateOnly? ExpectedReturnOn { get; private set; }

    public VacationKind? VacationKind { get; private set; }

    public ReturnTarget? ReturnTo { get; private set; }

    public Guid? ProjectId { get; private set; }

    public Guid? ProjectCrmId { get; private set; }

    public string? ProjectName { get; private set; }

    public Guid? PackageId { get; private set; }

    public string? PackageNo { get; private set; }

    public decimal Salary { get; private set; }

    public decimal ServiceFee { get; private set; }

    public decimal Housing { get; private set; }

    public bool HousingBillable { get; private set; }

    public decimal Transport { get; private set; }

    public bool TransportBillable { get; private set; }

    public bool IsSpecialPrice { get; private set; }

    public string? SpecialReason { get; private set; }

    public bool PaySalary { get; private set; }

    public SuspensionReason? SuspensionReason { get; private set; }

    public ExitKind? ExitKind { get; private set; }

    /// <summary>The housing, or the last known place (absconding).</summary>
    public string? Place { get; private set; }

    public string? DelayReason { get; private set; }

    public string? Notes { get; private set; }

    public MovementStatus Status { get; private set; }

    public bool AwaitingApproval { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? ExecutedAt { get; private set; }

    public string? ExecutedByName { get; private set; }

    public string? LastComment { get; private set; }

    /// <summary>The last change after the execution: when, by whom and why (each change is in the audit log too).</summary>
    public DateTimeOffset? AmendedAt { get; private set; }

    public string? AmendedByName { get; private set; }

    public string? AmendNote { get; private set; }

    public DateTimeOffset? CanceledAt { get; private set; }

    public string? CanceledByName { get; private set; }

    public decimal TotalPrice => Salary + ServiceFee + Housing + Transport;

    public bool IsEditable => Status == MovementStatus.Returned && !AwaitingApproval;

    /// <summary>An executed movement: it may still be changed or cancelled (with its type's own permissions and a reason).</summary>
    public bool IsAmendable => Status == MovementStatus.Executed;

    public bool IsOpen => Status is MovementStatus.InApproval or MovementStatus.Returned;

    /// <summary>The kind of period the movement opens (Work for a return straight to a project).</summary>
    public string OpensPeriod => Type switch
    {
        MovementType.VacationDeparture => VacationKind == Domain.VacationKind.Client ? "ClientVacation" : "Vacation",
        MovementType.VacationReturn when ReturnTo is ReturnTarget.SameProject or ReturnTarget.NewProject => "Work",
        MovementType.Absconding => "Absconded",
        MovementType.Suspension => "Suspended",
        MovementType.FinalExit => "Out",
        _ => "Housing",
    };

    public static WorkerMovement Create(string number, MovementType type, MovementWorker worker, MovementDetails details, Guid? by, string byName, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(worker);
        var movement = new WorkerMovement
        {
            Id = Guid.CreateVersion7(),
            MovementNo = number,
            Type = type,
            WorkerId = worker.WorkerId,
            WorkerNo = worker.WorkerNo,
            WorkerName = worker.Name,
            IqamaNo = worker.IqamaNo,
            FromPlacement = worker.FromPlacement,
            FromProjectCrmId = worker.FromProjectCrmId,
            FromProjectName = worker.FromProjectName,
            Status = MovementStatus.Returned, // not yet sent: submitting it starts the approval
            CreatedBy = by,
            CreatedByName = byName,
            CreatedAt = at,
        };
        movement.Apply(details);
        return movement;
    }

    /// <summary>Changes a returned movement (the worker and the type stay).</summary>
    public Result Update(MovementDetails details)
    {
        if (!IsEditable)
        {
            return Result.Failure(MovementErrors.NotEditable);
        }

        Apply(details);
        return Result.Success();
    }

    public Result MarkSubmitted()
    {
        if (!IsEditable)
        {
            return Result.Failure(MovementErrors.NotEditable);
        }

        Status = MovementStatus.InApproval;
        AwaitingApproval = true;
        return Result.Success();
    }

    public void SubmissionFailed()
    {
        Status = MovementStatus.Returned;
        AwaitingApproval = false;
    }

    public void Execute(string by, string? comment, DateTimeOffset at)
    {
        Status = MovementStatus.Executed;
        AwaitingApproval = false;
        ExecutedAt = at;
        ExecutedByName = by;
        LastComment = comment;
    }

    /// <summary>The approval ended without approving (or the movement could not be applied): back to be changed, or rejected.</summary>
    public void ApprovalEnded(MovementStatus status, string? comment)
    {
        Status = status;
        AwaitingApproval = false;
        LastComment = comment;
    }

    /// <summary>Changed after the execution: its date, the expected return (a vacation), the place and the notes (with the reason).</summary>
    public Result Amend(DateOnly effectiveOn, DateOnly? expectedReturnOn, string? place, string? notes, string reason, string by, DateTimeOffset at)
    {
        if (!IsAmendable)
        {
            return Result.Failure(MovementErrors.NotAmendable);
        }

        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500)
        {
            return Result.Failure(MovementErrors.AmendReason);
        }

        if (Type == MovementType.VacationDeparture && expectedReturnOn is { } back && back <= effectiveOn)
        {
            return Result.Failure(MovementErrors.ExpectedReturn);
        }

        EffectiveOn = effectiveOn;
        ExpectedReturnOn = Type == MovementType.VacationDeparture ? expectedReturnOn : ExpectedReturnOn;
        Place = Clean(place, 200);
        Notes = Clean(notes, 1000);
        AmendedAt = at;
        AmendedByName = by;
        AmendNote = reason.Trim();
        return Result.Success();
    }

    /// <summary>Cancelled after the execution (the period it opened was taken back).</summary>
    public Result CancelApproved(string reason, string by, DateTimeOffset at)
    {
        if (!IsAmendable)
        {
            return Result.Failure(MovementErrors.NotAmendable);
        }

        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500)
        {
            return Result.Failure(MovementErrors.AmendReason);
        }

        Status = MovementStatus.CanceledAfterApproval;
        CanceledAt = at;
        CanceledByName = by;
        LastComment = reason.Trim();
        return Result.Success();
    }

    public Result Cancel(string? comment)
    {
        if (!IsEditable)
        {
            return Result.Failure(MovementErrors.NotEditable);
        }

        Status = MovementStatus.Canceled;
        LastComment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        return Result.Success();
    }

    private void Apply(MovementDetails d)
    {
        EffectiveOn = d.EffectiveOn;
        ExpectedReturnOn = d.ExpectedReturnOn;
        VacationKind = d.VacationKind;
        ReturnTo = d.ReturnTo;
        ProjectId = d.Work?.ProjectId;
        ProjectCrmId = d.Work?.ProjectCrmId;
        ProjectName = d.Work?.ProjectName;
        PackageId = d.Work?.PackageId;
        PackageNo = d.Work?.PackageNo;
        Salary = d.Work?.Salary ?? 0;
        ServiceFee = d.Work?.ServiceFee ?? 0;
        Housing = d.Work?.Housing ?? 0;
        HousingBillable = d.Work?.HousingBillable ?? false;
        Transport = d.Work?.Transport ?? 0;
        TransportBillable = d.Work?.TransportBillable ?? false;
        IsSpecialPrice = d.Work?.IsSpecialPrice ?? false;
        SpecialReason = d.Work?.SpecialReason;
        PaySalary = d.PaySalary;
        SuspensionReason = d.SuspensionReason;
        ExitKind = d.ExitKind;
        Place = Clean(d.Place, 200);
        DelayReason = Clean(d.DelayReason, 500);
        Notes = Clean(d.Notes, 1000);
    }

    private static string? Clean(string? value, int max) => string.IsNullOrWhiteSpace(value) ? null : value.Trim()[..Math.Min(value.Trim().Length, max)];
}

public static class MovementErrors
{
    public static readonly Error NotFound = Error.NotFound("movement", "Movement not found.");
    public static readonly Error NotEditable = Error.Conflict("movement_not_editable", "Only a returned movement can be changed or canceled.");
    public static readonly Error NotAmendable = Error.Conflict("movement_not_amendable", "Only an executed movement can be changed or cancelled after its approval.");
    public static readonly Error AmendReason = Error.Validation("movement_amend_reason", "Give the reason (500 characters at most).");
    public static readonly Error LaterPeriod = Error.Conflict("movement_later_period", "The worker has an action after this one: cancel it first.");
    public static readonly Error PeriodOverlap = Error.Conflict("movement_period_overlap", "The new date overlaps another period of the worker.");
    public static readonly Error TypeForbidden = new("forbidden.movement_type", "You do not have this permission for this type of action.");
    public static readonly Error Type = Error.Validation("movement_type", "Choose the movement.");
    public static readonly Error Worker = Error.Validation("movement_worker", "Choose the worker.");
    public static readonly Error NotAllowed = Error.Validation("movement_not_allowed", "This movement is not possible from where the worker is now.");
    public static readonly Error Busy = Error.Conflict("movement_worker_busy", "The worker already has an open movement or order.");
    public static readonly Error DelayReason = Error.Validation("movement_delay_reason", "The date is more than two days ago: write the reason for the delay.");
    public static readonly Error ExpectedReturn = Error.Validation("movement_expected_return", "The expected return must be after the departure.");
    public static readonly Error ReturnTo = Error.Validation("movement_return_to", "Choose where the worker returns.");
    public static readonly Error NoPreviousProject = Error.Validation("movement_no_previous_project", "The worker's previous project is not known: choose the project.");
    public static readonly Error Project = Error.Validation("movement_project", "Choose an active project.");
    public static readonly Error NoPrice = Error.Validation("movement_no_price", "The worker has no package on the project for their profession and nationality: enter a special price with a reason.");
    public static readonly Error SpecialReason = Error.Validation("movement_special_reason", "A special price needs a reason.");
    public static readonly Error Minimum = Error.Validation("movement_price_minimum", "The service price cannot be less than 1,000.");
    public static readonly Error BelowCost = Error.Validation("movement_price_below_cost", "The service price is less than the salary, housing and transport.");
    public static readonly Error Reason = Error.Validation("movement_reason", "Choose the reason.");
    public static readonly Error ClientVacationNotWorking = Error.Validation("movement_client_vacation", "A vacation on the customer is for a worker on the job.");
}
