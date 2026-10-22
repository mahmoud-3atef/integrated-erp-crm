using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Billing.Domain;

/// <summary>Where a timesheet stands: generated (and regenerated) as a draft, sent for approval, approved (locked).</summary>
public enum TimesheetStatus
{
    Draft,
    InApproval,

    /// <summary>Sent back by an approver: changed and sent again.</summary>
    Returned,

    /// <summary>Approved: locked, ready for the invoice, the payroll and the suppliers' statements.</summary>
    Approved,
}

/// <summary>Who employs the worker, which says where the worker's pay goes.</summary>
public enum WorkerSource
{
    /// <summary>On the company's sponsorship: paid in the company's payroll.</summary>
    Company,

    /// <summary>From an internal supplier: on the supplier's statement.</summary>
    Supplier,

    /// <summary>No sponsor in the old system: to be set before the payroll or a statement can take the worker.</summary>
    Unknown,
}

/// <summary>The month's adjustments a timesheet takes (docs/02-target-architecture/06 §2.3); each needs a reason.</summary>
public enum AdjustmentType
{
    /// <summary>Absent days: off the salary part of the invoice and the worker's pay.</summary>
    Absence,

    /// <summary>Overtime hours: added to the invoice and the pay.</summary>
    Overtime,

    /// <summary>An overtime amount (besides or instead of hours): added to the invoice and the pay.</summary>
    OvertimeAmount,

    /// <summary>An amount the customer adds (bonus, allowance): invoice and pay.</summary>
    ClientAddition,

    /// <summary>An amount the customer deducts: invoice and pay.</summary>
    ClientDeduction,

    /// <summary>A loan the customer paid the worker: off the invoice and the pay.</summary>
    CustomerLoan,

    /// <summary>Fee days differing from the work days (±): the fee part only.</summary>
    FeeDays,

    /// <summary>Other costs on the customer: invoice only.</summary>
    OtherCost,

    /// <summary>Other deductions for the customer (a discount): off the invoice only.</summary>
    OtherDeduction,

    /// <summary>An amount the company adds to the worker's pay (bonus, allowance): the pay only, not the invoice.</summary>
    InternalAddition,

    /// <summary>An amount the company deducts from the worker's pay (penalty, its own loan): the pay only, not the invoice.</summary>
    InternalDeduction,
}

/// <summary>A project's billing settings: the cycle, how days count, overtime, GOSI and VAT.</summary>
public sealed class ProjectBillingSetting : ITenantOwned
{
    private ProjectBillingSetting()
    {
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid ProjectId { get; private set; }

    /// <summary>The cycle's first day (1: calendar month; 21: the 21st to the 20th…).</summary>
    public int CycleStartDay { get; private set; } = 1;

    public DayBasis DayBasis { get; private set; }

    public decimal OvertimeMultiplier { get; private set; } = 1.5m;

    /// <summary>The month's hours an hour of the basic salary is taken from (240 = 30 × 8).</summary>
    public decimal MonthlyHours { get; private set; } = 240;

    /// <summary>A fixed overtime rate per hour instead of the basic-salary rule.</summary>
    public decimal? OvertimeHourlyRate { get; private set; }

    /// <summary>The most overtime hours a worker may have in a cycle.</summary>
    public decimal MaxOvertimeHours { get; private set; } = 120;

    public decimal GosiRate { get; private set; } = 0.02m;

    public decimal VatRate { get; private set; } = 0.15m;

    public static ProjectBillingSetting Default(Guid projectId) => new() { Id = Guid.CreateVersion7(), ProjectId = projectId };

    public Result Set(int cycleStartDay, DayBasis basis, decimal overtimeMultiplier, decimal monthlyHours, decimal? overtimeHourlyRate, decimal maxOvertimeHours, decimal gosiRate, decimal vatRate)
    {
        if (cycleStartDay is < 1 or > 28 || overtimeMultiplier is < 1 or > 5 || monthlyHours is < 1 or > 400 || overtimeHourlyRate is < 0
            || maxOvertimeHours is < 0 or > 400 || gosiRate is < 0 or > 1 || vatRate is < 0 or > 1)
        {
            return Result.Failure(TimesheetErrors.Settings);
        }

        CycleStartDay = cycleStartDay;
        DayBasis = basis;
        OvertimeMultiplier = overtimeMultiplier;
        MonthlyHours = monthlyHours;
        OvertimeHourlyRate = overtimeHourlyRate;
        MaxOvertimeHours = maxOvertimeHours;
        GosiRate = gosiRate;
        VatRate = vatRate;
        return Result.Success();
    }
}

/// <summary>
/// A project's timesheet for a billing cycle (docs/02-target-architecture/06): one line per worker period in the
/// cycle, generated from the period ledger (nobody types work days), with the month's adjustments. Approved, it is
/// locked and feeds the customer invoice, the payroll of the company's workers and the internal suppliers' statements.
/// </summary>
public sealed class Timesheet : ITenantOwned
{
    private readonly List<TimesheetLine> _lines = [];
    private readonly List<TimesheetAdjustment> _adjustments = [];

