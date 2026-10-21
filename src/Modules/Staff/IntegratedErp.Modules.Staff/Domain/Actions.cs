using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Staff.Domain;

public enum ContractKind
{
    /// <summary>Fixed term: has an end.</summary>
    Fixed,

    /// <summary>Open-ended.</summary>
    Open,
}

public enum ContractStatus
{
    Active,

    /// <summary>Replaced by a renewal.</summary>
    Renewed,

    /// <summary>Ended (not renewed, or the employment ended).</summary>
    Ended,
}

/// <summary>
/// An employment contract (docs/02-target-architecture/08 §4): its kind, dates, probation and notice periods. A renewal
/// is a new contract linked to the one it renews; the employee's file shows the active one.
/// </summary>
public sealed class StaffContract : ITenantOwned
{
    private StaffContract()
    {
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid EmployeeId { get; private set; }

    public ContractKind Kind { get; private set; }

    public DateOnly StartsOn { get; private set; }

    public int? Months { get; private set; }

    public DateOnly? EndsOn { get; private set; }

    public int ProbationDays { get; private set; }

    public int NoticeDays { get; private set; }

    public ContractStatus Status { get; private set; }

    /// <summary>The contract this one renews.</summary>
    public Guid? RenewsId { get; private set; }

    /// <summary>The action that made it (a renewal), or none (the first contract, or the old system's).</summary>
    public Guid? ActionId { get; private set; }

    public string? Notes { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public string CreatedByName { get; private set; }

    public static Result<StaffContract> Create(Guid employeeId, ContractKind kind, DateOnly startsOn, int? months, DateOnly? endsOn, int probationDays, int noticeDays, Guid? renewsId, Guid? actionId, string? notes, string by, DateTimeOffset at)
    {
        if (months is < 1 or > 600 || probationDays is < 0 or > 180 || noticeDays is < 0 or > 365)
        {
            return Result.Failure<StaffContract>(StaffErrors.Contract);
        }

        var end = kind == ContractKind.Open ? null : endsOn ?? (months is { } m ? startsOn.AddMonths(m).AddDays(-1) : null);
        if (kind == ContractKind.Fixed && end is null || end < startsOn)
        {
            return Result.Failure<StaffContract>(StaffErrors.Contract);
        }

        return Result.Success(new StaffContract
        {
            Id = Guid.CreateVersion7(),
            EmployeeId = employeeId,
            Kind = kind,
            StartsOn = startsOn,
            Months = kind == ContractKind.Open ? null : months,
            EndsOn = end,
            ProbationDays = probationDays,
            NoticeDays = noticeDays,
            Status = ContractStatus.Active,
            RenewsId = renewsId,
            ActionId = actionId,
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            CreatedAt = at,
            CreatedByName = by,
        });
    }

    /// <summary>A correction of the active contract's terms (HR, from the file).</summary>
    public Result Correct(ContractKind kind, DateOnly startsOn, int? months, DateOnly? endsOn)
    {
        var check = Create(EmployeeId, kind, startsOn, months, endsOn, ProbationDays, NoticeDays, null, null, null, CreatedByName, CreatedAt);
        if (check.IsFailure)
        {
            return Result.Failure(check.Error);
        }

        Kind = kind;
        StartsOn = startsOn;
        Months = check.Value.Months;
        EndsOn = check.Value.EndsOn;
        return Result.Success();
    }

    public void Renewed() => Status = ContractStatus.Renewed;

    /// <summary>The action that renewed or ended it was taken back.</summary>
    public void Reactivate() => Status = ContractStatus.Active;

    public void End() => Status = ContractStatus.Ended;
}

/// <summary>What an action changes (docs/02-target-architecture/08 §4–5).</summary>
public enum StaffActionKind
{
    /// <summary>A new position (and grade), maybe with a salary.</summary>
    Promotion,

    /// <summary>Another department, position or registration.</summary>
    Transfer,

    SalaryChange,

    /// <summary>Acting in another position for a time, with an allowance.</summary>
    Acting,

    ConfirmProbation,
    ExtendProbation,

    /// <summary>End of employment during probation.</summary>
    EndProbation,

    RenewContract,

    /// <summary>The contract is not renewed: the employment ends at its end.</summary>
    NotRenew,
}

public enum StaffActionStatus
{
    Draft,
    InApproval,
    Returned,
    Rejected,

    /// <summary>Approved and applied to the employee's file.</summary>
    Applied,

    /// <summary>Cancelled after it was applied: the file is back as it was before it.</summary>
    Cancelled,
}

/// <summary>
/// An employment action: a request on an employee, through the company's approval process; approved, it is applied
/// to the file (job, salary from the effective date, probation, contract). The file's values before it are kept on
/// the action, so it shows what changed.
/// </summary>
public sealed class StaffAction : ITenantOwned
{
    private StaffAction()
    {
        ActionNo = string.Empty;
        Reason = string.Empty;
        CreatedByName = string.Empty;
        EmployeeName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string ActionNo { get; private set; }

    public Guid EmployeeId { get; private set; }

    public string EmployeeName { get; private set; }

    public StaffActionKind Kind { get; private set; }

    public DateOnly EffectiveFrom { get; private set; }

    public string Reason { get; private set; }

    public StaffActionStatus Status { get; private set; }

    public bool AwaitingApproval { get; private set; }

    // ---- the request
    public Guid? NewLegalEntityId { get; private set; }

    public Guid? NewDepartmentId { get; private set; }

    public Guid? NewPositionId { get; private set; }

    public SalaryValues? NewSalary { get; private set; }

    public decimal? ActingAllowance { get; private set; }

    public DateOnly? ActingUntil { get; private set; }

    public DateOnly? NewProbationEndsOn { get; private set; }

    public ContractKind? NewContractKind { get; private set; }

    public int? NewContractMonths { get; private set; }

    public DateOnly? NewContractEndsOn { get; private set; }

    // ---- the file before (shown as «before → after»)
    public Guid? OldLegalEntityId { get; private set; }

    public Guid? OldDepartmentId { get; private set; }

    public Guid? OldPositionId { get; private set; }

    public decimal? OldSalaryTotal { get; private set; }

    public DateOnly? OldProbationEndsOn { get; private set; }

    public DateOnly? OldContractEndsOn { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset? SubmittedAt { get; private set; }

    public DateTimeOffset? AppliedAt { get; private set; }

    public string? LastComment { get; private set; }

    /// <summary>The file before it was applied (JSON of <see cref="EmployeeSnapshot"/> and the contracts it touched), to take it back.</summary>
    public string? PriorFile { get; private set; }

    /// <summary>The last change after the approval: when, by whom and why (each change is in the audit log too).</summary>
    public DateTimeOffset? AmendedAt { get; private set; }

    public string? AmendedByName { get; private set; }

    public string? AmendNote { get; private set; }

    public DateTimeOffset? CanceledAt { get; private set; }

    public string? CanceledByName { get; private set; }

    /// <summary>Applied with the file before it kept: it can be taken back (changed or cancelled after its approval).</summary>
    public bool IsAmendable => Status == StaffActionStatus.Applied && PriorFile is not null;

    public void KeepPrior(string priorFile) => PriorFile = priorFile;

    /// <summary>
    /// Changed after its approval (taken back first, applied again after): the effective day and the values of its kind
    /// — the salary, the acting's end and allowance, the probation's new end, the renewal's months or end.
    /// </summary>
    public Result Amend(DateOnly effectiveFrom, SalaryValues? newSalary, decimal? actingAllowance, DateOnly? actingUntil, DateOnly? newProbationEndsOn, int? newContractMonths, DateOnly? newContractEndsOn, string reason, string by, DateTimeOffset at)
    {
        if (!IsAmendable)
        {
            return Result.Failure(StaffErrors.ActionNotAmendable);
        }

        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500)
        {
            return Result.Failure(StaffErrors.ActionAmendReason);
        }

        var valid = Kind switch
        {
            StaffActionKind.SalaryChange => newSalary is not null,
            StaffActionKind.Acting => actingUntil is { } until && until >= effectiveFrom && actingAllowance is >= 0,
            StaffActionKind.ExtendProbation => newProbationEndsOn is { } e && e > (OldProbationEndsOn ?? effectiveFrom),
            StaffActionKind.RenewContract => NewContractKind == ContractKind.Open || newContractMonths is > 0 || newContractEndsOn is not null,
            _ => true,
        };
        if (!valid)
        {
            return Result.Failure(StaffErrors.ActionFields);
        }

        EffectiveFrom = effectiveFrom;
        if (Kind is StaffActionKind.SalaryChange || (NewSalary is not null && newSalary is not null))
        {
            NewSalary = newSalary;
        }

        if (Kind == StaffActionKind.Acting)
        {
            (ActingAllowance, ActingUntil) = (actingAllowance, actingUntil);
        }

        if (Kind == StaffActionKind.ExtendProbation)
        {
            NewProbationEndsOn = newProbationEndsOn;
        }

        if (Kind == StaffActionKind.RenewContract)
        {
            (NewContractMonths, NewContractEndsOn) = (newContractMonths, newContractEndsOn);
        }

        AmendedAt = at;
        AmendedByName = by;
        AmendNote = reason.Trim();
        return Result.Success();
    }

    /// <summary>Cancelled after it was applied (the file was put back as it was before it).</summary>
    public Result CancelApproved(string reason, string by, DateTimeOffset at)
    {
        if (!IsAmendable)
        {
            return Result.Failure(StaffErrors.ActionNotAmendable);
        }

        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500)
        {
            return Result.Failure(StaffErrors.ActionAmendReason);
        }

        Status = StaffActionStatus.Cancelled;
        LastComment = reason.Trim();
        CanceledAt = at;
        CanceledByName = by;
        return Result.Success();
    }

    public bool IsEditable => Status is StaffActionStatus.Draft or StaffActionStatus.Returned && !AwaitingApproval;

    public bool IsInApproval => AwaitingApproval && Status == StaffActionStatus.InApproval;

    public static Result<StaffAction> Create(string number, StaffEmployee employee, decimal? salaryTotal, StaffActionRequest r, string by, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(employee);
        ArgumentNullException.ThrowIfNull(r);
        if (string.IsNullOrWhiteSpace(r.Reason) || r.Reason.Trim().Length > 1000)
        {
            return Result.Failure<StaffAction>(StaffErrors.Reason);
        }

        var valid = r.Kind switch
        {
            StaffActionKind.Promotion => r.NewPositionId is not null,
            StaffActionKind.Transfer => r.NewDepartmentId is not null || r.NewLegalEntityId is not null || r.NewPositionId is not null,
            StaffActionKind.SalaryChange => r.NewSalary is not null,
            StaffActionKind.Acting => r.NewPositionId is not null && r.ActingUntil is { } until && until >= r.EffectiveFrom && r.ActingAllowance is >= 0,
            StaffActionKind.ConfirmProbation or StaffActionKind.EndProbation => employee.Status == StaffStatus.Probation,
            StaffActionKind.ExtendProbation => employee.Status == StaffStatus.Probation && r.NewProbationEndsOn is { } e && e > (employee.ProbationEndsOn ?? r.EffectiveFrom),
            StaffActionKind.RenewContract => r.NewContractKind is not null && (r.NewContractKind == ContractKind.Open || r.NewContractMonths is > 0 || r.NewContractEndsOn is not null),
            StaffActionKind.NotRenew => employee.ContractEndsOn is not null,
            _ => false,
        };
        if (!valid)
        {
            return Result.Failure<StaffAction>(StaffErrors.ActionFields);
        }

        return Result.Success(new StaffAction
        {
            Id = Guid.CreateVersion7(),
            ActionNo = number,
            EmployeeId = employee.Id,
            EmployeeName = employee.DisplayName,
            Kind = r.Kind,
            EffectiveFrom = r.EffectiveFrom,
            Reason = r.Reason.Trim(),
            Status = StaffActionStatus.Draft,
            NewLegalEntityId = r.NewLegalEntityId,
            NewDepartmentId = r.NewDepartmentId,
            NewPositionId = r.NewPositionId,
            NewSalary = r.NewSalary,
            ActingAllowance = r.ActingAllowance,
            ActingUntil = r.ActingUntil,
            NewProbationEndsOn = r.NewProbationEndsOn,
            NewContractKind = r.NewContractKind,
            NewContractMonths = r.NewContractMonths,
            NewContractEndsOn = r.NewContractEndsOn,
            OldLegalEntityId = employee.LegalEntityId,
            OldDepartmentId = employee.DepartmentId,
            OldPositionId = employee.PositionId,
            OldSalaryTotal = salaryTotal,
            OldProbationEndsOn = employee.ProbationEndsOn,
            OldContractEndsOn = employee.ContractEndsOn,
            CreatedAt = at,
            CreatedByName = by,
        });
    }

    public Result MarkSubmitted(DateTimeOffset at)
    {
        if (!IsEditable)
        {
            return Result.Failure(StaffErrors.ActionNotEditable);
        }

        Status = StaffActionStatus.InApproval;
        AwaitingApproval = true;
        SubmittedAt = at;
        return Result.Success();
    }

    public void SubmissionFailed()
    {
        Status = StaffActionStatus.Draft;
        AwaitingApproval = false;
    }

    public void Applied(string? comment, DateTimeOffset at)
    {
        Status = StaffActionStatus.Applied;
        AwaitingApproval = false;
        AppliedAt = at;
        LastComment = comment;
    }

    public void Ended(bool rejected, string? comment)
    {
        Status = rejected ? StaffActionStatus.Rejected : StaffActionStatus.Returned;
        AwaitingApproval = false;
        LastComment = comment;
    }
}

public sealed record StaffActionRequest(
    StaffActionKind Kind,
    DateOnly EffectiveFrom,
    string Reason,
    Guid? NewLegalEntityId = null,
    Guid? NewDepartmentId = null,
    Guid? NewPositionId = null,
    SalaryValues? NewSalary = null,
    decimal? ActingAllowance = null,
    DateOnly? ActingUntil = null,
    DateOnly? NewProbationEndsOn = null,
    ContractKind? NewContractKind = null,
    int? NewContractMonths = null,
    DateOnly? NewContractEndsOn = null);
