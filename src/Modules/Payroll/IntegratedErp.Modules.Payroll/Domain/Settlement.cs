using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Payroll.Domain;

/// <summary>What a settlement pays (docs/03-migration-plan/18): an annual leave in advance, or the end of the service.</summary>
public enum SettlementKind
{
    Vacation,
    EndOfService,
}

/// <summary>Who is settled: an employee of the company's staff, or a worker on the company's sponsorship (4.11ب).</summary>
public enum SettlementParty
{
    Staff,
    Worker,
}

/// <summary>Why the service ends: it sets the end-of-service award (labour law, articles 77, 80, 84, 85 and 87).</summary>
public enum EndReason
{
    /// <summary>The contract ended or was not renewed: the full award.</summary>
    ContractEnd,

    /// <summary>The employer ended it without a lawful reason: the full award and article 77's compensation.</summary>
    EmployerTermination,

    /// <summary>The employee resigned: article 85's share of the award.</summary>
    Resignation,

    /// <summary>Left for force majeure, or a woman within six months of marrying or three of giving birth: the full award (article 87).</summary>
    ForceMajeure,

    /// <summary>Death or disability: the full award.</summary>
    Death,

    /// <summary>Ended in the probation (article 54): no award.</summary>
    Probation,

    /// <summary>Dismissed under article 80: no award.</summary>
    Article80,
}

/// <summary>The contract's term, for article 77's compensation.</summary>
public enum ContractTerm
{
    Indefinite,
    Fixed,
}

public enum SettlementStatus
{
    Draft,
    InApproval,

    /// <summary>Sent back (or rejected) by an approver: changed and sent again.</summary>
    Returned,

    /// <summary>Approved: locked; the payroll does not pay its days again.</summary>
    Approved,

    /// <summary>Approved and paid by finance.</summary>
    Paid,

    Cancelled,
}

public enum SettlementSide
{
    Addition,
    Deduction,
}

/// <summary>
/// A final or vacation settlement (docs/03-migration-plan/18): the pay not covered by a payroll run, the leave pay, the
/// end-of-service award and article 77's compensation, less the advances, penalties and deductions due, with the manual
/// additions, custody and other deductions entered before it is sent. Every figure is calculated on the server and kept
/// with it; approved, its days are not paid again by the payroll, and finance records the payment.
/// </summary>
public sealed class Settlement : ITenantOwned
{
    private readonly List<SettlementLine> _lines = [];

