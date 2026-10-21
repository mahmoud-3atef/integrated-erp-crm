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

public sealed record PermissionInput(Guid EmployeeId, DateOnly Date, TimeOnly From, TimeOnly To, string Kind, string? Reason);

public sealed record PermissionPreview(int Minutes, int Allowance, int UsedThisMonth, int Remaining, int OverAllowance, bool Mission, string? ManagerName, bool ManagerLinked, IReadOnlyList<string> Problems);

public sealed record PermissionDto(
    Guid Id,
    string RequestNo,
    Guid EmployeeId,
    string EmployeeName,
    DateOnly Date,
    TimeOnly From,
    TimeOnly To,
    int Minutes,
    string Kind,
    string? Reason,
    string Status,
    string CreatedByName,
    DateTimeOffset CreatedAt,
    DateTimeOffset? DecidedAt,
    string? LastComment,
    ApprovalStatusInfo? Approval,
    bool CanAmend = false,
    bool CanCancelApproved = false,
    DateTimeOffset? AmendedAt = null,
    string? AmendedByName = null,
    string? AmendNote = null,
    DateTimeOffset? CanceledAt = null,
    string? CanceledByName = null);

public sealed record ReturnInput(DateOnly ReturnedOn, string? Note);

/// <summary>What may change on an approved permission: its day, times, kind and reason, with the reason for the change.</summary>
public sealed record PermissionAmendInput(DateOnly Date, TimeOnly From, TimeOnly To, string Kind, string? Reason, string AmendReason);

