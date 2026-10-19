using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Payroll.Domain;

/// <summary>Who a payroll run pays (docs/02-target-architecture/09 §1). Only the company's workers for now.</summary>
public enum PayrollGroup
{
    /// <summary>Workers on the company's sponsorship, paid from the approved timesheets.</summary>
    CompanyWorkers,
}

public enum PayrollStatus
{
    Draft,
    InApproval,

    /// <summary>Sent back by an approver (or rejected): recalculated and sent again.</summary>
    Returned,

    /// <summary>Approved: locked; corrections go to a later run.</summary>
    Approved,
}

/// <summary>Why a worker on the registration's sponsorship is not paid in the run (shown before approving).</summary>
public enum PayrollExclusionKind
{
    /// <summary>The worker's timesheet for the period is not approved yet: the worker waits for a later run.</summary>
    TimesheetNotApproved,

    /// <summary>The worker worked in the period but no timesheet holds the work.</summary>
    NoTimesheet,

    /// <summary>The worker's timesheet line is already paid in another run.</summary>
    PaidElsewhere,

    /// <summary>A net pay of zero or less: to be reviewed.</summary>
    NetNotPositive,
}

/// <summary>
/// A payroll run of a group for one commercial registration and a period chosen when it is created (09 §3.0): one line
/// per worker, from the approved timesheet lines of the period not paid in another run. The totals are kept with
/// the run (the KPIs and the comparison read them, never a page of lines added up in the browser).
/// </summary>
public sealed class PayrollRun : ITenantOwned
{
    private readonly List<PayrollLine> _lines = [];
    private readonly List<PayrollExclusion> _exclusions = [];