    private Timesheet()
    {
        TimesheetNo = string.Empty;
        ProjectCode = string.Empty;
        ProjectName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string TimesheetNo { get; private set; }

    public Guid ProjectId { get; private set; }

    public Guid ProjectCrmId { get; private set; }

    public string ProjectCode { get; private set; }

    public string ProjectName { get; private set; }

    public string? CustomerName { get; private set; }

    public string? ContractType { get; private set; }

    /// <summary>The first day of the month the cycle ends in.</summary>
    public DateOnly Month { get; private set; }

    public DateOnly From { get; private set; }

    public DateOnly To { get; private set; }

    public DayBasis DayBasis { get; private set; }

    public TimesheetStatus Status { get; private set; }

    /// <summary>An approval of the timesheet is running.</summary>
    public bool AwaitingApproval { get; private set; }

    public DateTimeOffset GeneratedAt { get; private set; }

    public string GeneratedByName { get; private set; } = string.Empty;

    public DateTimeOffset? SubmittedAt { get; private set; }

    public DateTimeOffset? ApprovedAt { get; private set; }

    public string? ApprovedByName { get; private set; }

    public string? LastComment { get; private set; }

    public IReadOnlyList<TimesheetLine> Lines => _lines;

    public IReadOnlyList<TimesheetAdjustment> Adjustments => _adjustments;

    public bool IsEditable => Status is TimesheetStatus.Draft or TimesheetStatus.Returned && !AwaitingApproval;

    public bool IsInApproval => AwaitingApproval && Status == TimesheetStatus.InApproval;

    public static Timesheet Create(string number, TimesheetProject project, DateOnly month, DateOnly from, DateOnly to, DayBasis basis) => new()
    {
        Id = Guid.CreateVersion7(),
        TimesheetNo = number,
        ProjectId = project.ProjectId,
        ProjectCrmId = project.ProjectCrmId,
        ProjectCode = project.Code,
        ProjectName = project.Name,
        CustomerName = project.CustomerName,
        ContractType = project.ContractType,
        Month = month,
        From = from,
        To = to,
        DayBasis = basis,
        Status = TimesheetStatus.Draft,
    };

    /// <summary>
    /// Replaces the lines (a new generation from the ledger) while the timesheet is open; the adjustments stay on their
    /// workers and are applied again.
    /// </summary>
    public Result Regenerate(DateOnly from, DateOnly to, DayBasis basis, IEnumerable<TimesheetLine> lines, BillingRules rules, string by, DateTimeOffset at)
    {
        if (Status is not (TimesheetStatus.Draft or TimesheetStatus.Returned) || AwaitingApproval)
        {
            return Result.Failure(TimesheetErrors.NotEditable);
        }

        From = from;
        To = to;
        DayBasis = basis;
        _lines.Clear();
        _lines.AddRange(lines);
        GeneratedAt = at;
        GeneratedByName = by;

        // An adjustment whose worker is no longer on the timesheet goes.
        _adjustments.RemoveAll(a => !_lines.Any(l => l.WorkerId == a.WorkerId));
        Recalculate(rules);
        return Result.Success();
    }

    public Result<TimesheetAdjustment> Adjust(Guid workerId, AdjustmentType type, decimal value, string reason, BillingRules rules, decimal maxOvertimeHours, string by, DateTimeOffset at)
    {
        if (!IsEditable)
        {
            return Result.Failure<TimesheetAdjustment>(TimesheetErrors.NotEditable);
        }

        var lines = _lines.Where(l => l.WorkerId == workerId).ToList();
        if (lines.Count == 0)
        {
            return Result.Failure<TimesheetAdjustment>(TimesheetErrors.WorkerNotOnTimesheet);
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            return Result.Failure<TimesheetAdjustment>(TimesheetErrors.Reason);
        }

        if (value == 0 || (type != AdjustmentType.FeeDays && value < 0))
        {
            return Result.Failure<TimesheetAdjustment>(TimesheetErrors.Value);
        }

        var mine = _adjustments.Where(a => a.WorkerId == workerId).ToList();
        if (type == AdjustmentType.Absence && mine.Where(a => a.Type == AdjustmentType.Absence).Sum(a => a.Value) + value > lines.Sum(l => l.WorkDays))
        {
            return Result.Failure<TimesheetAdjustment>(TimesheetErrors.AbsenceOverDays);
        }

        if (type == AdjustmentType.Overtime && mine.Where(a => a.Type == AdjustmentType.Overtime).Sum(a => a.Value) + value > maxOvertimeHours)
        {
            return Result.Failure<TimesheetAdjustment>(TimesheetErrors.OvertimeOverLimit);
        }

        var adjustment = new TimesheetAdjustment(Id, workerId, type, value, reason.Trim(), by, at);
        _adjustments.Add(adjustment);
        Recalculate(rules);
        return Result.Success(adjustment);
    }

    /// <summary>
    /// Sets workers' totals per adjustment type (an uploaded Excel file): a worker's adjustments of a changed type are
    /// replaced by one carrying the new total and the row's reason (none when the total is zero). All or nothing.
    /// Returns the adjustments removed and added.
    /// </summary>
    public Result<(IReadOnlyList<TimesheetAdjustment> Removed, IReadOnlyList<TimesheetAdjustment> Added)> SetTotals(
        IReadOnlyList<AdjustmentTotal> totals, BillingRules rules, decimal maxOvertimeHours, string by, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(totals);
        if (!IsEditable)
        {
            return Result.Failure<(IReadOnlyList<TimesheetAdjustment>, IReadOnlyList<TimesheetAdjustment>)>(TimesheetErrors.NotEditable);
        }

        foreach (var t in totals)
        {
            var days = _lines.Where(l => l.WorkerId == t.WorkerId).Sum(l => l.WorkDays);
            var problem = days == 0 ? TimesheetErrors.WorkerNotOnTimesheet
                : string.IsNullOrWhiteSpace(t.Reason) ? TimesheetErrors.Reason
                : t.Type != AdjustmentType.FeeDays && t.Total < 0 ? TimesheetErrors.Value
                : t.Type == AdjustmentType.Absence && t.Total > days ? TimesheetErrors.AbsenceOverDays
                : t.Type == AdjustmentType.Overtime && t.Total > maxOvertimeHours ? TimesheetErrors.OvertimeOverLimit
                : null;
            if (problem is not null)
            {
                return Result.Failure<(IReadOnlyList<TimesheetAdjustment>, IReadOnlyList<TimesheetAdjustment>)>(problem);
            }
        }

        var removed = new List<TimesheetAdjustment>();
        var added = new List<TimesheetAdjustment>();
        foreach (var t in totals)
        {
            var old = _adjustments.Where(a => a.WorkerId == t.WorkerId && a.Type == t.Type).ToList();
            removed.AddRange(old);
            _adjustments.RemoveAll(old.Contains);
            if (t.Total != 0)
            {
                var adjustment = new TimesheetAdjustment(Id, t.WorkerId, t.Type, t.Total, t.Reason.Trim(), by, at);
                _adjustments.Add(adjustment);
                added.Add(adjustment);
            }
        }

        Recalculate(rules);
        return Result.Success<(IReadOnlyList<TimesheetAdjustment>, IReadOnlyList<TimesheetAdjustment>)>((removed, added));
    }

    /// <summary>A worker's adjustments of one type, as totals.</summary>
    public decimal TotalOf(Guid workerId, AdjustmentType type) => _adjustments.Where(a => a.WorkerId == workerId && a.Type == type).Sum(a => a.Value);

    public Result RemoveAdjustment(Guid adjustmentId, BillingRules rules)
    {
        if (!IsEditable)
        {
            return Result.Failure(TimesheetErrors.NotEditable);
        }

        if (_adjustments.RemoveAll(a => a.Id == adjustmentId) == 0)
        {
            return Result.Failure(TimesheetErrors.AdjustmentNotFound);
        }

        Recalculate(rules);
        return Result.Success();
    }

    public Result MarkSubmitted(DateTimeOffset at)
    {
        if (!IsEditable)
        {
            return Result.Failure(TimesheetErrors.NotEditable);
        }

        if (_lines.Count == 0)
        {
            return Result.Failure(TimesheetErrors.Empty);
        }

        if (_lines.Any(l => l.TotalPrice <= 0))
        {
            return Result.Failure(TimesheetErrors.NoPrice);
        }

        Status = TimesheetStatus.InApproval;
        AwaitingApproval = true;
        SubmittedAt = at;
        return Result.Success();
    }

    /// <summary>The approval could not start: the timesheet stays a draft.</summary>
    public void SubmissionFailed()
    {
        Status = TimesheetStatus.Draft;
        AwaitingApproval = false;
    }

    public void Approve(string by, string? comment, DateTimeOffset at)
    {
        Status = TimesheetStatus.Approved;
        AwaitingApproval = false;
        ApprovedAt = at;
        ApprovedByName = by;
        LastComment = comment;
    }

    /// <summary>The approval ended without approving: back to be changed.</summary>
    public void ApprovalEnded(string? comment)
    {
        Status = TimesheetStatus.Returned;
        AwaitingApproval = false;
        LastComment = comment;
    }

    /// <summary>Spreads each worker's adjustments over their lines (days and hours on the first line, amounts too) and recalculates.</summary>
    private void Recalculate(BillingRules rules)
    {
        foreach (var group in _lines.GroupBy(l => l.WorkerId))
        {
            var mine = _adjustments.Where(a => a.WorkerId == group.Key).ToList();
            decimal Sum(AdjustmentType type) => mine.Where(a => a.Type == type).Sum(a => a.Value);
            var absence = Sum(AdjustmentType.Absence);
            var first = true;
            foreach (var line in group.OrderBy(l => l.LineFrom))
            {
                // Absent days fill the lines in order; the rest go to the first line.
                var lineAbsence = Math.Min(absence, line.WorkDays);
                absence -= lineAbsence;
                line.Apply(
                    lineAbsence,
                    first ? Sum(AdjustmentType.Overtime) : 0,
                    first ? Sum(AdjustmentType.OvertimeAmount) : 0,
                    first ? Sum(AdjustmentType.ClientAddition) : 0,
                    first ? Sum(AdjustmentType.ClientDeduction) : 0,
                    first ? Sum(AdjustmentType.CustomerLoan) : 0,
                    first ? Sum(AdjustmentType.FeeDays) : 0,
                    first ? Sum(AdjustmentType.OtherCost) : 0,
                    first ? Sum(AdjustmentType.OtherDeduction) : 0,
                    first ? Sum(AdjustmentType.InternalAddition) : 0,
                    first ? Sum(AdjustmentType.InternalDeduction) : 0,
                    rules);
                first = false;
            }
        }
    }
}

/// <summary>A worker's new total of one adjustment type, with the reason.</summary>
public sealed record AdjustmentTotal(Guid WorkerId, AdjustmentType Type, decimal Total, string Reason);

/// <summary>The project a timesheet is for.</summary>
public sealed record TimesheetProject(Guid ProjectId, Guid ProjectCrmId, string Code, string Name, string? CustomerName, string? ContractType);

/// <summary>
/// A worker period in the cycle: who, from which source, the days, the price copied from the period, the worker's pay,
/// the adjustments' totals, and the amounts (customer invoice and worker's pay).
/// </summary>
public sealed class TimesheetLine : ITenantOwned
{
    private TimesheetLine()
    {
        PeriodKey = string.Empty;
        WorkerNo = string.Empty;
        Name = string.Empty;
        SourceNo = string.Empty;
    }

