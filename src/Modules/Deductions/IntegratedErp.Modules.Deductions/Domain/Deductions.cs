using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Deductions.Domain;

// Salary advances, penalties and other deductions of the company's staff (docs/03-migration-plan/10): every rule a
// setting, every decision through approval, and each month's due amounts handed to the staff payroll, which applies the
// monthly cap (half the wage by default) and defers the rest — unless an approved request allowed going above it.

/// <summary>The company's rules for advances and penalties.</summary>
public sealed class DeductionSetting : ITenantOwned
{
    private DeductionSetting()
    {
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>The most an advance can be, as a percentage of the monthly salary.</summary>
    public decimal AdvanceCapPercent { get; private set; } = 50;

    /// <summary>The most months an advance can be deducted over (chosen in the request).</summary>
    public int AdvanceMaxMonths { get; private set; } = 3;

    public bool AdvanceAfterProbation { get; private set; } = true;

    public int AdvanceMinServiceMonths { get; private set; }

    /// <summary>No new advance while one is not settled.</summary>
    public bool AdvanceOneOpen { get; private set; } = true;

    public decimal PenaltyMaxDaysPerViolation { get; private set; } = 5;

    public decimal PenaltyMaxDaysPerMonth { get; private set; } = 5;

    public decimal SuspensionMaxDaysPerMonth { get; private set; } = 5;

    /// <summary>The month's deductions cap, as a percentage of the wage (labour law art. 92: half).</summary>
    public decimal MonthlyCapPercent { get; private set; } = 50;

    public static DeductionSetting Default() => new() { Id = Guid.CreateVersion7() };

    public Result Set(decimal capPercent, int maxMonths, bool afterProbation, int minServiceMonths, bool oneOpen, decimal perViolation, decimal perMonth, decimal suspension, decimal monthlyCap)
    {
        if (capPercent is <= 0 or > 1000 || maxMonths is < 1 or > 24 || minServiceMonths is < 0 or > 120 || perViolation is < 0 or > 31 || perMonth is < 0 or > 31
            || suspension is < 0 or > 31 || monthlyCap is <= 0 or > 100)
        {
            return Result.Failure(DeductionErrors.Setting);
        }

        AdvanceCapPercent = capPercent;
        AdvanceMaxMonths = maxMonths;
        AdvanceAfterProbation = afterProbation;
        AdvanceMinServiceMonths = minServiceMonths;
        AdvanceOneOpen = oneOpen;
        PenaltyMaxDaysPerViolation = perViolation;
        PenaltyMaxDaysPerMonth = perMonth;
        SuspensionMaxDaysPerMonth = suspension;
        MonthlyCapPercent = monthlyCap;
        return Result.Success();
    }
}

/// <summary>What a penalty does.</summary>
public enum PenaltyEffect
{
    /// <summary>A warning kept in the file: nothing deducted.</summary>
    Warning,

    /// <summary>Days of wage deducted.</summary>
    DeductDays,

    /// <summary>An amount deducted.</summary>
    DeductAmount,

    /// <summary>Days of suspension without pay.</summary>
    Suspension,
}

/// <summary>A penalty of the company's policy (the four of the labour law first; HR adds others with their effect).</summary>
public sealed class PenaltyType : ITenantOwned
{
    private PenaltyType()
    {
        Code = string.Empty;
        NameAr = string.Empty;
        NameEn = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string Code { get; private set; }

    public string NameAr { get; private set; }

    public string NameEn { get; private set; }

    public PenaltyEffect Effect { get; private set; }

    public bool IsActive { get; private set; } = true;

    public int SortOrder { get; private set; }

    public static Result<PenaltyType> Create(string code, string nameAr, string? nameEn, PenaltyEffect effect, int sortOrder)
    {
        var type = new PenaltyType { Id = Guid.CreateVersion7(), Code = code };
        var set = type.Set(nameAr, nameEn, effect, true, sortOrder);
        return set.IsFailure ? Result.Failure<PenaltyType>(set.Error) : Result.Success(type);
    }

    public Result Set(string nameAr, string? nameEn, PenaltyEffect effect, bool isActive, int sortOrder)
    {
        if (string.IsNullOrWhiteSpace(nameAr) || nameAr.Trim().Length > 100 || (nameEn?.Trim().Length ?? 0) > 100)
        {
            return Result.Failure(DeductionErrors.Name);
        }

        NameAr = nameAr.Trim();
        NameEn = string.IsNullOrWhiteSpace(nameEn) ? NameAr : nameEn.Trim();
        Effect = effect;
        IsActive = isActive;
        SortOrder = sortOrder;
        return Result.Success();
    }
}

public enum AdvanceStatus
{
    InApproval,
    Returned,
    Rejected,

