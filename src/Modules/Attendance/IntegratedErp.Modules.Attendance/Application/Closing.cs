using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Attendance.Domain;
using IntegratedErp.Modules.Attendance.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Attendance.Application;

public sealed record ReopenInput(string Reason);

public sealed record OvertimeInput(Guid EmployeeId, DateOnly Date, int Minutes, string Reason);

/// <summary>Whether a day can still change: not once its month is in approval or closed.</summary>
internal static class MonthLock
{
    public static async Task<bool> LockedAsync(AttendanceDbContext db, DateOnly day, CancellationToken cancellationToken) =>
        await db.Months.AsNoTracking().AnyAsync(m => m.Status != MonthStatus.Open && m.From <= day && m.To >= day, cancellationToken).ConfigureAwait(false);

    public static async Task<List<(DateOnly From, DateOnly To)>> LockedRangesAsync(AttendanceDbContext db, DateOnly from, DateOnly to, CancellationToken cancellationToken) =>
        (await db.Months.AsNoTracking().Where(m => m.Status != MonthStatus.Open && m.From <= to && m.To >= from).Select(m => new { m.From, m.To }).ToListAsync(cancellationToken).ConfigureAwait(false))
            .Select(m => (m.From, m.To)).ToList();
}

/// <summary>Sending the month for closing with its figures frozen, and reopening a closed month.</summary>
internal sealed class MonthClosing(AttendanceDbContext db, IStaffDirectory staff, AttendanceQueries queries, IApprovalService approvals, ICurrentUser user, IClock clock)
{
    public async Task<Result<Guid>> SubmitAsync(string period, CancellationToken cancellationToken)
    {
        if (await queries.PeriodAsync(period, cancellationToken).ConfigureAwait(false) is not { } p)
        {
            return Result.Failure<Guid>(AttendanceErrors.MonthNotFound);
        }

        var month = await db.Months.Include(m => m.Lines).FirstOrDefaultAsync(m => m.Period == period, cancellationToken).ConfigureAwait(false);
        if (month is null)
        {
            month = AttendanceMonth.For(period, p.From, p.To);
            db.Months.Add(month);
        }
        else if (month.Status != MonthStatus.Open)
        {
            return Result.Failure<Guid>(AttendanceErrors.MonthNotOpen);
        }

        var book = await AttendanceBook.LoadAsync(db, staff, p.From, p.To, null, cancellationToken).ConfigureAwait(false);
        var lines = AttendanceQueries.Rows(book, null)
            .Select(x =>
            {
                var r = AttendanceQueries.Summary(book, x.Member, x.Days);
                return AttendanceMonthLine.Of(
                    month.Id, x.Member.Id, x.Member.EmployeeNo, x.Member.NameAr, x.Member.NameEn, x.Member.LegalEntityId, x.Member.DepartmentAr, x.Member.DepartmentEn,
                    r.ShiftAr, r.ShiftEn, r.WorkDays, r.Present, r.Absent, r.Leave, x.Days.Count(d => d.Result.Status == DayStatus.Excused),
                    r.LateMinutes, r.EarlyMinutes, r.MissingPunches, r.Deduction, r.OvertimeMinutes, r.State);
            })
            .ToList();
        if (lines.Count == 0)
        {
            return Result.Failure<Guid>(AttendanceErrors.MonthEmpty);
        }

        if (db.Entry(month).State != EntityState.Added)
        {
            db.MonthLines.RemoveRange(month.Lines);
        }

        var submitted = month.Submit(lines, user.DisplayName, clock.UtcNow);
        if (submitted.IsFailure)
        {
            return Result.Failure<Guid>(submitted.Error);
        }

        db.MonthLines.AddRange(lines);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        var started = await approvals.SubmitAsync(new ApprovalSubmission(MonthAdapter.ScreenCode, month.Id, $"ATT-{period}"), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            month.SubmissionFailed();
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure<Guid>(started.Error);
        }

        return Result.Success(month.Id);
    }

