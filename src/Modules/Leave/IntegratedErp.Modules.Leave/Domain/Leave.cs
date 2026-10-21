using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Leave.Domain;

// The staff's leave (docs/02-target-architecture/08 §7, docs/03-migration-plan/09): leave types with the Saudi labour
// law's defaults, balances kept as entries (opening, monthly accrual, consumption, carry-over, adjustment) — never a number
// written over — and leave requests through approval, whose days the attendance then counts as leave.

/// <summary>How a type's days are counted.</summary>
public enum DayCount
{
    /// <summary>Every calendar day of the period (the company's choice by default).</summary>
    Calendar,

    /// <summary>Only the employee's working days: without their rest days and the official holidays.</summary>
    Working,
}

/// <summary>How a leave is paid.</summary>
public enum LeavePay
{
    Full,

    /// <summary>Sick leave by the year's tiers (labour law art. 117): 30 days full, 60 at three quarters, 30 unpaid.</summary>
    SickTiers,

    Unpaid,
}

/// <summary>The company's leave settings.</summary>
public sealed class LeaveSetting : ITenantOwned
{
    private LeaveSetting()
    {
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>How many annual days carry into the next year; null = no limit.</summary>
    public int? CarryOverLimit { get; private set; }

    /// <summary>The monthly permission allowance in minutes (4 hours by default), used by permissions (4.6b).</summary>
    public int PermissionMinutesPerMonth { get; private set; } = 240;

    public static LeaveSetting Default() => new() { Id = Guid.CreateVersion7(), CarryOverLimit = null, PermissionMinutesPerMonth = 240 };

    public Result Set(int? carryOverLimit, int permissionMinutesPerMonth)
    {
        if (carryOverLimit is < 0 or > 365 || permissionMinutesPerMonth is < 0 or > 6000)
        {
            return Result.Failure(LeaveErrors.Setting);
        }

        CarryOverLimit = carryOverLimit;
        PermissionMinutesPerMonth = permissionMinutesPerMonth;
        return Result.Success();
    }
}

public sealed record LeaveTypeValues(
    string NameAr,
    string? NameEn,
    LeavePay Pay,
    bool HasBalance,
    decimal? DaysPerYear,
    decimal? SeniorDaysPerYear,
    int? SeniorAfterYears,
    decimal? MaxDaysPerRequest,
    bool OncePerService,
    DayCount DayCount,
    bool NeedsAttachment,
    bool IsActive,
    int SortOrder);

/// <summary>A leave type and its rules.</summary>
public sealed class LeaveType : ITenantOwned
{
    private LeaveType()
    {
        Code = string.Empty;
        NameAr = string.Empty;
        NameEn = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>A fixed code for the seeded types (annual, sick…); null for those HR adds.</summary>
    public string Code { get; private set; }

    public string NameAr { get; private set; }

    public string NameEn { get; private set; }

    public LeavePay Pay { get; private set; }

    /// <summary>Taken from a balance that accrues monthly (the annual leave).</summary>
    public bool HasBalance { get; private set; }

    /// <summary>The yearly entitlement (accrued monthly for a balance type; otherwise the most per year).</summary>
    public decimal? DaysPerYear { get; private set; }

    public decimal? SeniorDaysPerYear { get; private set; }

    public int? SeniorAfterYears { get; private set; }

    public decimal? MaxDaysPerRequest { get; private set; }

    public bool OncePerService { get; private set; }

    public DayCount DayCount { get; private set; }

    public bool NeedsAttachment { get; private set; }

    public bool IsActive { get; private set; } = true;

    public int SortOrder { get; private set; }

    public static Result<LeaveType> Create(string code, LeaveTypeValues values)
    {
        var type = new LeaveType { Id = Guid.CreateVersion7(), Code = code };
        var set = type.Set(values);
        return set.IsFailure ? Result.Failure<LeaveType>(set.Error) : Result.Success(type);
    }

    public Result Set(LeaveTypeValues v)
    {
        ArgumentNullException.ThrowIfNull(v);
        if (string.IsNullOrWhiteSpace(v.NameAr) || v.NameAr.Trim().Length > 100 || (v.NameEn?.Trim().Length ?? 0) > 100)
        {
            return Result.Failure(LeaveErrors.Name);
        }

        if (v.DaysPerYear is < 0 or > 366 || v.SeniorDaysPerYear is < 0 or > 366 || v.SeniorAfterYears is < 0 or > 60 || v.MaxDaysPerRequest is <= 0 or > 366
            || (v.HasBalance && v.DaysPerYear is null))
        {
            return Result.Failure(LeaveErrors.TypeRules);
        }

        NameAr = v.NameAr.Trim();
        NameEn = string.IsNullOrWhiteSpace(v.NameEn) ? NameAr : v.NameEn.Trim();
        Pay = v.Pay;
        HasBalance = v.HasBalance;
        DaysPerYear = v.DaysPerYear;
        SeniorDaysPerYear = v.SeniorDaysPerYear;
        SeniorAfterYears = v.SeniorAfterYears;
        MaxDaysPerRequest = v.MaxDaysPerRequest;
        OncePerService = v.OncePerService;
        DayCount = v.DayCount;
        NeedsAttachment = v.NeedsAttachment;
        IsActive = v.IsActive;
        SortOrder = v.SortOrder;
        return Result.Success();
    }

    /// <summary>The yearly entitlement for a length of service (30 days after 5 years for the annual leave by default).</summary>
    public decimal Entitlement(double yearsOfService) =>
        SeniorDaysPerYear is { } senior && SeniorAfterYears is { } after && yearsOfService >= after ? senior : DaysPerYear ?? 0;
}

public enum EntryKind
{
    Opening,
    Accrual,
    Consumption,
    CarryOver,
    Adjustment,