/// <summary>
/// Permissions (استئذان) of some hours on a day: the preview (the month's allowance used and what is left), the request
/// through approval (the direct manager, else HR), and what the attendance waives once approved.
/// </summary>
internal sealed class LeavePermissionService(
    LeaveDbContext db,
    IStaffDirectory staff,
    IAttendanceCalendar calendar,
    LeaveSetup setup,
    NumberSequenceService numbering,
    IApprovalService approvals,
    ICurrentUser user,
    IClock clock)
{
    public async Task<Result<PermissionPreview>> PreviewAsync(PermissionInput input, Guid? requestId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var setting = await setup.SettingAsync(cancellationToken).ConfigureAwait(false);
        var member = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(m => m.Id == input.EmployeeId);
        if (member is null)
        {
            return Result.Failure<PermissionPreview>(LeaveErrors.EmployeeNotFound);
        }

        if (!Enum.TryParse<PermissionKind>(input.Kind, out var kind) || input.To <= input.From)
        {
            return Result.Failure<PermissionPreview>(LeaveErrors.PermissionTimes);
        }

        var minutes = (int)(input.To - input.From).TotalMinutes;
        var problems = new List<string>();
        if (minutes is < 15 or > 480)
        {
            problems.Add("times");
        }

        if ((member.HireDate is { } h && input.Date < h) || (member.EndedOn is { } e ? input.Date > e : member.Status == "Left"))
        {
            problems.Add("not_employed");
        }

        if (await db.Requests.AsNoTracking().AnyAsync(r => r.EmployeeId == member.Id && (r.Status == RequestStatus.Approved || r.Status == RequestStatus.InApproval) && r.From <= input.Date && r.To >= input.Date, cancellationToken).ConfigureAwait(false))
        {
            problems.Add("on_leave");
        }

        if (await calendar.LockedAsync(input.Date, input.Date, cancellationToken).ConfigureAwait(false))
        {
            problems.Add("month_locked");
        }

        var first = new DateOnly(input.Date.Year, input.Date.Month, 1);
        var used = await db.Permissions.AsNoTracking()
            .Where(p => p.EmployeeId == member.Id && p.Id != requestId && p.Kind != PermissionKind.Mission && p.Date >= first && p.Date <= first.AddMonths(1).AddDays(-1)
                && (p.Status == RequestStatus.Approved || p.Status == RequestStatus.InApproval))
            .SumAsync(p => (int?)p.Minutes, cancellationToken).ConfigureAwait(false) ?? 0;
        var allowance = setting.PermissionMinutesPerMonth;
        var remaining = Math.Max(0, allowance - used);
        var mission = kind == PermissionKind.Mission;
        var manager = await staff.ManagerAsync(member.Id, cancellationToken).ConfigureAwait(false);
        return Result.Success(new PermissionPreview(minutes, allowance, used, remaining, mission ? 0 : Math.Max(0, minutes - remaining), mission, manager?.Name, manager?.UserId is not null, problems));
    }

    public async Task<Result<Guid>> RequestAsync(PermissionInput input, CancellationToken cancellationToken)
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

        var member = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).First(m => m.Id == input.EmployeeId);
        var manager = await staff.ManagerAsync(member.Id, cancellationToken).ConfigureAwait(false);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, LeaveModule.PermissionSequence, input.Date, cancellationToken).ConfigureAwait(false);
        var request = PermissionRequest.Create(number, member.Id, member.NameAr ?? member.NameEn, user.DisplayName, clock.UtcNow);
        var set = request.Set(input.Date, input.From, input.To, Enum.Parse<PermissionKind>(input.Kind), input.Reason, manager?.UserId);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        db.Permissions.Add(request);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return await SendAsync(request, member.LegalEntityId, cancellationToken).ConfigureAwait(false);
    }

    public async Task<Result<Guid>> ResubmitAsync(Guid id, PermissionInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (await db.Permissions.FirstOrDefaultAsync(p => p.Id == id, cancellationToken).ConfigureAwait(false) is not { } request)
        {
            return Result.Failure<Guid>(LeaveErrors.PermissionNotFound);
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

        var manager = await staff.ManagerAsync(request.EmployeeId, cancellationToken).ConfigureAwait(false);
        var set = request.Set(input.Date, input.From, input.To, Enum.Parse<PermissionKind>(input.Kind), input.Reason, manager?.UserId);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var legalEntity = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(m => m.Id == request.EmployeeId)?.LegalEntityId;
        return await SendAsync(request, legalEntity, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Changes an approved permission (its own permission and a reason): its day, times, kind and reason, checked as a
    /// new request would be. Not while the attendance month of the old or new day is closing or closed.
    /// </summary>
    public async Task<Result> AmendAsync(Guid id, PermissionAmendInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (await db.Permissions.FirstOrDefaultAsync(p => p.Id == id, cancellationToken).ConfigureAwait(false) is not { } request)
        {
            return Result.Failure(LeaveErrors.PermissionNotFound);
        }

        if (await HeldAsync(request, input.AmendReason, cancellationToken).ConfigureAwait(false) is { } held)
        {
            return Result.Failure(held);
        }

        var preview = await PreviewAsync(new PermissionInput(request.EmployeeId, input.Date, input.From, input.To, input.Kind, input.Reason), id, cancellationToken).ConfigureAwait(false);
        if (preview.IsFailure)
        {
            return Result.Failure(preview.Error);
        }

        if (Refusal(preview.Value) is { } refused)
        {
            return Result.Failure(refused);
        }

        var amended = request.Amend(input.Date, input.From, input.To, Enum.Parse<PermissionKind>(input.Kind), input.Reason, input.AmendReason, user.DisplayName, clock.UtcNow);
        if (amended.IsFailure)
        {
            return amended;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>Cancels an approved permission (its own permission and a reason). Not while its attendance month is closing or closed.</summary>
    public async Task<Result> CancelApprovedAsync(Guid id, string? reason, CancellationToken cancellationToken)
    {
        if (await db.Permissions.FirstOrDefaultAsync(p => p.Id == id, cancellationToken).ConfigureAwait(false) is not { } request)
        {
            return Result.Failure(LeaveErrors.PermissionNotFound);
        }

        if (await HeldAsync(request, reason, cancellationToken).ConfigureAwait(false) is { } held)
        {
            return Result.Failure(held);
        }

        var canceled = request.CancelApproved(reason!, user.DisplayName, clock.UtcNow);
        if (canceled.IsFailure)
        {
            return canceled;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    private async Task<Error?> HeldAsync(PermissionRequest request, string? reason, CancellationToken cancellationToken)
    {
        if (request.Status != RequestStatus.Approved)
        {
            return LeaveErrors.NotAmendable;
        }

        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 500)
        {
            return LeaveErrors.AmendReason;
        }

        return await calendar.LockedAsync(request.Date, request.Date, cancellationToken).ConfigureAwait(false) ? LeaveErrors.Locked : null;
    }

    private static Error? Refusal(PermissionPreview p) => (p.Problems.Count > 0 ? p.Problems[0] : null) switch
    {
        null => null,
        "times" => LeaveErrors.PermissionTimes,
        "not_employed" => LeaveErrors.NotEmployed,
        "on_leave" => LeaveErrors.OnLeave,
        _ => LeaveErrors.Locked,
    };

    private async Task<Result<Guid>> SendAsync(PermissionRequest request, Guid? legalEntityId, CancellationToken cancellationToken)
    {
        var started = await approvals.SubmitAsync(new ApprovalSubmission(PermissionAdapter.ScreenCode, request.Id, $"{request.RequestNo} — {request.EmployeeName}", legalEntityId), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            request.Ended(RequestStatus.Returned, null, clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure<Guid>(started.Error);
        }

        return Result.Success(request.Id);
    }
}

/// <summary>A permission as the approval engine sees it: the direct manager when linked to an account, otherwise HR.</summary>
internal sealed class PermissionAdapter(LeaveDbContext db, IClock clock) : IApprovalRecordAdapter
{
    public const string ScreenCode = "leave.permission";

    /// <summary>The request's code: the permission is approved (the attendance no longer counts its minutes).</summary>
    public const string ApprovePermission = "approve_permission";

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
                                    type = "approval", id = "manager", label = "المدير المباشر", nameAr = "المدير المباشر", nameEn = "Direct manager",
                                    assignees = new[] { new { kind = "UserField", fieldKey = "manager" } }, rule = "Any",
                                },
                            },
                        },
                    },
                    @else = new object[]
                    {
                        new
                        {
                            type = "approval", id = "hr", label = "الموارد البشرية", nameAr = "الموارد البشرية", nameEn = "HR",
                            assignees = new[] { new { kind = "Permission", permission = LeavePermissions.Approve } }, rule = "Any",
                        },
                    },
                },
                new { type = "action", id = "approve-permission", label = "اعتماد الاستئذان", action = ApprovePermission },
            },
        },
        JsonOptions);

    private static readonly RecordFieldOption[] Kinds =
    [
        new(nameof(PermissionKind.LateArrival), "تأخير صباحي", "Late arrival", Settable: false),
        new(nameof(PermissionKind.EarlyLeave), "خروج مبكر", "Early leave", Settable: false),
        new(nameof(PermissionKind.During), "خروج أثناء الدوام", "Out during the day", Settable: false),
        new(nameof(PermissionKind.Mission), "مهمة عمل", "Work mission", Settable: false),
    ];

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "الاستئذانات",
        "Permissions",
        "/hr/permissions/{id}",
        [
            new("employee", "الموظف", "Employee", RecordFieldType.Text, Updatable: false),
            new("kind", "نوع الاستئذان", "Kind", RecordFieldType.Choice, Updatable: false, Kinds),
            new("date", "التاريخ", "Date", RecordFieldType.Date, Updatable: false),
            new("minutes", "الدقائق", "Minutes", RecordFieldType.Number, Updatable: false),
            new("manager", "المدير المباشر", "Direct manager", RecordFieldType.User, Updatable: false),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد الاستئذانات", "Permission approval", DefaultDefinition),
        Actions:
        [
            new(
                ApprovePermission,
                "اعتماد الاستئذان",
                "Approve the permission",
                "تصبح حالة الاستئذان «معتمد»، ولا يُحسب وقته في الحضور تأخيرًا أو خروجًا مبكرًا (في حدود رصيد الشهر، والمهمة كاملة).",
                "The permission is «approved», and the attendance no longer counts its time as late or early (within the month's allowance; a mission in full).",
                Required: true),
        ]);

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var p = await db.Permissions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        return p is null
            ? null
            : new Dictionary<string, string?>
            {
                ["employee"] = p.EmployeeName,
                ["kind"] = p.Kind.ToString(),
                ["date"] = p.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                ["minutes"] = p.Minutes.ToString(CultureInfo.InvariantCulture),
                ["manager"] = p.ManagerUserId?.ToString(),
            };
    }

    public Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("leave_permission_field_not_settable", "A process cannot change a permission.")));

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        if (await db.Permissions.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false) is not { } p)
        {
            return Result.Failure(LeaveErrors.PermissionNotFound);
        }

        p.Started();
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>«Approve the permission» (the process runs it, by default at its end). Run again on an approved one, it does nothing.</summary>
    public async Task<RecordActionResult> RunAsync(Guid recordId, string action, CancellationToken cancellationToken)
    {
        if (action != ApprovePermission)
        {
            return RecordActionResult.Failed($"A permission has no action \"{action}\".");
        }

        if (await db.Permissions.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false) is not { } p)
        {
            return RecordActionResult.Failed("The permission no longer exists.");
        }

        if (p.Status == RequestStatus.Approved)
        {
            return RecordActionResult.Done;
        }

        if (p.Status != RequestStatus.InApproval)
        {
            return RecordActionResult.Failed("The permission is not in approval.");
        }

        p.Ended(RequestStatus.Approved, null, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return RecordActionResult.Done;
    }

    /// <summary>The approval ended: a rejection or return sets the state; approved, its code already approved it.</summary>
    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        if (await db.Permissions.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false) is not { Status: RequestStatus.InApproval } p)
        {
            return;
        }

        p.Ended(
            end == ApprovalEnd.Rejected ? RequestStatus.Rejected : RequestStatus.Returned,
            end == ApprovalEnd.Approved ? "انتهى الاعتماد دون اعتماد الاستئذان؛ أعد إرسال الطلب." : comment,
            clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}