    public TimesheetLine(Guid timesheetId, TimesheetLineValues v)
        : this()
    {
        ArgumentNullException.ThrowIfNull(v);
        Id = Guid.CreateVersion7();
        TimesheetId = timesheetId;
        PeriodKey = v.PeriodKey;
        WorkerId = v.WorkerId;
        WorkerNo = v.WorkerNo;
        Name = v.Name;
        IqamaNo = v.IqamaNo;
        ProfessionCode = v.ProfessionCode;
        NationalityCode = v.NationalityCode;
        Source = v.Source;
        SupplierName = v.SupplierName;
        LineFrom = v.LineFrom;
        LineTo = v.LineTo;
        WorkDays = v.WorkDays;
        DayDivisor = v.DayDivisor;
        PackageNo = v.PackageNo;
        BillSalary = v.BillSalary;
        TotalPrice = v.TotalPrice;
        Housing = v.Housing;
        HousingBillable = v.HousingBillable;
        Transport = v.Transport;
        TransportBillable = v.TransportBillable;
        IsSpecialPrice = v.IsSpecialPrice;
        PaySalary = v.PaySalary;
        BasicSalary = v.BasicSalary;
        SourceType = v.SourceType;
        SourceNo = v.SourceNo;
        FromOldSystem = v.FromOldSystem;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid TimesheetId { get; private set; }

    /// <summary>The ledger period the line comes from.</summary>
    public string PeriodKey { get; private set; }

    public Guid WorkerId { get; private set; }

    public string WorkerNo { get; private set; }

    public string Name { get; private set; }

    public string? IqamaNo { get; private set; }

    public string? ProfessionCode { get; private set; }

    public string? NationalityCode { get; private set; }

    public WorkerSource Source { get; private set; }

    /// <summary>The internal supplier (sponsor) of a supplier's worker.</summary>
    public string? SupplierName { get; private set; }

    public DateOnly LineFrom { get; private set; }

    public DateOnly LineTo { get; private set; }

    /// <summary>R: the work days (30-day rule).</summary>
    public decimal WorkDays { get; private set; }

    /// <summary>Q: 30, or the cycle's days.</summary>
    public decimal DayDivisor { get; private set; }

    public string? PackageNo { get; private set; }

    /// <summary>Y: the salary the price is built on.</summary>
    public decimal BillSalary { get; private set; }

    /// <summary>AC: the worker's full monthly price.</summary>
    public decimal TotalPrice { get; private set; }

    public decimal Housing { get; private set; }

    public bool HousingBillable { get; private set; }

    public decimal Transport { get; private set; }

    public bool TransportBillable { get; private set; }

    public bool IsSpecialPrice { get; private set; }

    /// <summary>The worker's own monthly salary (what the payroll or the supplier pays).</summary>
    public decimal PaySalary { get; private set; }

    public decimal BasicSalary { get; private set; }

    public string? SourceType { get; private set; }

    public string SourceNo { get; private set; }

    public bool FromOldSystem { get; private set; }

    public decimal AbsenceDays { get; private set; }

    public decimal OvertimeHours { get; private set; }

    public decimal ClientAdditions { get; private set; }

    public decimal ClientDeductions { get; private set; }

    public decimal CustomerLoans { get; private set; }

    public decimal FeeDaysAdjust { get; private set; }

    public decimal OtherCosts { get; private set; }

    /// <summary>An overtime amount entered as money (besides the hours): invoice and pay.</summary>
    public decimal OvertimeAmount { get; private set; }

    /// <summary>Other deductions for the customer: off the invoice only.</summary>
    public decimal OtherDeductions { get; private set; }

    /// <summary>The company's own additions to the worker's pay (not billed).</summary>
    public decimal InternalAdditions { get; private set; }

    /// <summary>The company's own deductions from the worker's pay (not billed).</summary>
    public decimal InternalDeductions { get; private set; }

    public decimal FeeDays { get; private set; }

    public decimal DueSalary { get; private set; }

    public decimal AbsenceAmount { get; private set; }

    public decimal DueFees { get; private set; }

    public decimal DueHousing { get; private set; }

    public decimal DueTransport { get; private set; }

    public decimal Overtime { get; private set; }

    public decimal Gosi { get; private set; }

    public decimal InvoiceAmount { get; private set; }

    public decimal Vat { get; private set; }

    public decimal InvoiceTotal { get; private set; }

    public decimal PayDueSalary { get; private set; }

    public decimal PayAbsence { get; private set; }

    public decimal WorkerNet { get; private set; }

    internal void Apply(
        decimal absence, decimal overtime, decimal overtimeAmount, decimal additions, decimal deductions, decimal loans, decimal feeDays, decimal otherCosts,
        decimal otherDeductions, decimal internalAdditions, decimal internalDeductions, BillingRules rules)
    {
        AbsenceDays = absence;
        OvertimeHours = overtime;
        OvertimeAmount = overtimeAmount;
        OtherDeductions = otherDeductions;
        ClientAdditions = additions;
        ClientDeductions = deductions;
        CustomerLoans = loans;
        FeeDaysAdjust = feeDays;
        OtherCosts = otherCosts;
        InternalAdditions = internalAdditions;
        InternalDeductions = internalDeductions;
        var a = TimesheetMath.Calculate(
            new LineInputs(
                WorkDays, DayDivisor, BillSalary, TotalPrice, Housing, Transport, PaySalary, BasicSalary, absence, overtime, additions, deductions, loans, feeDays, otherCosts,
                internalAdditions, internalDeductions, overtimeAmount, otherDeductions),
            rules);
        FeeDays = a.FeeDays;
        DueSalary = a.DueSalary;
        AbsenceAmount = a.AbsenceAmount;
        DueFees = a.DueFees;
        DueHousing = a.DueHousing;
        DueTransport = a.DueTransport;
        Overtime = a.Overtime;
        Gosi = a.Gosi;
        InvoiceAmount = a.InvoiceAmount;
        Vat = a.Vat;
        InvoiceTotal = a.InvoiceTotal;
        PayDueSalary = a.PayDueSalary;
        PayAbsence = a.PayAbsence;
        WorkerNet = a.WorkerNet;
    }
}

public sealed record TimesheetLineValues(
    string PeriodKey,
    Guid WorkerId,
    string WorkerNo,
    string Name,
    string? IqamaNo,
    string? ProfessionCode,
    string? NationalityCode,
    WorkerSource Source,
    string? SupplierName,
    DateOnly LineFrom,
    DateOnly LineTo,
    decimal WorkDays,
    decimal DayDivisor,
    string? PackageNo,
    decimal BillSalary,
    decimal TotalPrice,
    decimal Housing,
    bool HousingBillable,
    decimal Transport,
    bool TransportBillable,
    bool IsSpecialPrice,
    decimal PaySalary,
    decimal BasicSalary,
    string? SourceType,
    string SourceNo,
    bool FromOldSystem);

/// <summary>A month's adjustment of a worker on the timesheet, with its reason.</summary>
public sealed class TimesheetAdjustment : ITenantOwned
{
    private TimesheetAdjustment()
    {
        Reason = string.Empty;
        CreatedByName = string.Empty;
    }

