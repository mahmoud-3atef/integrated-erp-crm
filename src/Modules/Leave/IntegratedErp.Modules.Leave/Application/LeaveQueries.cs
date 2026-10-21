using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Leave.Domain;
using IntegratedErp.Modules.Leave.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Leave.Application;

public sealed record RequestRowDto(
    Guid Id,
    string RequestNo,
    Guid EmployeeId,
    string EmployeeName,
    string? DepartmentAr,
    string? DepartmentEn,
    Guid LeaveTypeId,
    string TypeAr,
    string TypeEn,
    string Pay,
    DateOnly From,
    DateOnly To,
    decimal Days,
    string Status,
    bool HasBalance,
    string CreatedByName,
    DateTimeOffset CreatedAt);

public sealed record RequestPageDto(IReadOnlyList<RequestRowDto> Rows, int Total);

public sealed record LeaveKpis(int OnLeaveToday, int TodayAnnual, int TodaySick, int TodayOther, int Pending, int Upcoming, decimal UpcomingDays, int Returned, int PermissionsThisMonth, int PermissionMinutesThisMonth, int PermissionsPending, int ReturnsToConfirm);

public sealed record RequestDetailDto(
    RequestRowDto Request,
    string? Reason,
    string? SubstituteName,
    bool Ticket,
    string? LastComment,
    DateTimeOffset? DecidedAt,
    decimal? Available,
    bool CanCancel,
    ApprovalStatusInfo? Approval,
    DateOnly? ReturnedOn = null,
    string? ReturnNote = null,
    DateOnly? ExpectedReturn = null,
    bool CanConfirmReturn = false,
    bool CanAmend = false,
    bool CanCancelApproved = false,
    DateTimeOffset? AmendedAt = null,
    string? AmendedByName = null,
    string? AmendNote = null,
    DateTimeOffset? CanceledAt = null,
    string? CanceledByName = null);

public sealed record EntryDto(Guid Id, Guid LeaveTypeId, DateOnly Date, string Kind, decimal Days, string Reason, string? RequestNo, string CreatedByName, decimal Running);

public sealed record TypeBalanceDto(Guid LeaveTypeId, string TypeAr, string TypeEn, bool HasBalance, decimal PerYear, decimal Opening, decimal AccruedThisYear, decimal UsedThisYear, decimal Reserved, decimal Available, decimal? YearLimit);

public sealed record EmployeeLeaveDto(Guid EmployeeId, string Name, DateOnly? HireDate, double YearsOfService, IReadOnlyList<TypeBalanceDto> Balances, IReadOnlyList<EntryDto> Entries, IReadOnlyList<RequestRowDto> Requests, int PermissionAllowance = 0, int PermissionUsedThisMonth = 0, IReadOnlyList<PermissionDto>? Permissions = null);

public sealed record BalanceRowDto(Guid EmployeeId, string EmployeeNo, string Name, string? DepartmentAr, string? DepartmentEn, decimal PerYear, decimal Opening, decimal AccruedThisYear, decimal UsedThisYear, decimal Reserved, decimal Available, decimal SickUsedThisYear);