    private PayrollRun()
    {
        RunNo = string.Empty;
        LegalEntityName = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string RunNo { get; private set; }

    public PayrollGroup Group { get; private set; }

    public Guid LegalEntityId { get; private set; }

    public string LegalEntityName { get; private set; }

    public DateOnly From { get; private set; }

    public DateOnly To { get; private set; }

    public PayrollStatus Status { get; private set; }

    /// <summary>Sent and not decided yet (the engine's approval is running).</summary>
    public bool AwaitingApproval { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CalculatedAt { get; private set; }

    public DateTimeOffset? SubmittedAt { get; private set; }

    public DateTimeOffset? ApprovedAt { get; private set; }

    public string? ApprovedByName { get; private set; }

    public string? LastComment { get; private set; }

    public PayrollTotals Totals { get; private set; } = PayrollTotals.Zero;

    public IReadOnlyList<PayrollLine> Lines => _lines;

    public IReadOnlyList<PayrollExclusion> Exclusions => _exclusions;

    public bool IsEditable => Status is PayrollStatus.Draft or PayrollStatus.Returned && !AwaitingApproval;

    public bool IsInApproval => AwaitingApproval && Status == PayrollStatus.InApproval;

    public static PayrollRun Create(string number, PayrollGroup group, Guid legalEntityId, string legalEntityName, DateOnly from, DateOnly to, string by, DateTimeOffset at) => new()
    {
        Id = Guid.CreateVersion7(),
        RunNo = number,
        Group = group,
        LegalEntityId = legalEntityId,
        LegalEntityName = legalEntityName,
        From = from,
        To = to,
        Status = PayrollStatus.Draft,
        CreatedAt = at,
        CreatedByName = by,
        CalculatedAt = at,
    };

    /// <summary>Replaces the lines and exceptions with a new calculation (only while editable).</summary>
    public Result Calculate(IReadOnlyList<PayrollLine> lines, IReadOnlyList<PayrollExclusion> exceptions, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(lines);
        ArgumentNullException.ThrowIfNull(exceptions);
        if (!IsEditable)
        {
            return Result.Failure(PayrollErrors.NotEditable);
        }

        _lines.Clear();
        _lines.AddRange(lines);
        _exclusions.Clear();
        _exclusions.AddRange(exceptions);
        Totals = PayrollTotals.Of(lines, exceptions);
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

        Status = PayrollStatus.InApproval;
        AwaitingApproval = true;
        SubmittedAt = at;
        return Result.Success();
    }

    /// <summary>The approval could not start: the run stays as it was.</summary>
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

    /// <summary>The approval ended without approving: back to be recalculated and sent again.</summary>
    public void ApprovalEnded(string? comment)
    {
        Status = PayrollStatus.Returned;
        AwaitingApproval = false;
        LastComment = comment;
    }
}

/// <summary>
/// The run's totals, kept with it. <see cref="Allowances"/>: housing, food, transport, other allowances, overtime and
/// additions. <see cref="Deductions"/>: the customer's deductions and loans and the company's internal deductions
/// (absence is in the paid days, not here). <see cref="Excluded"/>: workers of the registration not paid in the run.
/// </summary>
public sealed record PayrollTotals(
    int Workers,
    int Excluded,
    decimal PaidDays,
    decimal Base,
    decimal Housing,
    decimal Food,
    decimal Transport,
    decimal OtherAllowances,
    decimal Overtime,
    decimal Additions,
    decimal Allowances,
    decimal Deductions,
    decimal Net)
{
    public static readonly PayrollTotals Zero = new(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

    public static PayrollTotals Of(IReadOnlyCollection<PayrollLine> lines, IReadOnlyCollection<PayrollExclusion> exceptions) => new(
        lines.Count,
        exceptions.Where(e => e.Kind != PayrollExclusionKind.NetNotPositive).Select(e => e.WorkerId).Distinct().Count(),
        lines.Sum(l => l.PaidDays),
        lines.Sum(l => l.Base),
        lines.Sum(l => l.Housing),
        lines.Sum(l => l.Food),
        lines.Sum(l => l.Transport),
        lines.Sum(l => l.OtherAllowances),
        lines.Sum(l => l.Overtime),
        lines.Sum(l => l.ClientAdditions + l.InternalAdditions),
        lines.Sum(l => l.Allowances),
        lines.Sum(l => l.Deductions),
        lines.Sum(l => l.Net));
}

/// <summary>A worker's pay in a run: the days, the salary by element, what the month added and deducted, and the net.</summary>
public sealed class PayrollLine : ITenantOwned
{
    private readonly List<PayrollLineSource> _sources = [];

    private PayrollLine()
    {
        WorkerNo = string.Empty;
        Name = string.Empty;
        ProjectName = string.Empty;
        Notes = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid RunId { get; private set; }

    public Guid WorkerId { get; private set; }

    public string WorkerNo { get; private set; }

    public string Name { get; private set; }

    public string? ProfessionCode { get; private set; }

    public string? StatusAr { get; private set; }

    public string? StatusEn { get; private set; }

    /// <summary>The project with most of the worker's days in the period (the others are in the sources).</summary>
    public Guid ProjectCrmId { get; private set; }

    public string ProjectName { get; private set; }

    public int Projects { get; private set; }

    /// <summary>The worker's monthly salary on the timesheet.</summary>
    public decimal MonthlySalary { get; private set; }

    public decimal PaidDays { get; private set; }

    public decimal AbsenceDays { get; private set; }

    public decimal Base { get; private set; }

    public decimal Housing { get; private set; }

    public decimal Food { get; private set; }

    public decimal Transport { get; private set; }

    public decimal OtherAllowances { get; private set; }

    public decimal Overtime { get; private set; }

    public decimal ClientAdditions { get; private set; }

    public decimal InternalAdditions { get; private set; }

    public decimal Allowances { get; private set; }

    public decimal ClientDeductions { get; private set; }

    public decimal CustomerLoans { get; private set; }

    public decimal InternalDeductions { get; private set; }

    public decimal Deductions { get; private set; }

    public decimal Net { get; private set; }

    /// <summary>The review notes, comma-separated: absence, joined, left, multi_project, salary_split, net_not_positive.</summary>
    public string Notes { get; private set; }

    public IReadOnlyList<PayrollLineSource> Sources => _sources;

    public static PayrollLine Create(Guid runId, PayrollLineValues v, IReadOnlyList<PayrollLineSource> sources)
    {
        ArgumentNullException.ThrowIfNull(v);
        ArgumentNullException.ThrowIfNull(sources);
        var line = new PayrollLine
        {
            Id = Guid.CreateVersion7(),
            RunId = runId,
            WorkerId = v.WorkerId,
            WorkerNo = v.WorkerNo,
            Name = v.Name,
            ProfessionCode = v.ProfessionCode,
            StatusAr = v.StatusAr,
            StatusEn = v.StatusEn,
            ProjectCrmId = v.ProjectCrmId,
            ProjectName = v.ProjectName,
            Projects = v.Projects,
            MonthlySalary = v.MonthlySalary,
            PaidDays = v.PaidDays,
            AbsenceDays = v.AbsenceDays,
            Base = v.Base,
            Housing = v.Housing,
            Food = v.Food,
            Transport = v.Transport,
            OtherAllowances = v.OtherAllowances,
            Overtime = v.Overtime,
            ClientAdditions = v.ClientAdditions,
            InternalAdditions = v.InternalAdditions,
            Allowances = v.Housing + v.Food + v.Transport + v.OtherAllowances + v.Overtime + v.ClientAdditions + v.InternalAdditions,
            ClientDeductions = v.ClientDeductions,
            CustomerLoans = v.CustomerLoans,
            InternalDeductions = v.InternalDeductions,
            Deductions = v.ClientDeductions + v.CustomerLoans + v.InternalDeductions,
            Net = v.Net,
            Notes = string.Join(',', v.Notes),
        };
        foreach (var source in sources)
        {
            source.AttachTo(runId, line.Id);
            line._sources.Add(source);
        }

        return line;
    }
}

public sealed record PayrollLineValues(
    Guid WorkerId,
    string WorkerNo,
    string Name,
    string? ProfessionCode,
    string? StatusAr,
    string? StatusEn,
    Guid ProjectCrmId,
    string ProjectName,
    int Projects,
    decimal MonthlySalary,
    decimal PaidDays,
    decimal AbsenceDays,
    decimal Base,
    decimal Housing,
    decimal Food,
    decimal Transport,
    decimal OtherAllowances,
    decimal Overtime,
    decimal ClientAdditions,
    decimal InternalAdditions,
    decimal ClientDeductions,
    decimal CustomerLoans,
    decimal InternalDeductions,
    decimal Net,
    IReadOnlyList<string> Notes);

/// <summary>
/// An approved timesheet line paid in a run. A timesheet line is paid once: the key on <see cref="TimesheetLineId"/>
/// keeps it out of any other run (09 §3.0, "consumed").
/// </summary>
public sealed class PayrollLineSource : ITenantOwned
{
    private PayrollLineSource()
    {
        TimesheetNo = string.Empty;
        ProjectName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid RunId { get; private set; }

    public Guid LineId { get; private set; }

    public Guid TimesheetLineId { get; private set; }

    public Guid TimesheetId { get; private set; }

    public string TimesheetNo { get; private set; }

    public Guid ProjectCrmId { get; private set; }

    public string ProjectName { get; private set; }

    public DateOnly LineFrom { get; private set; }

    public DateOnly LineTo { get; private set; }

    public decimal WorkDays { get; private set; }

    public decimal DayDivisor { get; private set; }

    public decimal AbsenceDays { get; private set; }

    public decimal PaySalary { get; private set; }

    /// <summary>The salary the line pays: its days' salary less the absence.</summary>
    public decimal SalaryPart { get; private set; }

    public decimal Overtime { get; private set; }

    public decimal OvertimeHours { get; private set; }

    public decimal ClientAdditions { get; private set; }

    public decimal ClientDeductions { get; private set; }

    public decimal CustomerLoans { get; private set; }

    public decimal InternalAdditions { get; private set; }

    public decimal InternalDeductions { get; private set; }

    /// <summary>The timesheet's own net for the line.</summary>
    public decimal Net { get; private set; }

    public static PayrollLineSource Create(
        Guid timesheetLineId, Guid timesheetId, string timesheetNo, Guid projectCrmId, string projectName, DateOnly lineFrom, DateOnly lineTo,
        decimal workDays, decimal dayDivisor, decimal absenceDays, decimal paySalary, decimal salaryPart, decimal overtime, decimal overtimeHours,
        decimal clientAdditions, decimal clientDeductions, decimal customerLoans, decimal internalAdditions, decimal internalDeductions, decimal net) => new()
    {
        Id = Guid.CreateVersion7(),
        TimesheetLineId = timesheetLineId,
        TimesheetId = timesheetId,
        TimesheetNo = timesheetNo,
        ProjectCrmId = projectCrmId,
        ProjectName = projectName,
        LineFrom = lineFrom,
        LineTo = lineTo,
        WorkDays = workDays,
        DayDivisor = dayDivisor,
        AbsenceDays = absenceDays,
        PaySalary = paySalary,
        SalaryPart = salaryPart,
        Overtime = overtime,
        OvertimeHours = overtimeHours,
        ClientAdditions = clientAdditions,
        ClientDeductions = clientDeductions,
        CustomerLoans = customerLoans,
        InternalAdditions = internalAdditions,
        InternalDeductions = internalDeductions,
        Net = net,
    };

    internal void AttachTo(Guid runId, Guid lineId)
    {
        RunId = runId;
        LineId = lineId;
    }
}

/// <summary>A worker of the registration the run does not pay, and why.</summary>
public sealed class PayrollExclusion : ITenantOwned
{
    private PayrollExclusion()
    {
        WorkerNo = string.Empty;
        Name = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid RunId { get; private set; }

    public PayrollExclusionKind Kind { get; private set; }

    public Guid WorkerId { get; private set; }

    public string WorkerNo { get; private set; }

    public string Name { get; private set; }

    public string? ProjectName { get; private set; }

    /// <summary>The timesheet (or run) concerned, when there is one.</summary>
    public string? Reference { get; private set; }

    public static PayrollExclusion Create(Guid runId, PayrollExclusionKind kind, Guid workerId, string workerNo, string name, string? projectName, string? reference) => new()
    {
        Id = Guid.CreateVersion7(),
        RunId = runId,
        Kind = kind,
        WorkerId = workerId,
        WorkerNo = workerNo,
        Name = name,
        ProjectName = projectName,
        Reference = reference,
    };
}

/// <summary>Which old-system sponsor ("Care-Pro - 05") is which of the company's commercial registrations.</summary>
public sealed class SponsorRegistration : ITenantOwned
{
    private SponsorRegistration()
    {
        Sponsor = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string Sponsor { get; private set; }

    public Guid LegalEntityId { get; private set; }

    public static SponsorRegistration Create(string sponsor, Guid legalEntityId) => new()
    {
        Id = Guid.CreateVersion7(),
        Sponsor = sponsor.Trim(),
        LegalEntityId = legalEntityId,
    };

    public void MoveTo(Guid legalEntityId) => LegalEntityId = legalEntityId;
}

public static class PayrollErrors
{
    public static readonly Error NotFound = Error.NotFound("payroll_run", "Payroll run not found.");
    public static readonly Error NotEditable = Error.Conflict("payroll_not_editable", "Only a draft or returned payroll run can be changed.");
    public static readonly Error Empty = Error.Validation("payroll_empty", "The payroll run has no workers.");
    public static readonly Error Period = Error.Validation("payroll_period", "Choose a period: the end on or after the start, 62 days at most.");
    public static readonly Error LegalEntity = Error.Validation("payroll_legal_entity", "Choose one of the company's commercial registrations.");
    public static readonly Error NoSponsors = Error.Validation("payroll_no_sponsors", "No sponsor of the old system is linked to this registration: link them first.");
    public static readonly Error Overlap = Error.Conflict("payroll_overlap", "Another payroll run of this registration covers part of the period.");
    public static readonly Error Sponsor = Error.Validation("payroll_sponsor", "Enter the sponsor as the old system writes it.");
}