/// <summary>The approved permissions for the attendance: within each month's allowance in date order; missions in full.</summary>
internal sealed class ApprovedTimeOffs(LeaveDbContext db, LeaveSetup setup) : IApprovedTimeOff
{
    public async Task<IReadOnlyList<ApprovedTimeOff>> InAsync(DateOnly from, DateOnly to, Guid? employeeId, CancellationToken cancellationToken)
    {
        var allowance = (await setup.SettingAsync(cancellationToken).ConfigureAwait(false)).PermissionMinutesPerMonth;
        var (start, end) = (new DateOnly(from.Year, from.Month, 1), new DateOnly(to.Year, to.Month, 1).AddMonths(1).AddDays(-1));
        var all = await db.Permissions.AsNoTracking()
            .Where(p => p.Status == RequestStatus.Approved && p.Date >= start && p.Date <= end && (employeeId == null || p.EmployeeId == employeeId))
            .OrderBy(p => p.Date).ThenBy(p => p.CreatedAt)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var left = new Dictionary<(Guid, int, int), int>();
        var result = new List<ApprovedTimeOff>();
        foreach (var p in all)
        {
            var key = (p.EmployeeId, p.Date.Year, p.Date.Month);
            var remaining = left.TryGetValue(key, out var r) ? r : allowance;
            var waived = p.Kind == PermissionKind.Mission ? p.Minutes : Math.Min(p.Minutes, remaining);
            if (p.Kind != PermissionKind.Mission)
            {
                left[key] = remaining - waived;
            }

            if (p.Date >= from && p.Date <= to)
            {
                result.Add(new ApprovedTimeOff(p.EmployeeId, p.Date, p.Minutes, waived, p.Kind.ToString(), p.RequestNo));
            }
        }

        return result;
    }
}