/// <summary>The leave screens: the requests and their cards, the calendar, a request, an employee's leave, the balances.</summary>
internal sealed class LeaveQueries(LeaveDbContext db, IStaffDirectory staff, LeaveSetup setup, LeaveBalances balances, IApprovalService approvals, IClock clock, Attendance.Contracts.IAttendanceCalendar calendar, IPermissionService permissions)
{
    public async Task<LeaveKpis> KpisAsync(CancellationToken cancellationToken)
    {
        await setup.SettingAsync(cancellationToken).ConfigureAwait(false);
        var today = clock.Today;
        var until = today.AddDays(30);
        var rows = await (from r in db.Requests.AsNoTracking()
                          join t in db.Types.AsNoTracking() on r.LeaveTypeId equals t.Id
                          where r.Status == RequestStatus.Approved || r.Status == RequestStatus.InApproval || r.Status == RequestStatus.Returned
                          select new { r.Status, r.From, r.To, r.Days, t.Code }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var todays = rows.Where(r => r.Status == RequestStatus.Approved && r.From <= today && r.To >= today).ToList();
        var upcoming = rows.Where(r => r.Status == RequestStatus.Approved && r.From > today && r.From <= until).ToList();
        var first = new DateOnly(today.Year, today.Month, 1);
        var permissions = await db.Permissions.AsNoTracking().Where(p => p.Date >= first && p.Date <= first.AddMonths(1).AddDays(-1) || p.Status == RequestStatus.InApproval)
            .Select(p => new { p.Date, p.Status, p.Minutes }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var monthApproved = permissions.Where(p => p.Status == RequestStatus.Approved && p.Date >= first).ToList();
        var returns = await db.Requests.AsNoTracking().CountAsync(r => r.Status == RequestStatus.Approved && r.To < today && r.ReturnedOn == null, cancellationToken).ConfigureAwait(false);
        return new LeaveKpis(
            todays.Count, todays.Count(r => r.Code == LeaveSetup.Annual), todays.Count(r => r.Code == LeaveSetup.Sick), todays.Count(r => r.Code is not (LeaveSetup.Annual or LeaveSetup.Sick)),
            rows.Count(r => r.Status == RequestStatus.InApproval), upcoming.Count, upcoming.Sum(r => r.Days), rows.Count(r => r.Status == RequestStatus.Returned),
            monthApproved.Count, monthApproved.Sum(p => p.Minutes), permissions.Count(p => p.Status == RequestStatus.InApproval), returns);
    }

    public async Task<RequestPageDto> RequestsAsync(string? tab, Guid? typeId, Guid? employeeId, string? search, int page, int pageSize, CancellationToken cancellationToken)
    {
        var today = clock.Today;
        var rows = await RowsAsync(employeeId, cancellationToken).ConfigureAwait(false);
        IEnumerable<RequestRowDto> shown = rows;
        shown = tab switch
        {
            "pending" => shown.Where(r => r.Status is nameof(RequestStatus.InApproval) or nameof(RequestStatus.Returned)),
            "current" => shown.Where(r => r.Status == nameof(RequestStatus.Approved) && r.To >= today),
            _ => shown,
        };
        if (typeId is { } t)
        {
            shown = shown.Where(r => r.LeaveTypeId == t);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            shown = shown.Where(r => r.EmployeeName.Contains(s, StringComparison.OrdinalIgnoreCase) || r.RequestNo.Contains(s, StringComparison.OrdinalIgnoreCase));
        }

        var list = shown.ToList();
        var size = Math.Clamp(pageSize, 10, 200);
        return new RequestPageDto(list.Skip((Math.Max(1, page) - 1) * size).Take(size).ToList(), list.Count);
    }

    /// <summary>The month's leaves (approved and in approval) for the calendar.</summary>
    public async Task<IReadOnlyList<RequestRowDto>?> CalendarAsync(string period, CancellationToken cancellationToken)
    {
        if (!LeaveBalances.TryPeriod(period, out var first))
        {
            return null;
        }

        var last = first.AddMonths(1).AddDays(-1);
        return (await RowsAsync(null, cancellationToken).ConfigureAwait(false))
            .Where(r => r.From <= last && r.To >= first && r.Status is nameof(RequestStatus.Approved) or nameof(RequestStatus.InApproval))
            .OrderBy(r => r.From).ToList();
    }

    public async Task<RequestDetailDto?> RequestAsync(Guid id, CancellationToken cancellationToken)
    {
        var r = await db.Requests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);
        if (r is null)
        {
            return null;
        }

        var row = (await RowsAsync(r.EmployeeId, cancellationToken).ConfigureAwait(false)).First(x => x.Id == id);
        var available = row.HasBalance ? (await balances.BalanceAsync(r.EmployeeId, r.LeaveTypeId, null, cancellationToken).ConfigureAwait(false)).Available : (decimal?)null;
        var approval = await approvals.StatusAsync(LeaveAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false);
        var expected = r.Status == RequestStatus.Approved ? await calendar.NextWorkingDayAsync(r.EmployeeId, r.To, cancellationToken).ConfigureAwait(false) : (DateOnly?)null;
        var granted = await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false);
        return new RequestDetailDto(
            row, r.Reason, r.SubstituteName, r.Ticket, r.LastComment, r.DecidedAt, available, r.Status == RequestStatus.Approved && r.From > clock.Today, approval,
            r.ReturnedOn, r.ReturnNote, expected, r.Status == RequestStatus.Approved && r.From <= clock.Today && r.ReturnedOn == null,
            CanAmend: r.Status == RequestStatus.Approved && granted.Has(LeavePermissions.RequestAmend),
            CanCancelApproved: r.Status == RequestStatus.Approved && granted.Has(LeavePermissions.RequestCancelApproved),
            AmendedAt: r.AmendedAt,
            AmendedByName: r.AmendedByName,
            AmendNote: r.AmendNote,
            CanceledAt: r.CanceledAt,
            CanceledByName: r.CanceledByName);
    }