    /// <summary>Approved, waiting for finance to pay it.</summary>
    Approved,

    /// <summary>Paid: its installments are deducted by the payroll.</summary>
    Disbursed,

    Settled,
}

/// <summary>A salary advance: requested, approved, paid by finance, then deducted over the months chosen.</summary>
public sealed class Advance : ITenantOwned
{
    private readonly List<AdvanceInstallment> installments = [];

    private Advance()
    {
        AdvanceNo = string.Empty;
        EmployeeName = string.Empty;
        Reason = string.Empty;
        FirstPeriod = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string AdvanceNo { get; private set; }

    public Guid EmployeeId { get; private set; }

    public string EmployeeName { get; private set; }

    public decimal Amount { get; private set; }

    public int Months { get; private set; }

    /// <summary>The first payroll month it is deducted in ("2026-11").</summary>
    public string FirstPeriod { get; private set; }

    public string Reason { get; private set; }

    /// <summary>The request asks to go above the advance cap or the month's deduction cap: the approvers decide.</summary>
    public bool AboveCap { get; private set; }

    public decimal? SalaryAtRequest { get; private set; }

    public Guid? ManagerUserId { get; private set; }

    public AdvanceStatus Status { get; private set; }

    public bool AwaitingApproval { get; private set; }

    public DateOnly? PaidOn { get; private set; }

    public string? PaidBy { get; private set; }

    public string? PaymentMethod { get; private set; }

    public string? PaymentReference { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? DecidedAt { get; private set; }

    public string? LastComment { get; private set; }

    public IReadOnlyList<AdvanceInstallment> Installments => installments;

    public decimal Remaining => installments.Where(i => i.Status is InstallmentStatus.Scheduled or InstallmentStatus.Deferred).Sum(i => i.Amount - i.Deducted);

    public static Advance Create(string number, Guid employeeId, string employeeName, string by, DateTimeOffset at) => new()
    {
        Id = Guid.CreateVersion7(),
        AdvanceNo = number,
        EmployeeId = employeeId,
        EmployeeName = employeeName.Length > 300 ? employeeName[..300] : employeeName,
        CreatedByName = by,
        CreatedAt = at,
    };

    public Result Set(decimal amount, int months, string firstPeriod, string reason, bool aboveCap, decimal? salary, Guid? managerUserId)
    {
        if (amount <= 0 || amount > 10_000_000 || months < 1 || string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500 || !Periods.Valid(firstPeriod))
        {
            return Result.Failure(DeductionErrors.AdvanceFields);
        }

        Amount = decimal.Round(amount, 2);
        Months = months;
        FirstPeriod = firstPeriod;
        Reason = reason.Trim();
        AboveCap = aboveCap;
        SalaryAtRequest = salary;
        ManagerUserId = managerUserId;
        Status = AdvanceStatus.InApproval;
        AwaitingApproval = true;
        return Result.Success();
    }

    public void Started() => AwaitingApproval = false;

    /// <summary>Approved: the schedule is made (equal installments, the cents on the last).</summary>
    public IReadOnlyList<AdvanceInstallment> Approve(string? comment, DateTimeOffset at)
    {
        Status = AdvanceStatus.Approved;
        AwaitingApproval = false;
        LastComment = comment;
        DecidedAt = at;
        installments.Clear();
        var each = decimal.Floor(Amount / Months * 100) / 100;
        for (var n = 0; n < Months; n++)
        {
            installments.Add(AdvanceInstallment.Of(Id, Periods.Add(FirstPeriod, n), n == Months - 1 ? Amount - (each * (Months - 1)) : each));
        }

        return installments;
    }

    public void Ended(AdvanceStatus status, string? comment, DateTimeOffset at)
    {
        Status = status;
        AwaitingApproval = false;
        LastComment = comment;
        DecidedAt = at;
    }

    public Result Disburse(DateOnly on, string method, string? reference, string by)
    {
        if (Status != AdvanceStatus.Approved || string.IsNullOrWhiteSpace(method) || method.Length > 50 || (reference?.Length ?? 0) > 100)
        {
            return Result.Failure(DeductionErrors.NotDisbursable);
        }

        PaidOn = on;
        PaymentMethod = method.Trim();
        PaymentReference = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim();
        PaidBy = by;
        Status = AdvanceStatus.Disbursed;
        return Result.Success();
    }

    /// <summary>Paid back at once: the installments still due are closed.</summary>
    public Result SettleEarly(string note)
    {
        if (Status != AdvanceStatus.Disbursed || string.IsNullOrWhiteSpace(note))
        {
            return Result.Failure(DeductionErrors.NotOpen);
        }

        foreach (var i in installments.Where(i => i.Status is InstallmentStatus.Scheduled or InstallmentStatus.Deferred))
        {
            i.Settle(note);
        }

        Status = AdvanceStatus.Settled;
        LastComment = note.Trim();
        return Result.Success();
    }

    /// <summary>An installment not yet deducted moves to the month after the last one.</summary>
    public Result<AdvanceInstallment> Postpone(Guid installmentId, string note)
    {
        var item = installments.FirstOrDefault(i => i.Id == installmentId);
        if (Status is not (AdvanceStatus.Approved or AdvanceStatus.Disbursed) || item is not { Status: InstallmentStatus.Scheduled, Deducted: 0 } || string.IsNullOrWhiteSpace(note))
        {
            return Result.Failure<AdvanceInstallment>(DeductionErrors.NotPostponable);
        }

        var last = installments.Max(i => i.Period)!;
        item.Postpone(note);
        var moved = AdvanceInstallment.Of(Id, Periods.Add(last, 1), item.Amount);
        installments.Add(moved);
        return Result.Success(moved);
    }

    public void CheckSettled()
    {
        if (Status == AdvanceStatus.Disbursed && Remaining <= 0)
        {
            Status = AdvanceStatus.Settled;
        }
    }
}

public enum InstallmentStatus
{
    Scheduled,

    /// <summary>Part or all of it waits for the next month (the month's cap).</summary>
    Deferred,

    Deducted,

    /// <summary>Moved to a later month (postponed).</summary>
    Postponed,

    /// <summary>Closed by an early settlement.</summary>
    Settled,
}

/// <summary>One month's deduction of an advance; the payroll records what it deducted.</summary>
public sealed class AdvanceInstallment : ITenantOwned
{
    private AdvanceInstallment()
    {
        Period = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid AdvanceId { get; private set; }

    public string Period { get; private set; }

    public decimal Amount { get; private set; }

    public decimal Deducted { get; private set; }

    public InstallmentStatus Status { get; private set; }

    public string? Note { get; private set; }

    public static AdvanceInstallment Of(Guid advanceId, string period, decimal amount) => new() { Id = Guid.CreateVersion7(), AdvanceId = advanceId, Period = period, Amount = amount };

    public void Settle(string note)
    {
        Status = InstallmentStatus.Settled;
        Note = note;
    }

    public void Postpone(string note)
    {
        Status = InstallmentStatus.Postponed;
        Note = note;
    }

    /// <summary>The payroll run that last deducted from it (or deferred it).</summary>
    public string? DeductedIn { get; private set; }

    /// <summary>The payroll's deduction (4.8): all of it, or part with the rest deferred to the next payroll month.</summary>
    public void Deduct(decimal amount, string runNo)
    {
        Deducted = Math.Min(Amount, Deducted + Math.Max(0, amount));
        Status = Deducted >= Amount ? InstallmentStatus.Deducted : InstallmentStatus.Deferred;
        DeductedIn = runNo;
    }
}

public enum PenaltyCategory
{
    /// <summary>A penalty for a violation (HR, then senior management).</summary>
    Penalty,

    /// <summary>Another deduction: damage, lost custody… (HR, then finance).</summary>
    Other,
}

public enum PenaltyStatus
{
    InApproval,
    Returned,
    Rejected,
    Applied,
}

/// <summary>A penalty decision for a violation, or another deduction, through approval and into a payroll month.</summary>
public sealed class Penalty : ITenantOwned
{
    private Penalty()
    {
        PenaltyNo = string.Empty;
        EmployeeName = string.Empty;
        Description = string.Empty;
        Period = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string PenaltyNo { get; private set; }

    public PenaltyCategory Category { get; private set; }

    public Guid EmployeeId { get; private set; }

    public string EmployeeName { get; private set; }

    public Guid? PenaltyTypeId { get; private set; }

    public PenaltyEffect Effect { get; private set; }

    public DateOnly ViolationDate { get; private set; }

    public string Description { get; private set; }

    /// <summary>The employee's statement (the investigation).</summary>
    public string? Statement { get; private set; }

    public decimal? Days { get; private set; }

    public decimal? Amount { get; private set; }

    /// <summary>The payroll month it is deducted in.</summary>
    public string Period { get; private set; }

    public bool AboveCap { get; private set; }

    public PenaltyStatus Status { get; private set; }

    public bool AwaitingApproval { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? DecidedAt { get; private set; }

    public string? LastComment { get; private set; }

    public static Penalty Create(string number, PenaltyCategory category, Guid employeeId, string employeeName, string by, DateTimeOffset at) => new()
    {
        Id = Guid.CreateVersion7(),
        PenaltyNo = number,
        Category = category,
        EmployeeId = employeeId,
        EmployeeName = employeeName.Length > 300 ? employeeName[..300] : employeeName,
        CreatedByName = by,
        CreatedAt = at,
    };

    public Result Set(Guid? typeId, PenaltyEffect effect, DateOnly violationDate, string description, string? statement, decimal? days, decimal? amount, string period, bool aboveCap)
    {
        if (string.IsNullOrWhiteSpace(description) || description.Trim().Length > 1000 || (statement?.Length ?? 0) > 2000 || !Periods.Valid(period)
            || (effect is PenaltyEffect.DeductDays or PenaltyEffect.Suspension && days is not > 0)
            || (effect == PenaltyEffect.DeductAmount && amount is not > 0))
        {
            return Result.Failure(DeductionErrors.PenaltyFields);
        }

        PenaltyTypeId = typeId;
        Effect = effect;
        ViolationDate = violationDate;
        Description = description.Trim();
        Statement = string.IsNullOrWhiteSpace(statement) ? null : statement.Trim();
        Days = effect is PenaltyEffect.DeductDays or PenaltyEffect.Suspension ? days : null;
        Amount = effect == PenaltyEffect.DeductAmount ? decimal.Round(amount!.Value, 2) : null;
        Period = period;
        AboveCap = aboveCap;
        Status = PenaltyStatus.InApproval;
        AwaitingApproval = true;
        return Result.Success();
    }

    public void Started() => AwaitingApproval = false;

    public void Ended(PenaltyStatus status, string? comment, DateTimeOffset at)
    {
        Status = status;
        AwaitingApproval = false;
        LastComment = comment;
        DecidedAt = at;
    }

    /// <summary>The payroll run that deducted it (null while due).</summary>
    public string? DeductedIn { get; private set; }

    public decimal? DeductedAmount { get; private set; }

    /// <summary>How many payroll months it was deferred for the month's cap.</summary>
    public int Deferrals { get; private set; }

    public void Deduct(decimal amount, string runNo)
    {
        DeductedIn = runNo;
        DeductedAmount = decimal.Round(amount, 2);
    }

    public void Defer() => Deferrals++;
}

/// <summary>Payroll months as "2026-11".</summary>
public static class Periods
{
    public static bool Valid(string? period) =>
        period is { Length: 7 } && int.TryParse(period[..4], out var y) && period[4] == '-' && int.TryParse(period[5..], out var m) && y is >= 2025 and <= 2100 && m is >= 1 and <= 12;

    public static string Add(string period, int months)
    {
        var d = new DateOnly(int.Parse(period[..4], System.Globalization.CultureInfo.InvariantCulture), int.Parse(period[5..], System.Globalization.CultureInfo.InvariantCulture), 1).AddMonths(months);
        return $"{d.Year:D4}-{d.Month:D2}";
    }

    public static string Of(DateOnly d) => $"{d.Year:D4}-{d.Month:D2}";
}

public static class DeductionErrors
{
    public static readonly Error AdvanceNotFound = Error.NotFound("deduction_advance", "Advance not found.");
    public static readonly Error PenaltyNotFound = Error.NotFound("deduction_penalty", "Penalty not found.");
    public static readonly Error TypeNotFound = Error.NotFound("deduction_penalty_type", "Penalty type not found.");
    public static readonly Error EmployeeNotFound = Error.NotFound("deduction_employee", "Employee not found.");
    public static readonly Error Setting = Error.Validation("deduction_setting", "A setting is out of range.");
    public static readonly Error Name = Error.Validation("deduction_name", "Enter the name (Arabic required, 100 characters at most).");
    public static readonly Error AdvanceFields = Error.Validation("deduction_advance_fields", "Give the amount, the months, the first payroll month and the reason.");
    public static readonly Error PenaltyFields = Error.Validation("deduction_penalty_fields", "Give the description and the payroll month, and the days or the amount the penalty needs.");
    public static readonly Error AboveCap = Error.Conflict("deduction_above_cap", "The advance is above the cap: mark it as going above the cap for the approvers to decide.");
    public static readonly Error TooManyMonths = Error.Validation("deduction_too_many_months", "The advance is deducted over more months than the settings allow.");
    public static readonly Error OnProbation = Error.Conflict("deduction_on_probation", "The employee is still on probation.");
    public static readonly Error ShortService = Error.Conflict("deduction_short_service", "The employee has not served the months the settings require.");
    public static readonly Error OpenAdvance = Error.Conflict("deduction_open_advance", "The employee has an advance not yet settled.");
    public static readonly Error NoSalary = Error.Conflict("deduction_no_salary", "The employee has no salary recorded to measure the advance against.");
    public static readonly Error PerViolation = Error.Conflict("deduction_per_violation", "The penalty is above the days allowed for one violation.");
    public static readonly Error PerMonth = Error.Conflict("deduction_per_month", "The month's penalties would be above the days allowed in a month.");
    public static readonly Error NotEmployed = Error.Validation("deduction_not_employed", "The employee is not employed on that date.");
    public static readonly Error NotDisbursable = Error.Conflict("deduction_not_disbursable", "Only an approved advance can be paid, with its payment method.");
    public static readonly Error NotOpen = Error.Conflict("deduction_not_open", "Only a paid advance not yet settled can be settled early, with a note.");
    public static readonly Error NotPostponable = Error.Conflict("deduction_not_postponable", "Only a scheduled installment not yet deducted can be postponed, with a note.");
    public static readonly Error NotReturned = Error.Conflict("deduction_not_returned", "Only a returned request can be sent again.");
}