/// <summary>
/// The leave days of a period for the staff payroll: full-pay days, the sick days at three quarters (the year's tiers in
/// date order), and the unpaid days (unpaid leave and the sick days past 90 in the year).
/// </summary>
internal sealed class LeavePayroll(LeaveDbContext db, IAttendanceCalendar calendar) : ILeavePayroll
{
    public async Task<IReadOnlyList<AnnualLeaveBalance>> AnnualAsync(DateOnly on, CancellationToken cancellationToken)
    {
        var annual = await db.Types.AsNoTracking().Where(t => t.Code == LeaveSetup.Annual).Select(t => (Guid?)t.Id).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (annual is not { } id)
        {
            return [];
        }

        var yearStart = new DateOnly(on.Year, 1, 1);
        var balances = await db.Entries.AsNoTracking().Where(e => e.LeaveTypeId == id && e.Date <= on)
            .GroupBy(e => e.EmployeeId).Select(g => new { EmployeeId = g.Key, Days = g.Sum(e => e.Days) }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var taken = await db.Requests.AsNoTracking().Where(r => r.LeaveTypeId == id && r.Status == RequestStatus.Approved && r.From >= yearStart && r.From <= on)
            .GroupBy(r => r.EmployeeId).Select(g => new { EmployeeId = g.Key, Days = g.Sum(r => r.Days) }).ToDictionaryAsync(x => x.EmployeeId, x => x.Days, cancellationToken).ConfigureAwait(false);
        return balances.Select(b => new AnnualLeaveBalance(b.EmployeeId, b.Days, taken.GetValueOrDefault(b.EmployeeId))).ToList();
    }

    public async Task<IReadOnlyList<LeavePayDays>> DaysAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var yearStart = new DateOnly(from.Year, 1, 1);
        var rows = await (from r in db.Requests.AsNoTracking()
                          join t in db.Types.AsNoTracking() on r.LeaveTypeId equals t.Id
                          where r.Status == RequestStatus.Approved && r.To >= yearStart && r.From <= to
                          orderby r.From
                          select new { r.EmployeeId, r.From, r.To, r.Days, t.Pay, t.DayCount }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var result = new Dictionary<Guid, (decimal Full, decimal Part, decimal Unpaid)>();
        var sickTaken = new Dictionary<Guid, decimal>();
        foreach (var r in rows)
        {
            // The leave's days within the period, counted the way its type counts them.
            async Task<decimal> DaysIn(DateOnly a, DateOnly b) =>
                b < a ? 0 : r.DayCount == DayCount.Working ? await calendar.WorkingDaysAsync(r.EmployeeId, a, b, cancellationToken).ConfigureAwait(false) : b.DayNumber - a.DayNumber + 1;
            var inStart = r.From < from ? from : r.From;
            var inEnd = r.To > to ? to : r.To;
            var inPeriod = r.To < from ? 0 : await DaysIn(inStart, inEnd).ConfigureAwait(false);
            var current = result.GetValueOrDefault(r.EmployeeId);
            if (r.Pay == LeavePay.SickTiers)
            {
                // The year's sick days before this period's part of the leave come first in the tiers.
                var before = r.From < from ? await DaysIn(r.From < yearStart ? yearStart : r.From, from.AddDays(-1)).ConfigureAwait(false) : 0;
                var taken = sickTaken.GetValueOrDefault(r.EmployeeId) + before;
                var split = LeaveRequests.Split(taken, inPeriod);
                sickTaken[r.EmployeeId] = taken + inPeriod + (r.To > to ? await DaysIn(to.AddDays(1), r.To).ConfigureAwait(false) : 0);
                current = (current.Full + split.Full, current.Part + split.ThreeQuarters, current.Unpaid + split.Unpaid);
            }
            else if (r.Pay == LeavePay.Unpaid)
            {
                current = (current.Full, current.Part, current.Unpaid + inPeriod);
            }
            else
            {
                current = (current.Full + inPeriod, current.Part, current.Unpaid);
            }

            if (inPeriod > 0 || result.ContainsKey(r.EmployeeId))
            {
                result[r.EmployeeId] = current;
            }
        }

        return result.Where(x => x.Value.Full + x.Value.Part + x.Value.Unpaid > 0).Select(x => new LeavePayDays(x.Key, x.Value.Full, x.Value.Part, x.Value.Unpaid)).ToList();
    }
}
