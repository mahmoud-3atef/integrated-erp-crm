using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Payroll.Domain;

/// <summary>
/// A payroll run of the company's staff (docs/03-migration-plan/11, 4.8) for one commercial registration and one closed
/// attendance month: a line per employee from the salary in effect, the closed attendance, the approved advances,
/// penalties and deductions, and GOSI. The totals are kept with the run (the KPIs never add up a page of lines).
/// </summary>
public sealed class StaffPayrollRun : ITenantOwned
{
    private readonly List<StaffPayrollLine> _lines = [];

    private StaffPayrollRun()
    {
        RunNo = string.Empty;
        LegalEntityName = string.Empty;
        Period = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string RunNo { get; private set; }

    public Guid LegalEntityId { get; private set; }

    public string LegalEntityName { get; private set; }

    /// <summary>The attendance month ("2026-10") the run pays.</summary>
    public string Period { get; private set; }

    public DateOnly From { get; private set; }

    public DateOnly To { get; private set; }

    public PayrollStatus Status { get; private set; }

    public bool AwaitingApproval { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CalculatedAt { get; private set; }

    public DateTimeOffset? SubmittedAt { get; private set; }

    public DateTimeOffset? ApprovedAt { get; private set; }

    public string? ApprovedByName { get; private set; }

    public string? LastComment { get; private set; }

    public StaffRunTotals Totals { get; private set; } = StaffRunTotals.Zero;

    public IReadOnlyList<StaffPayrollLine> Lines => _lines;

    public bool IsEditable => Status is PayrollStatus.Draft or PayrollStatus.Returned && !AwaitingApproval;

    public bool IsInApproval => AwaitingApproval && Status == PayrollStatus.InApproval;

    public static StaffPayrollRun Create(string number, Guid legalEntityId, string legalEntityName, string period, DateOnly from, DateOnly to, string by, DateTimeOffset at) => new()
    {
        Id = Guid.CreateVersion7(),
        RunNo = number,
        LegalEntityId = legalEntityId,
        LegalEntityName = legalEntityName,
        Period = period,
        From = from,
        To = to,
        Status = PayrollStatus.Draft,
        CreatedAt = at,
        CreatedByName = by,
        CalculatedAt = at,
    };

    public Result Calculate(IReadOnlyList<StaffPayrollLine> lines, int noSalary, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(lines);
        if (!IsEditable)
        {
            return Result.Failure(PayrollErrors.NotEditable);
        }

        _lines.Clear();
        _lines.AddRange(lines);
        Totals = StaffRunTotals.Of(lines, noSalary);
        CalculatedAt = at;
        return Result.Success();
    }

    public Result MarkSubmitted(DateTimeOffset at)
    {
        if (!IsEditable)
        {
            return Result.Failure(PayrollErrors.NotEditable);
        }

        if (_lines.Count == 0)
        {
            return Result.Failure(PayrollErrors.Empty);
        }

        if (_lines.Any(l => l.Net <= 0))
        {
            return Result.Failure(PayrollErrors.NetNotPositive);
        }

        Status = PayrollStatus.InApproval;
        AwaitingApproval = true;
        SubmittedAt = at;
        return Result.Success();
    }

    public void SubmissionFailed()
    {
        Status = SubmittedAt is null ? PayrollStatus.Draft : PayrollStatus.Returned;
        AwaitingApproval = false;
    }

    public void Approve(string by, string? comment, DateTimeOffset at)
    {
        Status = PayrollStatus.Approved;
        AwaitingApproval = false;
        ApprovedAt = at;
        ApprovedByName = by;
        LastComment = comment;
    }

    public void ApprovalEnded(string? comment)
    {
        Status = PayrollStatus.Returned;
        AwaitingApproval = false;
        LastComment = comment;
    }
}

/// <summary>
/// The run's totals. <see cref="Allowances"/>: housing, the other allowances, overtime and additions.
/// <see cref="Deductions"/>: absence and unpaid days, lateness, the sick part, penalties, advances, other deductions and
/// the employee's GOSI. <see cref="GosiEmployer"/> is the company's cost, outside the net.
/// </summary>
public sealed record StaffRunTotals(
    int Employees,
    int NoSalary,
    int WithoutIban,
    int Joiners,
    int Leavers,
    decimal PaidDays,
    decimal Basic,
    decimal Housing,
    decimal OtherAllowances,
    decimal Overtime,
    decimal Additions,
    decimal Allowances,
    decimal Absence,
    decimal Penalties,
    decimal Advances,
    decimal OtherDeductions,
    decimal GosiEmployee,
    decimal GosiEmployer,
    decimal Deductions,
    decimal Deferred,
    decimal Net)
{
    public static readonly StaffRunTotals Zero = new(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

    public static StaffRunTotals Of(IReadOnlyCollection<StaffPayrollLine> l, int noSalary) => new(
        l.Count, noSalary, l.Count(x => x.Iban is null), l.Count(x => x.HasNote("joined")), l.Count(x => x.HasNote("left")),
        l.Sum(x => x.PaidDays), l.Sum(x => x.Basic), l.Sum(x => x.Housing), l.Sum(x => x.OtherAllowances), l.Sum(x => x.Overtime), l.Sum(x => x.Additions),
        l.Sum(x => x.Allowances), l.Sum(x => x.Absence + x.Late + x.SickPart), l.Sum(x => x.Penalties), l.Sum(x => x.Advances), l.Sum(x => x.OtherDeductions),
        l.Sum(x => x.GosiEmployee), l.Sum(x => x.GosiEmployer), l.Sum(x => x.Deductions), l.Sum(x => x.Deferred), l.Sum(x => x.Net));
}

/// <summary>An employee's pay in a staff run: the days, what each element earned, what the month deducted, GOSI and the net.</summary>
public sealed class StaffPayrollLine : ITenantOwned
{
    private readonly List<StaffPayrollItem> _items = [];

    private StaffPayrollLine()
    {
        EmployeeNo = string.Empty;
        Name = string.Empty;
        GosiCategory = string.Empty;
        Notes = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid RunId { get; private set; }

    public Guid EmployeeId { get; private set; }

    public string EmployeeNo { get; private set; }

    public string Name { get; private set; }

    public Guid? DepartmentId { get; private set; }

    public string? DepartmentAr { get; private set; }

    public string? DepartmentEn { get; private set; }

    public string? JobTitleAr { get; private set; }

    public string? JobTitleEn { get; private set; }

    /// <summary>The monthly salary (all its elements).</summary>
    public decimal MonthlySalary { get; private set; }

    public decimal MonthlyBasic { get; private set; }

    /// <summary>The days in service in the period, by the 30-day rule.</summary>
    public decimal ServiceDays { get; private set; }

    /// <summary>The service days less the absence, unpaid leave and suspension days.</summary>
    public decimal PaidDays { get; private set; }

    public decimal UnpaidDays { get; private set; }

    public decimal LateMinutes { get; private set; }

    public decimal SickPartDays { get; private set; }

    public decimal OvertimeHours { get; private set; }

    public decimal Basic { get; private set; }

    public decimal Housing { get; private set; }

    public decimal OtherAllowances { get; private set; }

    public decimal Overtime { get; private set; }

    public decimal Additions { get; private set; }

    public decimal Allowances { get; private set; }

    public decimal Gross { get; private set; }

    public decimal Absence { get; private set; }

    public decimal Late { get; private set; }

    public decimal SickPart { get; private set; }

    public decimal Penalties { get; private set; }

    public decimal Advances { get; private set; }

    public decimal OtherDeductions { get; private set; }

    public string GosiCategory { get; private set; }

    public decimal GosiBase { get; private set; }

    public decimal GosiEmployee { get; private set; }

    public decimal GosiEmployer { get; private set; }

    public decimal Deductions { get; private set; }

    /// <summary>What the month's cap left for the next payroll month.</summary>
    public decimal Deferred { get; private set; }

    public decimal CapLimit { get; private set; }

    public decimal Net { get; private set; }

    public string? BankName { get; private set; }

    public string? Iban { get; private set; }

    /// <summary>The review notes, comma-separated: joined, left, no_iban, no_attendance, salary_changed, deferred, net_not_positive.</summary>
    public string Notes { get; private set; }

    public IReadOnlyList<StaffPayrollItem> Items => _items;

    public bool HasNote(string note) => ("," + Notes + ",").Contains("," + note + ",", StringComparison.Ordinal);

    public static StaffPayrollLine Create(Guid runId, StaffLineValues v, IReadOnlyList<StaffPayrollItem> items)
    {
        ArgumentNullException.ThrowIfNull(v);
        ArgumentNullException.ThrowIfNull(items);
        var line = new StaffPayrollLine
        {
            Id = Guid.CreateVersion7(),
            RunId = runId,
            EmployeeId = v.EmployeeId,
            EmployeeNo = v.EmployeeNo,
            Name = v.Name,
            DepartmentId = v.DepartmentId,
            DepartmentAr = v.DepartmentAr,
            DepartmentEn = v.DepartmentEn,
            JobTitleAr = v.JobTitleAr,
            JobTitleEn = v.JobTitleEn,
            MonthlySalary = v.MonthlySalary,
            MonthlyBasic = v.MonthlyBasic,
            ServiceDays = v.ServiceDays,
            PaidDays = v.PaidDays,
            UnpaidDays = v.UnpaidDays,
            LateMinutes = v.LateMinutes,
            SickPartDays = v.SickPartDays,
            OvertimeHours = v.OvertimeHours,
            Basic = v.Basic,
            Housing = v.Housing,
            OtherAllowances = v.OtherAllowances,
            Overtime = v.Overtime,
            Additions = v.Additions,
            Allowances = v.Housing + v.OtherAllowances + v.Overtime + v.Additions,
            Gross = v.Basic + v.Housing + v.OtherAllowances + v.Overtime + v.Additions,
            Absence = v.Absence,
            Late = v.Late,
            SickPart = v.SickPart,
            Penalties = v.Penalties,
            Advances = v.Advances,
            OtherDeductions = v.OtherDeductions,
            GosiCategory = v.GosiCategory,
            GosiBase = v.GosiBase,
            GosiEmployee = v.GosiEmployee,
            GosiEmployer = v.GosiEmployer,
            Deductions = v.Absence + v.Late + v.SickPart + v.Penalties + v.Advances + v.OtherDeductions + v.GosiEmployee,
            Deferred = v.Deferred,
            CapLimit = v.CapLimit,
            Net = v.Net,
            BankName = v.BankName,
            Iban = v.Iban,
            Notes = string.Join(',', v.Notes),
        };
        foreach (var item in items)
        {
            item.AttachTo(runId, line.Id);
            line._items.Add(item);
        }

        return line;
    }
}

public sealed record StaffLineValues(
    Guid EmployeeId,
    string EmployeeNo,
    string Name,
    Guid? DepartmentId,
    string? DepartmentAr,
    string? DepartmentEn,
    string? JobTitleAr,
    string? JobTitleEn,
    decimal MonthlySalary,
    decimal MonthlyBasic,
    decimal ServiceDays,
    decimal PaidDays,
    decimal UnpaidDays,
    decimal LateMinutes,
    decimal SickPartDays,
    decimal OvertimeHours,
    decimal Basic,
    decimal Housing,
    decimal OtherAllowances,
    decimal Overtime,
    decimal Additions,
    decimal Absence,
    decimal Late,
    decimal SickPart,
    decimal Penalties,
    decimal Advances,
    decimal OtherDeductions,
    string GosiCategory,
    decimal GosiBase,
    decimal GosiEmployee,
    decimal GosiEmployer,
    decimal Deferred,
    decimal CapLimit,
    decimal Net,
    string? BankName,
    string? Iban,
    IReadOnlyList<string> Notes);

public enum StaffItemKind
{
    Installment,
    PenaltyDays,
    PenaltyAmount,
    Suspension,
    Other,
    Addition,
    Deduction,
}

/// <summary>Where an amount of the line comes from (an installment, a penalty, a deduction, an adjustment), and what the month did with it.</summary>
public sealed class StaffPayrollItem : ITenantOwned
{
    private StaffPayrollItem()
    {
        Reference = string.Empty;
        Description = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid RunId { get; private set; }

    public Guid LineId { get; private set; }

    public StaffItemKind Kind { get; private set; }

    /// <summary>The installment, penalty or adjustment.</summary>
    public Guid SourceId { get; private set; }

    public string Reference { get; private set; }

    public string Description { get; private set; }

    public string? Period { get; private set; }

    public decimal Days { get; private set; }

    public decimal Due { get; private set; }

    public decimal Deducted { get; private set; }

    public bool Deferred { get; private set; }

    public bool AboveCap { get; private set; }

    public static StaffPayrollItem Create(StaffItemKind kind, Guid sourceId, string reference, string description, string? period, decimal days, decimal due, decimal deducted, bool deferred, bool aboveCap) => new()
    {
        Id = Guid.CreateVersion7(),
        Kind = kind,
        SourceId = sourceId,
        Reference = reference.Length > 60 ? reference[..60] : reference,
        Description = description.Length > 500 ? description[..500] : description,
        Period = period,
        Days = days,
        Due = due,
        Deducted = deducted,
        Deferred = deferred,
        AboveCap = aboveCap,
    };

    internal void AttachTo(Guid runId, Guid lineId)
    {
        RunId = runId;
        LineId = lineId;
    }
}

public enum AdjustmentKind
{
    Addition,
    Deduction,
}

/// <summary>A one-time addition or deduction on an employee's line, with its reason (only while the run is open; audited).</summary>
public sealed class StaffPayrollAdjustment : ITenantOwned
{
    private StaffPayrollAdjustment()
    {
        Reason = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid RunId { get; private set; }

    public Guid EmployeeId { get; private set; }

    public AdjustmentKind Kind { get; private set; }

    public decimal Amount { get; private set; }

    public string Reason { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static Result<StaffPayrollAdjustment> Create(Guid runId, Guid employeeId, AdjustmentKind kind, decimal amount, string reason, string by, DateTimeOffset at)
    {
        if (amount <= 0 || amount > 1_000_000 || string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500)
        {
            return Result.Failure<StaffPayrollAdjustment>(PayrollErrors.Adjustment);
        }

        return Result.Success(new StaffPayrollAdjustment
        {
            Id = Guid.CreateVersion7(),
            RunId = runId,
            EmployeeId = employeeId,
            Kind = kind,
            Amount = decimal.Round(amount, 2),
            Reason = reason.Trim(),
            CreatedByName = by,
            CreatedAt = at,
        });
    }
}

public enum LateDeductionMode
{
    /// <summary>Lateness is not deducted (the reviewer sets deduction days in the attendance when needed).</summary>
    None,

    /// <summary>The late and early minutes are deducted at the minute's wage.</summary>
    PerMinute,
}

/// <summary>The staff payroll's rules, editable by the company (overtime, lateness).</summary>
public sealed class StaffPaySetting : ITenantOwned
{
    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>The overtime hour: the hourly wage plus this share of the basic hourly wage (article 107: 50%).</summary>
    public decimal OvertimePremiumPercent { get; private set; } = 50;

    /// <summary>Working hours in a day, for the hourly wage (monthly ÷ 30 ÷ this).</summary>
    public decimal HoursPerDay { get; private set; } = 8;

    public LateDeductionMode LateMode { get; private set; }

    public static StaffPaySetting Default() => new() { Id = Guid.CreateVersion7() };

    public Result Set(decimal overtimePremiumPercent, decimal hoursPerDay, LateDeductionMode lateMode)
    {
        if (overtimePremiumPercent is < 0 or > 300 || hoursPerDay is < 1 or > 24)
        {
            return Result.Failure(PayrollErrors.Setting);
        }

        OvertimePremiumPercent = overtimePremiumPercent;
        HoursPerDay = hoursPerDay;
        LateMode = lateMode;
        return Result.Success();
    }
}

public enum GosiCategory
{
    /// <summary>Saudi, joined GOSI before 2024-07-03.</summary>
    SaudiLegacy,

    /// <summary>Saudi, joined GOSI on or after 2024-07-03 (the graduated pension rates).</summary>
    SaudiNew,

    NonSaudi,
}

/// <summary>GOSI rates of a category from a date (employee and company shares, and the wage's floor and ceiling).</summary>
public sealed class GosiRate : ITenantOwned
{
    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public GosiCategory Category { get; private set; }

    public DateOnly EffectiveFrom { get; private set; }

    public decimal EmployeePercent { get; private set; }

    public decimal EmployerPercent { get; private set; }

    public decimal MinBase { get; private set; }

    public decimal MaxBase { get; private set; }

    public static Result<GosiRate> Create(GosiCategory category, DateOnly from, decimal employee, decimal employer, decimal min, decimal max)
    {
        var rate = new GosiRate { Id = Guid.CreateVersion7(), Category = category };
        var set = rate.Set(from, employee, employer, min, max);
        return set.IsSuccess ? Result.Success(rate) : Result.Failure<GosiRate>(set.Error);
    }

    public Result Set(DateOnly from, decimal employee, decimal employer, decimal min, decimal max)
    {
        if (employee is < 0 or > 50 || employer is < 0 or > 50 || min < 0 || max < min)
        {
            return Result.Failure(PayrollErrors.Setting);
        }

        EffectiveFrom = from;
        EmployeePercent = employee;
        EmployerPercent = employer;
        MinBase = min;
        MaxBase = max;
        return Result.Success();
    }
}