    internal TimesheetAdjustment(Guid timesheetId, Guid workerId, AdjustmentType type, decimal value, string reason, string by, DateTimeOffset at)
        : this()
    {
        Id = Guid.CreateVersion7();
        TimesheetId = timesheetId;
        WorkerId = workerId;
        Type = type;
        Value = value;
        Reason = reason;
        CreatedByName = by;
        CreatedAt = at;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid TimesheetId { get; private set; }

    public Guid WorkerId { get; private set; }

    public AdjustmentType Type { get; private set; }

    /// <summary>Days, hours or an amount, by type.</summary>
    public decimal Value { get; private set; }

    public string Reason { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
}

public static class TimesheetErrors
{
    public static readonly Error NotFound = Error.NotFound("timesheet", "Timesheet not found.");
    public static readonly Error Project = Error.Validation("timesheet_project", "Choose a project.");
    public static readonly Error NotEditable = Error.Conflict("timesheet_not_editable", "Only a draft or returned timesheet can be changed.");
    public static readonly Error Empty = Error.Validation("timesheet_empty", "The timesheet has no workers.");
    public static readonly Error NoPrice = Error.Validation("timesheet_no_price", "A worker on the timesheet has no price: fix it in the period before sending.");
    public static readonly Error WorkerNotOnTimesheet = Error.Validation("timesheet_worker_not_on", "The worker is not on this timesheet.");
    public static readonly Error Reason = Error.Validation("timesheet_reason", "Every adjustment needs a reason.");
    public static readonly Error Value = Error.Validation("timesheet_value", "Enter a value (more than zero).");
    public static readonly Error AbsenceOverDays = Error.Validation("timesheet_absence_over_days", "The absent days exceed the worker's work days.");
    public static readonly Error OvertimeOverLimit = Error.Validation("timesheet_overtime_limit", "The overtime hours exceed the project's monthly limit.");
    public static readonly Error AdjustmentNotFound = Error.NotFound("timesheet_adjustment", "Adjustment not found.");
    public static readonly Error Settings = Error.Validation("timesheet_settings", "Check the billing settings' values.");
}
