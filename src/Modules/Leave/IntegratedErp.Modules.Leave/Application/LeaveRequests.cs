using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Attendance.Contracts;
using IntegratedErp.Modules.Leave.Contracts;
using IntegratedErp.Modules.Leave.Domain;
using IntegratedErp.Modules.Leave.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Leave.Application;

public sealed record LeaveInput(Guid EmployeeId, Guid LeaveTypeId, DateOnly From, DateOnly To, string? Reason, Guid? SubstituteId, bool Ticket);

/// <summary>The sick days of a request by the year's tiers (full pay, three quarters, unpaid).</summary>
public sealed record SickSplit(decimal Full, decimal ThreeQuarters, decimal Unpaid);

public sealed record LeavePreview(
    decimal Days,
    int CalendarDays,
    string DayCount,
    decimal? Available,
    decimal? After,
    DateOnly ReturnsOn,
    SickSplit? Sick,
    string? ManagerName,
    bool ManagerLinked,
    IReadOnlyList<string> Problems);

/// <summary>
/// Leave requests: the preview (days as the type counts them, the balance before and after, the return day, the sick
/// tiers, the direct manager), the request through approval, and its end — approved ⇒ the balance is consumed and the
/// attendance shows the days as leave.
/// </summary>
internal sealed class LeaveRequests(
    LeaveDbContext db,
    IStaffDirectory staff,
    IAttendanceCalendar calendar,
    LeaveBalances balances,
    LeaveSetup setup,
    NumberSequenceService numbering,
    IApprovalService approvals,
    ICurrentUser user,
    IClock clock)
{
    public async Task<Result<LeavePreview>> PreviewAsync(LeaveInput input, Guid? requestId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        await setup.SettingAsync(cancellationToken).ConfigureAwait(false);
        var member = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(m => m.Id == input.EmployeeId);
        if (member is null)
        {
            return Result.Failure<LeavePreview>(LeaveErrors.EmployeeNotFound);
        }

        if (await db.Types.AsNoTracking().FirstOrDefaultAsync(t => t.Id == input.LeaveTypeId, cancellationToken).ConfigureAwait(false) is not { } type)
        {
            return Result.Failure<LeavePreview>(LeaveErrors.TypeNotFound);
        }

        if (input.To < input.From || input.To.DayNumber - input.From.DayNumber > 366)
        {
            return Result.Failure<LeavePreview>(LeaveErrors.Dates);
        }

        var calendarDays = input.To.DayNumber - input.From.DayNumber + 1;
        decimal days = type.DayCount == DayCount.Working ? await calendar.WorkingDaysAsync(member.Id, input.From, input.To, cancellationToken).ConfigureAwait(false) : calendarDays;
        var problems = new List<string>();
        if (days <= 0)
        {
            problems.Add("no_days");
        }

        if ((member.HireDate is { } hired && input.From < hired) || (member.EndedOn is { } ended ? input.To > ended : member.Status == "Left"))
        {
            problems.Add("not_employed");
        }

        if (type.MaxDaysPerRequest is { } max && days > max)
        {
            problems.Add("too_long");
        }

        var holding = await db.Requests.AsNoTracking()
            .Where(r => r.EmployeeId == member.Id && r.Id != requestId && (r.Status == RequestStatus.InApproval || r.Status == RequestStatus.Approved))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        if (holding.Any(r => r.From <= input.To && r.To >= input.From))
        {
            problems.Add("overlap");
        }

        if (type.OncePerService && holding.Any(r => r.LeaveTypeId == type.Id))
        {
            problems.Add("once");
        }

        SickSplit? sick = null;
        if (!type.HasBalance && type.DaysPerYear is { } perYear)
        {
            var taken = holding.Where(r => r.LeaveTypeId == type.Id && r.From.Year == input.From.Year).Sum(r => r.Days);
            if (taken + days > perYear)
            {
                problems.Add("year_limit");
            }

            if (type.Pay == LeavePay.SickTiers)
            {
                sick = Split(taken, days);
            }
        }

        decimal? available = null;
        if (type.HasBalance)
        {
            available = (await balances.BalanceAsync(member.Id, type.Id, requestId, cancellationToken).ConfigureAwait(false)).Available;
            if (available < days)
            {
                problems.Add("balance");
            }
        }

        if (await calendar.LockedAsync(input.From, input.To, cancellationToken).ConfigureAwait(false))
        {
            problems.Add("month_locked");
        }

        var manager = await staff.ManagerAsync(member.Id, cancellationToken).ConfigureAwait(false);
        var returns = await calendar.NextWorkingDayAsync(member.Id, input.To, cancellationToken).ConfigureAwait(false);
        return Result.Success(new LeavePreview(
            days, calendarDays, type.DayCount.ToString(), available, available - days, returns, sick, manager?.Name, manager?.UserId is not null, problems));
    }

    public async Task<Result<Guid>> RequestAsync(LeaveInput input, CancellationToken cancellationToken)
    {
        var preview = await PreviewAsync(input, null, cancellationToken).ConfigureAwait(false);
        if (preview.IsFailure)
        {
            return Result.Failure<Guid>(preview.Error);
        }

        if (Refusal(preview.Value) is { } refused)
        {
            return Result.Failure<Guid>(refused);
        }

        var members = await staff.MembersAsync(cancellationToken).ConfigureAwait(false);
        var member = members.First(m => m.Id == input.EmployeeId);
        var substitute = input.SubstituteId is { } sid ? members.FirstOrDefault(m => m.Id == sid) : null;
        var manager = await staff.ManagerAsync(member.Id, cancellationToken).ConfigureAwait(false);

        // Gap-free numbering: the number is taken in the transaction that saves the request.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, LeaveModule.RequestSequence, input.From, cancellationToken).ConfigureAwait(false);
        var request = LeaveRequest.Create(number, member.Id, member.NameAr ?? member.NameEn, user.DisplayName, clock.UtcNow);
        var set = request.Set(input.LeaveTypeId, input.From, input.To, preview.Value.Days, input.Reason, substitute?.Id, substitute is null ? null : substitute.NameAr ?? substitute.NameEn, input.Ticket, manager?.UserId);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        db.Requests.Add(request);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return await SendAsync(request, member.LegalEntityId, cancellationToken).ConfigureAwait(false);
    }

    public async Task<Result<Guid>> ResubmitAsync(Guid id, LeaveInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (await db.Requests.FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false) is not { } request)
        {
            return Result.Failure<Guid>(LeaveErrors.RequestNotFound);
        }

        if (request.Status != RequestStatus.Returned)
        {
            return Result.Failure<Guid>(LeaveErrors.NotReturned);
        }

        var preview = await PreviewAsync(input with { EmployeeId = request.EmployeeId }, id, cancellationToken).ConfigureAwait(false);
        if (preview.IsFailure)
        {
            return Result.Failure<Guid>(preview.Error);
        }

        if (Refusal(preview.Value) is { } refused)
        {
            return Result.Failure<Guid>(refused);
        }

        var members = await staff.MembersAsync(cancellationToken).ConfigureAwait(false);
        var substitute = input.SubstituteId is { } sid ? members.FirstOrDefault(m => m.Id == sid) : null;
        var manager = await staff.ManagerAsync(request.EmployeeId, cancellationToken).ConfigureAwait(false);
        var set = request.Set(input.LeaveTypeId, input.From, input.To, preview.Value.Days, input.Reason, substitute?.Id, substitute is null ? null : substitute.NameAr ?? substitute.NameEn, input.Ticket, manager?.UserId);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return await SendAsync(request, members.FirstOrDefault(m => m.Id == request.EmployeeId)?.LegalEntityId, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>An approved leave not yet started is cancelled: its days are given back to the balance.</summary>
    public async Task<Result> CancelAsync(Guid id, string reason, CancellationToken cancellationToken)
    {
        if (await db.Requests.FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false) is not { } request)
        {
            return Result.Failure(LeaveErrors.RequestNotFound);
        }

        if (request.Status != RequestStatus.Approved || request.From <= clock.Today || string.IsNullOrWhiteSpace(reason))
        {
            return Result.Failure(LeaveErrors.NotCancellable);
        }

        if (await calendar.LockedAsync(request.From, request.To, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(LeaveErrors.Locked);
        }

        if (await db.Types.AsNoTracking().AnyAsync(t => t.Id == request.LeaveTypeId && t.HasBalance, cancellationToken).ConfigureAwait(false))
        {
            db.Entries.Add(BalanceEntry.Of(request.EmployeeId, request.LeaveTypeId, request.From, EntryKind.Reversal, request.Days, $"إلغاء {request.RequestNo}: {reason.Trim()}", null, request.Id, user.DisplayName, clock.UtcNow));
        }

        request.Ended(RequestStatus.Cancelled, reason.Trim(), clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>
    /// HR confirms the day the employee was back at work. Back early, the leave ends the day before and the days not taken
    /// go back to the balance; back late, the days after the expected return are absences in the attendance.
    /// </summary>
    public async Task<Result> ConfirmReturnAsync(Guid id, ReturnInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (await db.Requests.FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false) is not { } request)
        {
            return Result.Failure(LeaveErrors.RequestNotFound);
        }

        if (request.Status != RequestStatus.Approved || request.From > clock.Today || input.ReturnedOn <= request.From || input.ReturnedOn > clock.Today.AddDays(1))
        {
            return Result.Failure(LeaveErrors.NotReturnable);
        }

        var type = await db.Types.AsNoTracking().FirstAsync(t => t.Id == request.LeaveTypeId, cancellationToken).ConfigureAwait(false);
        decimal? days = null;
        if (input.ReturnedOn <= request.To)
        {
            if (await calendar.LockedAsync(input.ReturnedOn, request.To, cancellationToken).ConfigureAwait(false))
            {
                return Result.Failure(LeaveErrors.Locked);
            }

            var end = input.ReturnedOn.AddDays(-1);
            days = type.DayCount == DayCount.Working ? await calendar.WorkingDaysAsync(request.EmployeeId, request.From, end, cancellationToken).ConfigureAwait(false) : end.DayNumber - request.From.DayNumber + 1;
            var back = request.Days - days.Value;
            if (type.HasBalance && back > 0)
            {
                db.Entries.Add(BalanceEntry.Of(request.EmployeeId, request.LeaveTypeId, input.ReturnedOn, EntryKind.Reversal, back, $"عودة مبكرة {request.RequestNo}", null, request.Id, user.DisplayName, clock.UtcNow));
            }
        }

        request.Returned(input.ReturnedOn, input.Note, days);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    private static Error? Refusal(LeavePreview p) => (p.Problems.Count > 0 ? p.Problems[0] : null) switch
    {
        null => null,
        "no_days" => LeaveErrors.Dates,
        "not_employed" => LeaveErrors.NotEmployed,
        "too_long" => LeaveErrors.TooLong,
        "overlap" => LeaveErrors.Overlap,
        "once" => LeaveErrors.Once,
        "year_limit" => LeaveErrors.YearLimit,
        "balance" => LeaveErrors.Balance,
        _ => LeaveErrors.Locked,
    };

    /// <summary>Labour law art. 117: in a year, the first 30 sick days at full pay, the next 60 at three quarters, the next 30 unpaid.</summary>
    internal static SickSplit Split(decimal taken, decimal days)
    {
        decimal Part(decimal from, decimal to) => Math.Max(0, Math.Min(taken + days, to) - Math.Max(taken, from));
        return new SickSplit(Part(0, 30), Part(30, 90), Part(90, 120) + Math.Max(0, taken + days - Math.Max(taken, 120)));
    }

    private async Task<Result<Guid>> SendAsync(LeaveRequest request, Guid? legalEntityId, CancellationToken cancellationToken)
    {
        var started = await approvals.SubmitAsync(new ApprovalSubmission(LeaveAdapter.ScreenCode, request.Id, $"{request.RequestNo} — {request.EmployeeName}", legalEntityId), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            request.Ended(RequestStatus.Returned, null, clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure<Guid>(started.Error);
        }

        return Result.Success(request.Id);
    }
}

/// <summary>
/// The leave request as the approval engine sees it. Default process: the direct manager (when linked to an account),
/// then HR, then senior management for unpaid leave or more than 15 days — editable in the approval processes screen.
/// </summary>
internal sealed class LeaveAdapter(LeaveDbContext db, IClock clock) : IApprovalRecordAdapter
{
    public const string ScreenCode = "leave.request";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly string DefaultDefinition = JsonSerializer.Serialize(
        new
        {
            startCondition = (object?)null,
            steps = new object[]
            {
                new
                {
                    type = "condition", id = "has-manager",
                    branches = new[]
                    {
                        new
                        {
                            condition = new { matchAll = true, rules = new[] { new { fieldKey = "manager", @operator = "IsNotEmpty" } } },
                            steps = new object[]
                            {
                                new
                                {
                                    type = "approval", id = "manager", label = "المدير المباشر",
                                    nameAr = "المدير المباشر", nameEn = "Direct manager",
                                    assignees = new[] { new { kind = "UserField", fieldKey = "manager" } }, rule = "Any",
                                },
                            },
                        },
                    },
                },
                new
                {
                    type = "approval", id = "hr", label = "الموارد البشرية",
                    nameAr = "الموارد البشرية", nameEn = "HR",
                    assignees = new[] { new { kind = "Permission", permission = LeavePermissions.Approve } }, rule = "Any",
                },
                new
                {
                    type = "condition", id = "management",
                    branches = new[]
                    {
                        new
                        {
                            condition = new
                            {
                                matchAll = false,
                                rules = new object[] { new { fieldKey = "days", @operator = "GreaterThan", value = "15" }, new { fieldKey = "pay", @operator = "Equals", value = nameof(LeavePay.Unpaid) } },
                            },
                            steps = new object[]
                            {
                                new
                                {
                                    type = "approval", id = "senior", label = "الإدارة العليا",
                                    nameAr = "الإدارة العليا", nameEn = "Senior management",
                                    assignees = new[] { new { kind = "Permission", permission = LeavePermissions.ApproveManagement } }, rule = "Any",
                                },
                            },
                        },
                    },
                },
            },
        },
        JsonOptions);

    private static readonly RecordFieldOption[] Pays =
    [
        new(nameof(LeavePay.Full), "بأجر كامل", "Full pay", Settable: false),
        new(nameof(LeavePay.SickTiers), "مرضية بالشرائح", "Sick tiers", Settable: false),
        new(nameof(LeavePay.Unpaid), "بدون راتب", "Unpaid", Settable: false),
    ];

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "طلبات الإجازة",
        "Leave requests",
        "/hr/leave/{id}",
        [
            new("employee", "الموظف", "Employee", RecordFieldType.Text, Updatable: false),
            new("type", "نوع الإجازة", "Leave type", RecordFieldType.Text, Updatable: false),
            new("days", "الأيام", "Days", RecordFieldType.Number, Updatable: false),
            new("from", "من", "From", RecordFieldType.Date, Updatable: false),
            new("pay", "الأجر", "Pay", RecordFieldType.Choice, Updatable: false, Pays),
            new("manager", "المدير المباشر", "Direct manager", RecordFieldType.User, Updatable: false),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد الإجازات", "Leave approval", DefaultDefinition));

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var r = await db.Requests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (r is null)
        {
            return null;
        }

        var type = await db.Types.AsNoTracking().FirstOrDefaultAsync(t => t.Id == r.LeaveTypeId, cancellationToken).ConfigureAwait(false);
        return new Dictionary<string, string?>
        {
            ["employee"] = r.EmployeeName,
            ["type"] = type?.NameAr,
            ["days"] = r.Days.ToString(CultureInfo.InvariantCulture),
            ["from"] = r.From.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["pay"] = type?.Pay.ToString(),
            ["manager"] = r.ManagerUserId?.ToString(),
        };
    }

    public Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("leave_field_not_settable", "A process cannot change a leave request.")));

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        if (await db.Requests.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false) is not { } request)
        {
            return Result.Failure(LeaveErrors.RequestNotFound);
        }

        request.Started();
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        if (await db.Requests.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false) is not { Status: RequestStatus.InApproval } request)
        {
            return;
        }

        if (end == ApprovalEnd.Approved)
        {
            if (await db.Types.AsNoTracking().AnyAsync(t => t.Id == request.LeaveTypeId && t.HasBalance, cancellationToken).ConfigureAwait(false))
            {
                db.Entries.Add(BalanceEntry.Of(request.EmployeeId, request.LeaveTypeId, request.From, EntryKind.Consumption, -request.Days, request.RequestNo, null, request.Id, "approval", clock.UtcNow));
            }

            request.Ended(RequestStatus.Approved, comment, clock.UtcNow);
        }
        else
        {
            request.Ended(end == ApprovalEnd.Rejected ? RequestStatus.Rejected : RequestStatus.Returned, comment, clock.UtcNow);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}

/// <summary>The approved leaves for the attendance.</summary>
internal sealed class ApprovedLeaves(LeaveDbContext db) : IApprovedLeaves
{
    public async Task<IReadOnlyList<ApprovedLeave>> InAsync(DateOnly from, DateOnly to, Guid? employeeId, CancellationToken cancellationToken)
    {
        var (start, end) = (from, to);
        var query = from r in db.Requests.AsNoTracking()
                    join t in db.Types.AsNoTracking() on r.LeaveTypeId equals t.Id
                    where r.Status == RequestStatus.Approved && r.From <= end && r.To >= start && (employeeId == null || r.EmployeeId == employeeId)
                    select new ApprovedLeave(r.Id, r.RequestNo, r.EmployeeId, r.From, r.To, t.NameAr, t.NameEn, t.Pay.ToString());
        return await query.ToListAsync(cancellationToken).ConfigureAwait(false);
    }
}