    private Settlement()
    {
        SettlementNo = string.Empty;
        PersonNo = string.Empty;
        Name = string.Empty;
        CreatedByName = string.Empty;
        Period = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string SettlementNo { get; private set; }

    public SettlementKind Kind { get; private set; }

    public SettlementParty Party { get; private set; }

    /// <summary>The employee's (or worker's) id.</summary>
    public Guid PersonId { get; private set; }

    public string PersonNo { get; private set; }

    public string Name { get; private set; }

    public Guid? LegalEntityId { get; private set; }

    public string? DepartmentAr { get; private set; }

    public string? DepartmentEn { get; private set; }

    public string? JobTitleAr { get; private set; }

    public string? JobTitleEn { get; private set; }

    public EndReason? Reason { get; private set; }

    public ContractTerm Term { get; private set; }

    public DateOnly? ContractEndsOn { get; private set; }

    public Guid? LeaveRequestId { get; private set; }

    public string? LeaveRequestNo { get; private set; }

    public DateOnly? LeaveFrom { get; private set; }

    public DateOnly? LeaveTo { get; private set; }

    public DateOnly HireDate { get; private set; }

    /// <summary>The last day of the service (end of service), or the day before the leave (vacation).</summary>
    public DateOnly LastDay { get; private set; }

    /// <summary>The payroll month whose deductions it takes ("2026-11").</summary>
    public string Period { get; private set; }

    /// <summary>The monthly wage it is calculated on: the total salary with its allowances (the user's decision).</summary>
    public decimal Wage { get; private set; }

    public DateOnly? UnpaidFrom { get; private set; }

    public decimal UnpaidDays { get; private set; }

    public decimal ServiceDays { get; private set; }

    /// <summary>Unpaid leave days not counted in the service (beyond 20 a year, article 116).</summary>
    public decimal ExcludedDays { get; private set; }

    public decimal ServiceYears { get; private set; }

    /// <summary>The leave days paid: the leave's (vacation) or the unused balance (end of service).</summary>
    public decimal LeaveDays { get; private set; }

    public decimal AwardFull { get; private set; }

    public decimal AwardFactor { get; private set; }

    /// <summary>Takes the rest of the advances at once (always at the end of the service; the user's choice on a vacation).</summary>
    public bool DeductFullAdvance { get; private set; }

    public decimal OtherAdditions { get; private set; }

    public decimal Custody { get; private set; }

    public decimal OtherDeductions { get; private set; }

    public string? Notes { get; private set; }

    public decimal TotalAdditions { get; private set; }

    public decimal TotalDeductions { get; private set; }

    public decimal Net { get; private set; }

    public SettlementStatus Status { get; private set; }

    public bool AwaitingApproval { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CalculatedAt { get; private set; }

    public DateTimeOffset? SubmittedAt { get; private set; }

    public DateTimeOffset? ApprovedAt { get; private set; }

    public string? ApprovedByName { get; private set; }

    public string? LastComment { get; private set; }

    public DateOnly? PaidOn { get; private set; }

    public string? PaymentMethod { get; private set; }

    public string? PaymentReference { get; private set; }

    public string? PaidByName { get; private set; }

    public IReadOnlyList<SettlementLine> Lines => _lines;

    public bool IsEditable => Status is SettlementStatus.Draft or SettlementStatus.Returned && !AwaitingApproval;

    public bool IsInApproval => AwaitingApproval && Status == SettlementStatus.InApproval;

    /// <summary>Its days are paid (approved or paid): the payroll leaves them out.</summary>
    public bool IsFinal => Status is SettlementStatus.Approved or SettlementStatus.Paid;

    public static Settlement Create(string number, SettlementKind kind, SettlementParty party, SettlementPerson person, string by, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(person);
        return new Settlement
        {
            Id = Guid.CreateVersion7(),
            SettlementNo = number,
            Kind = kind,
            Party = party,
            PersonId = person.Id,
            PersonNo = person.No,
            Name = person.Name,
            LegalEntityId = person.LegalEntityId,
            DepartmentAr = person.DepartmentAr,
            DepartmentEn = person.DepartmentEn,
            JobTitleAr = person.JobTitleAr,
            JobTitleEn = person.JobTitleEn,
            HireDate = person.HireDate,
            Status = SettlementStatus.Draft,
            CreatedAt = at,
            CreatedByName = by,
            CalculatedAt = at,
            DeductFullAdvance = kind == SettlementKind.EndOfService,
        };
    }

    /// <summary>The end of the service: why and when, and the contract's term for article 77.</summary>
    public Result SetEnd(EndReason reason, DateOnly lastDay, ContractTerm term, DateOnly? contractEndsOn)
    {
        if (!IsEditable)
        {
            return Result.Failure(SettlementErrors.NotEditable);
        }

        if (Kind != SettlementKind.EndOfService || lastDay < HireDate || (term == ContractTerm.Fixed && contractEndsOn is null))
        {
            return Result.Failure(SettlementErrors.End);
        }

        Reason = reason;
        LastDay = lastDay;
        Term = term;
        ContractEndsOn = term == ContractTerm.Fixed ? contractEndsOn : null;
        return Result.Success();
    }

    /// <summary>The annual leave it pays in advance: the day before it is the last day of pay it covers.</summary>
    public Result SetLeave(Guid requestId, string requestNo, DateOnly from, DateOnly to)
    {
        if (!IsEditable)
        {
            return Result.Failure(SettlementErrors.NotEditable);
        }

        if (Kind != SettlementKind.Vacation || to < from)
        {
            return Result.Failure(SettlementErrors.Leave);
        }

        LeaveRequestId = requestId;
        LeaveRequestNo = requestNo;
        LeaveFrom = from;
        LeaveTo = to;
        LastDay = from.AddDays(-1);
        return Result.Success();
    }

    /// <summary>What the user enters before sending it (each change is audited).</summary>
    public Result SetManual(decimal otherAdditions, decimal custody, decimal otherDeductions, bool deductFullAdvance, string? notes)
    {
        if (!IsEditable)
        {
            return Result.Failure(SettlementErrors.NotEditable);
        }

        if (otherAdditions < 0 || custody < 0 || otherDeductions < 0 || notes?.Length > 2000)
        {
            return Result.Failure(SettlementErrors.Manual);
        }

        OtherAdditions = decimal.Round(otherAdditions, 2);
        Custody = decimal.Round(custody, 2);
        OtherDeductions = decimal.Round(otherDeductions, 2);
        DeductFullAdvance = Kind == SettlementKind.EndOfService || deductFullAdvance;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        return Result.Success();
    }

    public Result Calculate(SettlementFacts facts, SettlementResult result, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(facts);
        ArgumentNullException.ThrowIfNull(result);
        if (!IsEditable)
        {
            return Result.Failure(SettlementErrors.NotEditable);
        }

        Period = facts.Period;
        Wage = facts.Wage;
        UnpaidFrom = facts.UnpaidFrom;
        ExcludedDays = facts.ExcludedDays;
        LeaveDays = facts.LeaveDays;
        UnpaidDays = result.UnpaidDays;
        ServiceDays = result.ServiceDays;
        ServiceYears = result.ServiceYears;
        AwardFull = result.AwardFull;
        AwardFactor = result.AwardFactor;
        TotalAdditions = result.TotalAdditions;
        TotalDeductions = result.TotalDeductions;
        Net = result.Net;
        _lines.Clear();
        _lines.AddRange(result.Lines.Select((l, i) => new SettlementLine(Id, i + 1, l)));
        CalculatedAt = at;
        return Result.Success();
    }

    public Result MarkSubmitted(DateTimeOffset at)
    {
        if (!IsEditable)
        {
            return Result.Failure(SettlementErrors.NotEditable);
        }

        if (Wage <= 0 || (Kind == SettlementKind.EndOfService && Reason is null) || (Kind == SettlementKind.Vacation && LeaveRequestId is null))
        {
            return Result.Failure(SettlementErrors.Incomplete);
        }

        Status = SettlementStatus.InApproval;
        AwaitingApproval = true;
        SubmittedAt = at;
        return Result.Success();
    }

    public void SubmissionFailed()
    {
        Status = SubmittedAt is null ? SettlementStatus.Draft : SettlementStatus.Returned;
        AwaitingApproval = false;
    }

    public void Approve(string by, string? comment, DateTimeOffset at)
    {
        Status = SettlementStatus.Approved;
        AwaitingApproval = false;
        ApprovedAt = at;
        ApprovedByName = by;
        LastComment = comment;
    }

    public void ApprovalEnded(string? comment)
    {
        Status = SettlementStatus.Returned;
        AwaitingApproval = false;
        LastComment = comment;
    }

    public Result Pay(DateOnly paidOn, string method, string? reference, string by)
    {
        if (Status != SettlementStatus.Approved)
        {
            return Result.Failure(SettlementErrors.NotPayable);
        }

        if (string.IsNullOrWhiteSpace(method) || method.Trim().Length > 30 || reference?.Trim().Length > 100)
        {
            return Result.Failure(SettlementErrors.Payment);
        }

        Status = SettlementStatus.Paid;
        PaidOn = paidOn;
        PaymentMethod = method.Trim();
        PaymentReference = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim();
        PaidByName = by;
        return Result.Success();
    }

    public Result Cancel(string? comment)
    {
        if (!IsEditable)
        {
            return Result.Failure(SettlementErrors.NotEditable);
        }

        Status = SettlementStatus.Cancelled;
        LastComment = comment;
        return Result.Success();
    }
}

/// <summary>Who a settlement is for, as their file says when it is made.</summary>
public sealed record SettlementPerson(
    Guid Id, string No, string Name, Guid? LegalEntityId, string? DepartmentAr, string? DepartmentEn, string? JobTitleAr, string? JobTitleEn, DateOnly HireDate);

/// <summary>What a settlement is calculated from, besides its own dates and entries.</summary>
public sealed record SettlementFacts(string Period, decimal Wage, DateOnly? UnpaidFrom, decimal ExcludedDays, decimal LeaveDays);

/// <param name="Code">
/// unpaid_salary, leave_allowance, leave_balance, end_of_service, article_77, other_addition; installment, penalty_days,
/// penalty_amount, suspension, other_due, custody, other_deduction.
/// </param>
/// <param name="Days">The days it counts (pay, leave, service or penalty days).</param>
/// <param name="Rate">Its rate: a day's wage, or the award's share (0, ⅓, ⅔, 1).</param>
public sealed record SettlementLineValues(
    SettlementSide Side, string Code, decimal Days, decimal Rate, decimal Amount, Guid? SourceId = null, DeductionItemKind? SourceKind = null, string? Reference = null, string? SourcePeriod = null);

public sealed record SettlementResult(
    decimal UnpaidDays, decimal ServiceDays, decimal ServiceYears, decimal AwardFull, decimal AwardFactor,
    IReadOnlyList<SettlementLineValues> Lines, decimal TotalAdditions, decimal TotalDeductions, decimal Net);

/// <summary>A line of a settlement: what it adds or deducts, and from what (an installment or penalty, by its id).</summary>
public sealed class SettlementLine : ITenantOwned
{
    private SettlementLine()
    {
        Code = string.Empty;
    }

    internal SettlementLine(Guid settlementId, int lineNo, SettlementLineValues v)
        : this()
    {
        Id = Guid.CreateVersion7();
        SettlementId = settlementId;
        LineNo = lineNo;
        Side = v.Side;
        Code = v.Code;
        Days = v.Days;
        Rate = v.Rate;
        Amount = v.Amount;
        SourceId = v.SourceId;
        SourceKind = v.SourceKind;
        Reference = v.Reference;
        SourcePeriod = v.SourcePeriod;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid SettlementId { get; private set; }

    public int LineNo { get; private set; }

    public SettlementSide Side { get; private set; }

    public string Code { get; private set; }

    public decimal Days { get; private set; }

    public decimal Rate { get; private set; }

    public decimal Amount { get; private set; }

    public Guid? SourceId { get; private set; }

    public DeductionItemKind? SourceKind { get; private set; }

    public string? Reference { get; private set; }

    public string? SourcePeriod { get; private set; }
}

public static class SettlementErrors
{
    public static readonly Error NotFound = Error.NotFound("settlement", "Settlement not found.");
    public static readonly Error NotEditable = Error.Conflict("settlement_not_editable", "Only a draft or returned settlement can be changed.");
    public static readonly Error End = Error.Validation("settlement_end", "Choose the reason and the last day (on or after the joining date); a fixed-term contract needs its end.");
    public static readonly Error Leave = Error.Validation("settlement_leave", "Choose an approved annual leave of the employee.");
    public static readonly Error Manual = Error.Validation("settlement_manual", "The amounts are zero or more; the notes 2,000 characters at most.");
    public static readonly Error Incomplete = Error.Validation("settlement_incomplete", "The settlement needs the salary, and the reason or the leave, before it is sent.");
    public static readonly Error NotPayable = Error.Conflict("settlement_not_payable", "Only an approved settlement is paid.");
    public static readonly Error Payment = Error.Validation("settlement_payment", "Enter the payment method (and its reference, 100 characters at most).");
    public static readonly Error Employee = Error.Validation("settlement_employee", "The employee has no joining date or no salary on the file.");
    public static readonly Error Exists = Error.Conflict("settlement_exists", "The employee already has an open settlement of this kind (or this leave has one).");
}