    public async Task<EmployeeLeaveDto?> EmployeeAsync(Guid employeeId, CancellationToken cancellationToken)
    {
        await setup.SettingAsync(cancellationToken).ConfigureAwait(false);
        var member = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(m => m.Id == employeeId);
        if (member is null)
        {
            return null;
        }

        var today = clock.Today;
        var years = member.HireDate is { } h ? Math.Max(0, (today.DayNumber - h.DayNumber) / 365.25) : 0;
        var types = await db.Types.AsNoTracking().Where(t => t.IsActive).OrderBy(t => t.SortOrder).ToListAsync(cancellationToken).ConfigureAwait(false);
        var entries = await db.Entries.AsNoTracking().Where(e => e.EmployeeId == employeeId).OrderBy(e => e.Date).ThenBy(e => e.CreatedAt).ToListAsync(cancellationToken).ConfigureAwait(false);
        var requests = await RowsAsync(employeeId, cancellationToken).ConfigureAwait(false);
        var numbers = await db.Requests.AsNoTracking().Where(r => r.EmployeeId == employeeId).ToDictionaryAsync(r => r.Id, r => r.RequestNo, cancellationToken).ConfigureAwait(false);
        var list = types
            .Where(t => t.HasBalance || t.DaysPerYear is not null)
            .Select(t =>
            {
                var mine = entries.Where(e => e.LeaveTypeId == t.Id).ToList();
                var reserved = requests.Where(r => r.LeaveTypeId == t.Id && r.Status == nameof(RequestStatus.InApproval)).Sum(r => r.Days);
                var usedYear = requests.Where(r => r.LeaveTypeId == t.Id && r.Status == nameof(RequestStatus.Approved) && r.From.Year == today.Year).Sum(r => r.Days);
                return t.HasBalance
                    ? new TypeBalanceDto(t.Id, t.NameAr, t.NameEn, true, t.Entitlement(years), mine.Where(e => e.Kind == EntryKind.Opening).Sum(e => e.Days),
                        mine.Where(e => e.Kind == EntryKind.Accrual && e.Date.Year == today.Year).Sum(e => e.Days), usedYear, reserved, mine.Sum(e => e.Days) - reserved, null)
                    : new TypeBalanceDto(t.Id, t.NameAr, t.NameEn, false, t.DaysPerYear ?? 0, 0, 0, usedYear, reserved, (t.DaysPerYear ?? 0) - usedYear - reserved, t.DaysPerYear);
            }).ToList();
        decimal running = 0;
        var byType = new Dictionary<Guid, decimal>();
        var dtos = entries.Select(e =>
        {
            running = byType[e.LeaveTypeId] = byType.GetValueOrDefault(e.LeaveTypeId) + e.Days;
            return new EntryDto(e.Id, e.LeaveTypeId, e.Date, e.Kind.ToString(), e.Days, e.Reason, e.RequestId is { } rid ? numbers.GetValueOrDefault(rid) : null, e.CreatedByName, running);
        }).Reverse().ToList();
        var setting = await setup.SettingAsync(cancellationToken).ConfigureAwait(false);
        var first = new DateOnly(today.Year, today.Month, 1);
        var permissions = await PermissionsAsync(employeeId, null, null, cancellationToken).ConfigureAwait(false);
        var used = permissions.Where(p => p.Kind != nameof(PermissionKind.Mission) && p.Date >= first && p.Date <= first.AddMonths(1).AddDays(-1) && p.Status is nameof(RequestStatus.Approved) or nameof(RequestStatus.InApproval)).Sum(p => p.Minutes);
        return new EmployeeLeaveDto(member.Id, member.NameAr ?? member.NameEn, member.HireDate, Math.Round(years, 1), list, dtos, requests, setting.PermissionMinutesPerMonth, used, permissions.Take(50).ToList());
    }