    /// <summary>A consumption given back (a cancelled approved leave).</summary>
    Reversal,

    /// <summary>An accrual taken back because an opening balance entered later already includes it.</summary>
    AccrualReversal,
}

/// <summary>One movement of an employee's balance of a type; the balance is their sum.</summary>
public sealed class BalanceEntry : ITenantOwned
{
    private BalanceEntry()
    {
        Reason = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid EmployeeId { get; private set; }

    public Guid LeaveTypeId { get; private set; }

    public DateOnly Date { get; private set; }

    public EntryKind Kind { get; private set; }

    /// <summary>Days added (positive) or taken (negative).</summary>
    public decimal Days { get; private set; }

    public string Reason { get; private set; }

    /// <summary>The month an accrual is for ("2026-10"): one accrual per employee, type and month.</summary>
    public string? Period { get; private set; }

    public Guid? RequestId { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static BalanceEntry Of(Guid employeeId, Guid typeId, DateOnly date, EntryKind kind, decimal days, string reason, string? period, Guid? requestId, string by, DateTimeOffset at) => new()
    {
        Id = Guid.CreateVersion7(),
        EmployeeId = employeeId,
        LeaveTypeId = typeId,
        Date = date,
        Kind = kind,
        Days = decimal.Round(days, 2),
        Reason = reason.Length > 300 ? reason[..300] : reason,
        Period = period,
        RequestId = requestId,
        CreatedByName = by,
        CreatedAt = at,
    };
}

public enum RequestStatus
{
    InApproval,
    Returned,
    Rejected,
    Approved,
    Cancelled,
}

/// <summary>A leave asked for one employee, from a day to a day, through approval.</summary>
public sealed class LeaveRequest : ITenantOwned
{
    private LeaveRequest()
    {
        RequestNo = string.Empty;
        EmployeeName = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string RequestNo { get; private set; }

    public Guid EmployeeId { get; private set; }

    public string EmployeeName { get; private set; }

    public Guid LeaveTypeId { get; private set; }

    public DateOnly From { get; private set; }

    public DateOnly To { get; private set; }

    /// <summary>The leave's days as its type counts them.</summary>
    public decimal Days { get; private set; }

    public string? Reason { get; private set; }

    public Guid? SubstituteId { get; private set; }

    public string? SubstituteName { get; private set; }

    public bool Ticket { get; private set; }

    /// <summary>The direct manager's sign-in account when the request was sent (the process's first stage).</summary>
    public Guid? ManagerUserId { get; private set; }

    public RequestStatus Status { get; private set; }

    public bool AwaitingApproval { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? DecidedAt { get; private set; }

    public string? LastComment { get; private set; }

    /// <summary>The day the employee was back at work (HR confirms it after the leave).</summary>
    public DateOnly? ReturnedOn { get; private set; }

    /// <summary>The last change after the approval: when, by whom and why (each change is in the audit log too).</summary>
    public DateTimeOffset? AmendedAt { get; private set; }

    public string? AmendedByName { get; private set; }

    public string? AmendNote { get; private set; }

    /// <summary>Cancelled after its approval: when and by whom (the reason is the last comment).</summary>
    public DateTimeOffset? CanceledAt { get; private set; }

    public string? CanceledByName { get; private set; }

    public string? ReturnNote { get; private set; }

    public bool Holds => Status is RequestStatus.InApproval or RequestStatus.Approved;

    /// <summary>The return is confirmed; back early, the leave ends the day before and its days are recounted.</summary>
    public void Returned(DateOnly on, string? note, decimal? days)
    {
        ReturnedOn = on;
        ReturnNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim()[..Math.Min(note.Trim().Length, 500)];
        if (on <= To && on > From && days is { } d)
        {
            To = on.AddDays(-1);
            Days = d;
        }
    }


    /// <summary>Changed after its approval: the days, the reason, the substitute and the ticket (with the reason for the change).</summary>
    public Result Amend(DateOnly from, DateOnly to, decimal days, string? reason, Guid? substituteId, string? substituteName, bool ticket, string amendReason, string by, DateTimeOffset at)
    {
        if (Status != RequestStatus.Approved)
        {
            return Result.Failure(LeaveErrors.NotAmendable);
        }

        if (string.IsNullOrWhiteSpace(amendReason) || amendReason.Trim().Length > 500)
        {
            return Result.Failure(LeaveErrors.AmendReason);
        }

        if (to < from || days <= 0 || (reason?.Length ?? 0) > 500)
        {
            return Result.Failure(LeaveErrors.Dates);
        }

        From = from;
        To = to;
        Days = days;
        Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        SubstituteId = substituteId;
        SubstituteName = substituteName;
        Ticket = ticket;
        AmendedAt = at;
        AmendedByName = by;
        AmendNote = amendReason.Trim();
        return Result.Success();
    }

    /// <summary>Cancelled after its approval, started or not (its days were given back to the balance).</summary>
    public Result CancelApproved(string reason, string by, DateTimeOffset at)
    {
        if (Status != RequestStatus.Approved)
        {
            return Result.Failure(LeaveErrors.NotAmendable);
        }

        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500)
        {
            return Result.Failure(LeaveErrors.AmendReason);
        }

        Status = RequestStatus.Cancelled;
        LastComment = reason.Trim();
        CanceledAt = at;
        CanceledByName = by;
        return Result.Success();
    }

    public static LeaveRequest Create(string requestNo, Guid employeeId, string employeeName, string by, DateTimeOffset at) => new()
    {
        Id = Guid.CreateVersion7(),
        RequestNo = requestNo,
        EmployeeId = employeeId,
        EmployeeName = employeeName.Length > 300 ? employeeName[..300] : employeeName,
        CreatedByName = by,
        CreatedAt = at,
    };

    public Result Set(Guid typeId, DateOnly from, DateOnly to, decimal days, string? reason, Guid? substituteId, string? substituteName, bool ticket, Guid? managerUserId)
    {
        if (to < from || days <= 0 || (reason?.Length ?? 0) > 500)
        {
            return Result.Failure(LeaveErrors.Dates);
        }

        LeaveTypeId = typeId;
        From = from;
        To = to;
        Days = days;
        Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        SubstituteId = substituteId;
        SubstituteName = substituteName;
        Ticket = ticket;
        ManagerUserId = managerUserId;
        Status = RequestStatus.InApproval;
        AwaitingApproval = true;
        return Result.Success();
    }

    public void Started() => AwaitingApproval = false;

    public void Ended(RequestStatus status, string? comment, DateTimeOffset at)
    {
        Status = status;
        AwaitingApproval = false;
        LastComment = comment;
        DecidedAt = at;
    }
}

public enum PermissionKind
{
    /// <summary>Arriving late.</summary>
    LateArrival,

    /// <summary>Leaving early.</summary>
    EarlyLeave,

    /// <summary>Out during the day.</summary>
    During,

    /// <summary>A work mission: not taken from the monthly allowance.</summary>
    Mission,
}

/// <summary>A permission of some hours on a day, through approval: its minutes are not counted as late or early.</summary>
public sealed class PermissionRequest : ITenantOwned
{
    private PermissionRequest()
    {
        RequestNo = string.Empty;
        EmployeeName = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string RequestNo { get; private set; }

    public Guid EmployeeId { get; private set; }

    public string EmployeeName { get; private set; }

    public DateOnly Date { get; private set; }

    public TimeOnly FromTime { get; private set; }

    public TimeOnly ToTime { get; private set; }

    public int Minutes { get; private set; }

    public PermissionKind Kind { get; private set; }

    public string? Reason { get; private set; }

    public Guid? ManagerUserId { get; private set; }

    public RequestStatus Status { get; private set; }

    public bool AwaitingApproval { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? DecidedAt { get; private set; }

    public string? LastComment { get; private set; }

    public static PermissionRequest Create(string requestNo, Guid employeeId, string employeeName, string by, DateTimeOffset at) => new()
    {
        Id = Guid.CreateVersion7(),
        RequestNo = requestNo,
        EmployeeId = employeeId,
        EmployeeName = employeeName.Length > 300 ? employeeName[..300] : employeeName,
        CreatedByName = by,
        CreatedAt = at,
    };

    public Result Set(DateOnly date, TimeOnly from, TimeOnly to, PermissionKind kind, string? reason, Guid? managerUserId)
    {
        var minutes = (int)(to - from).TotalMinutes;
        if (to <= from || minutes is < 15 or > 480 || (reason?.Length ?? 0) > 500)
        {
            return Result.Failure(LeaveErrors.PermissionTimes);
        }

        Date = date;
        FromTime = from;
        ToTime = to;
        Minutes = minutes;
        Kind = kind;
        Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        ManagerUserId = managerUserId;
        Status = RequestStatus.InApproval;
        AwaitingApproval = true;
        return Result.Success();
    }

    public void Started() => AwaitingApproval = false;

    public void Ended(RequestStatus status, string? comment, DateTimeOffset at)
    {
        Status = status;
        AwaitingApproval = false;
        LastComment = comment;
        DecidedAt = at;
    }
}

public static class LeaveErrors
{
    public static readonly Error PermissionNotFound = Error.NotFound("leave_permission", "Permission request not found.");
    public static readonly Error PermissionTimes = Error.Validation("leave_permission_times", "A permission is 15 minutes to 8 hours, its end after its start, with a reason of 500 characters at most.");
    public static readonly Error OnLeave = Error.Conflict("leave_permission_on_leave", "The employee is on leave that day.");
    public static readonly Error NotReturnable = Error.Conflict("leave_not_returnable", "Only an approved leave that has started can have its return confirmed, on a day after its start.");
    public static readonly Error TypeNotFound = Error.NotFound("leave_type", "Leave type not found.");
    public static readonly Error RequestNotFound = Error.NotFound("leave_request", "Leave request not found.");
    public static readonly Error EmployeeNotFound = Error.NotFound("leave_employee", "Employee not found.");
    public static readonly Error Name = Error.Validation("leave_name", "Enter the name (Arabic required, 100 characters at most).");
    public static readonly Error TypeRules = Error.Validation("leave_type_rules", "The type's days are not valid (a balance type needs its days per year).");
    public static readonly Error Setting = Error.Validation("leave_setting", "A setting is out of range.");
    public static readonly Error Dates = Error.Validation("leave_dates", "The end is before the start, the period has no days to take, or the reason is too long.");
    public static readonly Error NotEmployed = Error.Validation("leave_not_employed", "The period is outside the employee's employment.");
    public static readonly Error Overlap = Error.Conflict("leave_overlap", "The employee has another leave in this period.");
    public static readonly Error Balance = Error.Conflict("leave_balance", "The balance does not cover these days.");
    public static readonly Error TooLong = Error.Validation("leave_too_long", "The type allows fewer days in one request.");
    public static readonly Error Once = Error.Conflict("leave_once", "This leave is taken once in the service, and was taken.");
    public static readonly Error YearLimit = Error.Conflict("leave_year_limit", "This leave's days for the year are used up.");
    public static readonly Error Locked = Error.Conflict("leave_month_locked", "A day of the period is in an attendance month that is closing or closed.");
    public static readonly Error NotReturned = Error.Conflict("leave_not_returned", "Only a returned request can be sent again.");
    public static readonly Error Entry = Error.Validation("leave_entry", "Give the days (not zero), the date and the reason.");
    public static readonly Error OpeningExists = Error.Conflict("leave_opening_exists", "The employee already has an opening balance for this type: correct it with an adjustment.");
    public static readonly Error NotCancellable = Error.Conflict("leave_not_cancellable", "Only an approved leave that has not started can be cancelled.");
    public static readonly Error NotAmendable = Error.Conflict("leave_not_amendable", "Only an approved leave can be changed or cancelled after its approval.");
    public static readonly Error AmendReason = Error.Validation("leave_amend_reason", "Give the reason (500 characters at most).");
    public static readonly Error Settled = Error.Conflict("leave_settled", "A settlement was made from this leave: cancel the settlement first.");
}
