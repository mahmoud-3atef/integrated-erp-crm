using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Attendance.Domain;

// Closing the attendance month (docs/03-migration-plan/08 §3, 4.5b): HR sends the month for approval with its figures
// frozen per employee; while it is in approval and once it is closed, its days cannot change; the closed figures are what
// the staff payroll (4.8) takes. Overtime counts only by an approved request.

public enum MonthStatus
{
    Open,
    InApproval,
    Closed,
}

/// <summary>An attendance month of the company: its status and, from its sending, each employee's frozen figures.</summary>
public sealed class AttendanceMonth : ITenantOwned
{
    private readonly List<AttendanceMonthLine> lines = [];

    private AttendanceMonth()
    {
        Period = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>"2026-06".</summary>
    public string Period { get; private set; }

    public DateOnly From { get; private set; }

    public DateOnly To { get; private set; }

    public MonthStatus Status { get; private set; }

    public bool AwaitingApproval { get; private set; }

    public string? SubmittedByName { get; private set; }

    public DateTimeOffset? SubmittedAt { get; private set; }

    public DateTimeOffset? ClosedAt { get; private set; }

    /// <summary>The last return, rejection or reopening comment.</summary>
    public string? LastComment { get; private set; }

    public IReadOnlyList<AttendanceMonthLine> Lines => lines;

    public static AttendanceMonth For(string period, DateOnly from, DateOnly to) =>
        new() { Id = Guid.CreateVersion7(), Period = period, From = from, To = to, Status = MonthStatus.Open };

    public bool Covers(DateOnly day) => From <= day && day <= To;

    /// <summary>Sends the month with its figures frozen (the earlier ones replaced).</summary>
    public Result Submit(IEnumerable<AttendanceMonthLine> figures, string by, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(figures);
        if (Status != MonthStatus.Open)
        {
            return Result.Failure(AttendanceErrors.MonthNotOpen);
        }

        lines.Clear();
        lines.AddRange(figures);
        Status = MonthStatus.InApproval;
        AwaitingApproval = true;
        SubmittedByName = by;
        SubmittedAt = at;
        return Result.Success();
    }

    public void Started() => AwaitingApproval = false;

    /// <summary>The engine refused to start: the month is open again.</summary>
    public void SubmissionFailed()
    {
        Status = MonthStatus.Open;
        AwaitingApproval = false;
    }

    public void Close(DateTimeOffset at, string? comment)
    {
        Status = MonthStatus.Closed;
        ClosedAt = at;
        LastComment = comment;
    }

    /// <summary>Returned or rejected: open again for corrections, with the comment.</summary>
    public void BackToOpen(string? comment)
    {
        Status = MonthStatus.Open;
        AwaitingApproval = false;
        LastComment = comment;
    }

    public Result Reopen(string reason)
    {
        if (Status != MonthStatus.Closed)
        {
            return Result.Failure(AttendanceErrors.MonthNotClosed);
        }

        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500)
        {
            return Result.Failure(AttendanceErrors.Reason);
        }

        Status = MonthStatus.Open;
        ClosedAt = null;
        LastComment = reason.Trim();
        return Result.Success();
    }
}

/// <summary>An employee's frozen figures for a sent or closed month (what the staff payroll takes).</summary>
public sealed class AttendanceMonthLine : ITenantOwned
{
    private AttendanceMonthLine()
    {
        EmployeeNo = string.Empty;
        NameEn = string.Empty;
        State = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid MonthId { get; private set; }

    public Guid EmployeeId { get; private set; }

    public string EmployeeNo { get; private set; }

    public string? NameAr { get; private set; }

    public string NameEn { get; private set; }

    public Guid? LegalEntityId { get; private set; }

    public string? DepartmentAr { get; private set; }

    public string? DepartmentEn { get; private set; }

    public string? ShiftAr { get; private set; }

    public string? ShiftEn { get; private set; }

    public int WorkDays { get; private set; }

    public int Present { get; private set; }

    public int Absent { get; private set; }

    public int Leave { get; private set; }

    public int Excused { get; private set; }

    public int LateMinutes { get; private set; }

    public int EarlyMinutes { get; private set; }

    public int MissingPunches { get; private set; }

    /// <summary>Days without pay (unexcused absences and the reviewer's deductions).</summary>
    public decimal DeductionDays { get; private set; }

    /// <summary>Approved overtime in the month.</summary>
    public int OvertimeMinutes { get; private set; }

    public string State { get; private set; }

    public static AttendanceMonthLine Of(
        Guid monthId, Guid employeeId, string employeeNo, string? nameAr, string nameEn, Guid? legalEntityId, string? departmentAr, string? departmentEn,
        string? shiftAr, string? shiftEn, int workDays, int present, int absent, int leave, int excused, int late, int early, int missing, decimal deduction, int overtime, string state) => new()
        {
            Id = Guid.CreateVersion7(),
            MonthId = monthId,
            EmployeeId = employeeId,
            EmployeeNo = employeeNo,
            NameAr = nameAr,
            NameEn = nameEn,
            LegalEntityId = legalEntityId,
            DepartmentAr = departmentAr,
            DepartmentEn = departmentEn,
            ShiftAr = shiftAr,
            ShiftEn = shiftEn,
            WorkDays = workDays,
            Present = present,
            Absent = absent,
            Leave = leave,
            Excused = excused,
            LateMinutes = late,
            EarlyMinutes = early,
            MissingPunches = missing,
            DeductionDays = deduction,
            OvertimeMinutes = overtime,
            State = state,
        };
}

public enum OvertimeStatus
{
    InApproval,
    Returned,
    Rejected,
    Approved,
}

/// <summary>Overtime asked for one employee and day, counted once approved (factor 1.5 in the payroll by default).</summary>
public sealed class OvertimeRequest : ITenantOwned
{
    private OvertimeRequest()
    {
        RequestNo = string.Empty;
        EmployeeName = string.Empty;
        Reason = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string RequestNo { get; private set; }

    public Guid EmployeeId { get; private set; }

    public string EmployeeName { get; private set; }

    public DateOnly Date { get; private set; }

    public int Minutes { get; private set; }

    public string Reason { get; private set; }

    public OvertimeStatus Status { get; private set; }

    public bool AwaitingApproval { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? DecidedAt { get; private set; }

    public string? LastComment { get; private set; }

    public static Result<OvertimeRequest> Create(string requestNo, Guid employeeId, string employeeName, DateOnly date, int minutes, string reason, string by, DateTimeOffset at)
    {
        var request = new OvertimeRequest
        {
            Id = Guid.CreateVersion7(),
            RequestNo = requestNo,
            EmployeeId = employeeId,
            EmployeeName = employeeName.Length > 300 ? employeeName[..300] : employeeName,
            CreatedByName = by,
            CreatedAt = at,
        };
        var set = request.Set(date, minutes, reason);
        return set.IsFailure ? Result.Failure<OvertimeRequest>(set.Error) : Result.Success(request);
    }

    public Result Set(DateOnly date, int minutes, string reason)
    {
        if (minutes is < 15 or > 720 || string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500)
        {
            return Result.Failure(AttendanceErrors.Overtime);
        }

        Date = date;
        Minutes = minutes;
        Reason = reason.Trim();
        Status = OvertimeStatus.InApproval;
        AwaitingApproval = true;
        return Result.Success();
    }

    public void Started() => AwaitingApproval = false;

    public void Ended(OvertimeStatus status, string? comment, DateTimeOffset at)
    {
        Status = status;
        AwaitingApproval = false;
        LastComment = comment;
        DecidedAt = at;
    }
}