    public async Task<Result> ReopenAsync(string period, ReopenInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (await db.Months.FirstOrDefaultAsync(m => m.Period == period, cancellationToken).ConfigureAwait(false) is not { } month)
        {
            return Result.Failure(AttendanceErrors.MonthNotFound);
        }

        var reopened = month.Reopen($"{input.Reason?.Trim()} — {user.DisplayName}");
        if (reopened.IsSuccess)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return reopened;
    }
}

/// <summary>Requesting overtime for an employee and day, through approval.</summary>
internal sealed class OvertimeService(AttendanceDbContext db, IStaffDirectory staff, NumberSequenceService numbering, IApprovalService approvals, ICurrentUser user, IClock clock)
{
    public async Task<Result<Guid>> RequestAsync(OvertimeInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var member = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(m => m.Id == input.EmployeeId);
        if (member is null)
        {
            return Result.Failure<Guid>(AttendanceErrors.EmployeeNotFound);
        }

        if (!AttendanceBook.Employed(member, input.Date))
        {
            return Result.Failure<Guid>(AttendanceErrors.Overtime);
        }

        if (await MonthLock.LockedAsync(db, input.Date, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(AttendanceErrors.MonthLocked);
        }

        // Gap-free numbering: the number is taken in the transaction that saves the request.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, AttendanceModule.OvertimeSequence, input.Date, cancellationToken).ConfigureAwait(false);
        var created = OvertimeRequest.Create(number, member.Id, member.NameAr ?? member.NameEn, input.Date, input.Minutes, input.Reason, user.DisplayName, clock.UtcNow);
        if (created.IsFailure)
        {
            return Result.Failure<Guid>(created.Error);
        }

        db.Overtime.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return await SendAsync(created.Value, cancellationToken).ConfigureAwait(false);
    }

    public async Task<Result<Guid>> ResubmitAsync(Guid id, OvertimeInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (await db.Overtime.FirstOrDefaultAsync(o => o.Id == id, cancellationToken).ConfigureAwait(false) is not { } request)
        {
            return Result.Failure<Guid>(AttendanceErrors.OvertimeNotFound);
        }

        if (request.Status != OvertimeStatus.Returned)
        {
            return Result.Failure<Guid>(AttendanceErrors.OvertimeNotReturned);
        }

        if (await MonthLock.LockedAsync(db, input.Date, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(AttendanceErrors.MonthLocked);
        }

        var set = request.Set(input.Date, input.Minutes, input.Reason);
        if (set.IsFailure)
        {
            return Result.Failure<Guid>(set.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return await SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    private async Task<Result<Guid>> SendAsync(OvertimeRequest request, CancellationToken cancellationToken)
    {
        var legalEntity = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(m => m.Id == request.EmployeeId)?.LegalEntityId;
        var started = await approvals.SubmitAsync(new ApprovalSubmission(OvertimeAdapter.ScreenCode, request.Id, $"{request.RequestNo} — {request.EmployeeName}", legalEntity), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            request.Ended(OvertimeStatus.Returned, null, clock.UtcNow);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure<Guid>(started.Error);
        }

        return Result.Success(request.Id);
    }
}

/// <summary>The attendance month as the approval engine sees it: HR reviews, the HR manager closes; approved ⇒ closed.</summary>
internal sealed class MonthAdapter(AttendanceDbContext db, IClock clock) : IApprovalRecordAdapter
{
    public const string ScreenCode = "attendance.month";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly string DefaultDefinition = JsonSerializer.Serialize(
        new
        {
            startCondition = (object?)null,
            steps = new object[]
            {
                new
                {
                    type = "approval", id = "review", label = "مراجعة الحضور",
                    nameAr = "مراجعة الحضور", nameEn = "Attendance review",
                    assignees = new[] { new { kind = "Permission", permission = AttendancePermissions.MonthReview } }, rule = "Any",
                },
                new
                {
                    type = "approval", id = "close", label = "إقفال الموارد البشرية",
                    nameAr = "إقفال الموارد البشرية", nameEn = "HR closing",
                    assignees = new[] { new { kind = "Permission", permission = AttendancePermissions.MonthClose } }, rule = "Any",
                },
            },
        },
        JsonOptions);

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "إقفال الحضور الشهري",
        "Monthly attendance closing",
        "/hr/attendance/months/{id}",
        [
            new("period", "الشهر", "Month", RecordFieldType.Text, Updatable: false),
            new("employees", "عدد الموظفين", "Employees", RecordFieldType.Number, Updatable: false),
            new("deduction_days", "أيام الخصم", "Deduction days", RecordFieldType.Number, Updatable: false),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد إقفال الحضور", "Attendance closing approval", DefaultDefinition));

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var m = await db.Months.AsNoTracking().Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        return m is null
            ? null
            : new Dictionary<string, string?>
            {
                ["period"] = m.Period,
                ["employees"] = m.Lines.Count.ToString(CultureInfo.InvariantCulture),
                ["deduction_days"] = m.Lines.Sum(l => l.DeductionDays).ToString(CultureInfo.InvariantCulture),
            };
    }

    public Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("attendance_month_field_not_settable", "A process cannot change an attendance month.")));

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        if (await db.Months.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false) is not { } month)
        {
            return Result.Failure(AttendanceErrors.MonthNotFound);
        }

        if (month.Status != MonthStatus.InApproval)
        {
            return Result.Failure(AttendanceErrors.MonthNotOpen);
        }

        month.Started();
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        if (await db.Months.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false) is not { Status: MonthStatus.InApproval } month)
        {
            return;
        }

        if (end == ApprovalEnd.Approved)
        {
            month.Close(clock.UtcNow, comment);
        }
        else
        {
            month.BackToOpen(comment);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}

/// <summary>An overtime request as the approval engine sees it: one approval by default; approved ⇒ counted in the month.</summary>
internal sealed class OvertimeAdapter(AttendanceDbContext db, IClock clock) : IApprovalRecordAdapter
{
    public const string ScreenCode = "attendance.overtime";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly string DefaultDefinition = JsonSerializer.Serialize(
        new
        {
            startCondition = (object?)null,
            steps = new object[]
            {
                new
                {
                    type = "approval", id = "approve", label = "اعتماد الإضافي",
                    nameAr = "اعتماد الإضافي", nameEn = "Overtime approval",
                    assignees = new[] { new { kind = "Permission", permission = AttendancePermissions.OvertimeApprove } }, rule = "Any",
                },
            },
        },
        JsonOptions);

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "طلبات العمل الإضافي",
        "Overtime requests",
        "/hr/overtime/{id}",
        [
            new("employee", "الموظف", "Employee", RecordFieldType.Text, Updatable: false),
            new("date", "التاريخ", "Date", RecordFieldType.Date, Updatable: false),
            new("hours", "الساعات", "Hours", RecordFieldType.Number, Updatable: false),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد العمل الإضافي", "Overtime approval", DefaultDefinition));

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var o = await db.Overtime.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        return o is null
            ? null
            : new Dictionary<string, string?>
            {
                ["employee"] = o.EmployeeName,
                ["date"] = o.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                ["hours"] = (o.Minutes / 60m).ToString("0.##", CultureInfo.InvariantCulture),
            };
    }

    public Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("attendance_overtime_field_not_settable", "A process cannot change an overtime request.")));

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        if (await db.Overtime.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false) is not { } request)
        {
            return Result.Failure(AttendanceErrors.OvertimeNotFound);
        }

        request.Started();
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        if (await db.Overtime.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false) is not { Status: OvertimeStatus.InApproval } request)
        {
            return;
        }

        request.Ended(end switch { ApprovalEnd.Approved => OvertimeStatus.Approved, ApprovalEnd.Rejected => OvertimeStatus.Rejected, _ => OvertimeStatus.Returned }, comment, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