    public async Task<IReadOnlyList<BalanceRowDto>> BalancesAsync(Guid? typeId, string? search, Guid? departmentId, CancellationToken cancellationToken)
    {
        await setup.SettingAsync(cancellationToken).ConfigureAwait(false);
        var today = clock.Today;
        var type = typeId is { } tid
            ? await db.Types.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tid, cancellationToken).ConfigureAwait(false)
            : await db.Types.AsNoTracking().FirstOrDefaultAsync(t => t.Code == LeaveSetup.Annual, cancellationToken).ConfigureAwait(false);
        if (type is null)
        {
            return [];
        }

        var sick = await db.Types.AsNoTracking().Where(t => t.Code == LeaveSetup.Sick).Select(t => (Guid?)t.Id).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        var members = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).Where(m => m.Status != "Left").ToList();
        if (departmentId is { } dep)
        {
            members = members.Where(m => m.DepartmentId == dep).ToList();
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            members = members.Where(m => m.EmployeeNo.Contains(s, StringComparison.OrdinalIgnoreCase) || (m.NameAr?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false) || m.NameEn.Contains(s, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        var entries = await db.Entries.AsNoTracking().Where(e => e.LeaveTypeId == type.Id).Select(e => new { e.EmployeeId, e.Kind, e.Days, e.Date }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var requests = await db.Requests.AsNoTracking().Where(r => r.LeaveTypeId == type.Id || r.LeaveTypeId == sick)
            .Select(r => new { r.EmployeeId, r.LeaveTypeId, r.Status, r.Days, r.From }).ToListAsync(cancellationToken).ConfigureAwait(false);
        return members.Select(m =>
        {
            var e = entries.Where(x => x.EmployeeId == m.Id).ToList();
            var r = requests.Where(x => x.EmployeeId == m.Id).ToList();
            var years = m.HireDate is { } h ? Math.Max(0, (today.DayNumber - h.DayNumber) / 365.25) : 0;
            var reserved = r.Where(x => x.LeaveTypeId == type.Id && x.Status == RequestStatus.InApproval).Sum(x => x.Days);
            return new BalanceRowDto(
                m.Id, m.EmployeeNo, m.NameAr ?? m.NameEn, m.DepartmentAr, m.DepartmentEn, type.Entitlement(years),
                e.Where(x => x.Kind == EntryKind.Opening).Sum(x => x.Days), e.Where(x => x.Kind == EntryKind.Accrual && x.Date.Year == today.Year).Sum(x => x.Days),
                r.Where(x => x.LeaveTypeId == type.Id && x.Status == RequestStatus.Approved && x.From.Year == today.Year).Sum(x => x.Days), reserved, e.Sum(x => x.Days) - reserved,
                r.Where(x => x.LeaveTypeId == sick && x.Status == RequestStatus.Approved && x.From.Year == today.Year).Sum(x => x.Days));
        }).OrderBy(b => b.Name).ToList();
    }

    /// <summary>Permissions (one employee's or all), newest first; a period ("2026-10") narrows them to its month.</summary>
    public async Task<IReadOnlyList<PermissionDto>> PermissionsAsync(Guid? employeeId, string? period, string? tab, CancellationToken cancellationToken)
    {
        var q = db.Permissions.AsNoTracking();
        if (employeeId is { } e)
        {
            q = q.Where(p => p.EmployeeId == e);
        }

        if (period is not null && LeaveBalances.TryPeriod(period, out var first))
        {
            var last = first.AddMonths(1).AddDays(-1);
            q = q.Where(p => p.Date >= first && p.Date <= last);
        }

        if (tab == "pending")
        {
            q = q.Where(p => p.Status == RequestStatus.InApproval || p.Status == RequestStatus.Returned);
        }

        return await q.OrderByDescending(p => p.Date).ThenByDescending(p => p.CreatedAt).Take(1000)
            .Select(p => new PermissionDto(p.Id, p.RequestNo, p.EmployeeId, p.EmployeeName, p.Date, p.FromTime, p.ToTime, p.Minutes, p.Kind.ToString(), p.Reason, p.Status.ToString(), p.CreatedByName, p.CreatedAt, p.DecidedAt, p.LastComment, null))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<PermissionDto?> PermissionAsync(Guid id, CancellationToken cancellationToken)
    {
        if (await db.Permissions.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, cancellationToken).ConfigureAwait(false) is not { } p)
        {
            return null;
        }

        var approval = await approvals.StatusAsync(PermissionAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false);
        var granted = await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false);
        return new PermissionDto(
            p.Id, p.RequestNo, p.EmployeeId, p.EmployeeName, p.Date, p.FromTime, p.ToTime, p.Minutes, p.Kind.ToString(), p.Reason, p.Status.ToString(), p.CreatedByName, p.CreatedAt, p.DecidedAt, p.LastComment, approval,
            CanAmend: p.Status == RequestStatus.Approved && granted.Has(LeavePermissions.PermissionAmend),
            CanCancelApproved: p.Status == RequestStatus.Approved && granted.Has(LeavePermissions.PermissionCancelApproved),
            AmendedAt: p.AmendedAt,
            AmendedByName: p.AmendedByName,
            AmendNote: p.AmendNote,
            CanceledAt: p.CanceledAt,
            CanceledByName: p.CanceledByName);
    }

    private async Task<List<RequestRowDto>> RowsAsync(Guid? employeeId, CancellationToken cancellationToken)
    {
        var members = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).ToDictionary(m => m.Id);
        var query = from r in db.Requests.AsNoTracking()
                    join t in db.Types.AsNoTracking() on r.LeaveTypeId equals t.Id
                    where employeeId == null || r.EmployeeId == employeeId
                    orderby r.CreatedAt descending
                    select new { r, t };
        return (await query.Take(2000).ToListAsync(cancellationToken).ConfigureAwait(false))
            .Select(x =>
            {
                var m = members.GetValueOrDefault(x.r.EmployeeId);
                return new RequestRowDto(
                    x.r.Id, x.r.RequestNo, x.r.EmployeeId, x.r.EmployeeName, m?.DepartmentAr, m?.DepartmentEn, x.t.Id, x.t.NameAr, x.t.NameEn, x.t.Pay.ToString(),
                    x.r.From, x.r.To, x.r.Days, x.r.Status.ToString(), x.t.HasBalance, x.r.CreatedByName, x.r.CreatedAt);
            }).ToList();
    }
}
