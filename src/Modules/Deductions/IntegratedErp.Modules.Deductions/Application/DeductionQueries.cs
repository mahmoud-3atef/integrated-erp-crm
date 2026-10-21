using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Deductions.Domain;
using IntegratedErp.Modules.Deductions.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Deductions.Application;

public sealed record AdvanceRowDto(Guid Id, string AdvanceNo, Guid EmployeeId, string EmployeeName, string? DepartmentAr, string? DepartmentEn, decimal Amount, int Months, string FirstPeriod, decimal Remaining, bool AboveCap, string Status, DateTimeOffset CreatedAt);

public sealed record InstallmentDto(Guid Id, string Period, decimal Amount, decimal Deducted, string Status, string? Note);

public sealed record AdvanceDto(
    AdvanceRowDto Advance,
    string Reason,
    decimal? SalaryAtRequest,
    DateOnly? PaidOn,
    string? PaymentMethod,
    string? PaymentReference,
    string? PaidBy,
    string CreatedByName,
    string? LastComment,
    IReadOnlyList<InstallmentDto> Installments,
    ApprovalStatusInfo? Approval,
    bool CanAmend = false,
    bool CanCancelApproved = false,
    DateTimeOffset? AmendedAt = null,
    string? AmendedByName = null,
    string? AmendNote = null,
    DateTimeOffset? CanceledAt = null,
    string? CanceledByName = null);

public sealed record AdvanceKpis(decimal OpenBalance, int OpenEmployees, int Pending, decimal PendingAmount, int ToDisburse, decimal PaidThisMonth, int PaidThisMonthCount, decimal DueNextMonth, string NextPeriod);

public sealed record PenaltyRowDto(
    Guid Id,
    string PenaltyNo,
    string Category,
    Guid? PenaltyTypeId,
    Guid EmployeeId,
    string EmployeeName,
    string? TypeAr,
    string? TypeEn,
    string Effect,
    DateOnly ViolationDate,
    string Description,
    decimal? Days,
    decimal? Amount,
    string Period,
    bool AboveCap,
    string Status,
    DateTimeOffset CreatedAt);

public sealed record PenaltyDto(
    PenaltyRowDto Penalty,
    string? Statement,
    string CreatedByName,
    string? LastComment,
    ApprovalStatusInfo? Approval,
    bool CanAmend = false,
    bool CanCancelApproved = false,
    DateTimeOffset? AmendedAt = null,
    string? AmendedByName = null,
    string? AmendNote = null,
    DateTimeOffset? CanceledAt = null,
    string? CanceledByName = null);

public sealed record EmployeeDeductionsDto(decimal OpenAdvances, int Warnings, decimal PenaltyDaysThisYear, IReadOnlyList<AdvanceRowDto> Advances, IReadOnlyList<PenaltyRowDto> Penalties);

/// <summary>The advances and their cards, an advance, the penalties and other deductions, a penalty, and an employee's.</summary>
internal sealed class DeductionQueries(DeductionsDbContext db, IStaffDirectory staff, DeductionSetup setup, IApprovalService approvals, IPermissionService permissions, IClock clock)
{
    public async Task<AdvanceKpis> AdvanceKpisAsync(CancellationToken cancellationToken)
    {
        await setup.SettingAsync(cancellationToken).ConfigureAwait(false);
        var today = clock.Today;
        var next = Periods.Add(Periods.Of(today), 1);
        var first = new DateOnly(today.Year, today.Month, 1);
        var advances = await db.Advances.AsNoTracking().Include(a => a.Installments).ToListAsync(cancellationToken).ConfigureAwait(false);
        var open = advances.Where(a => a.Status == AdvanceStatus.Disbursed).ToList();
        var paid = advances.Where(a => a.PaidOn >= first).ToList();
        return new AdvanceKpis(
            open.Sum(a => a.Remaining), open.Select(a => a.EmployeeId).Distinct().Count(),
            advances.Count(a => a.Status == AdvanceStatus.InApproval), advances.Where(a => a.Status == AdvanceStatus.InApproval).Sum(a => a.Amount),
            advances.Count(a => a.Status == AdvanceStatus.Approved), paid.Sum(a => a.Amount), paid.Count,
            open.SelectMany(a => a.Installments).Where(i => i.Period == next && i.Status is InstallmentStatus.Scheduled or InstallmentStatus.Deferred).Sum(i => i.Amount - i.Deducted), next);
    }

    public async Task<IReadOnlyList<AdvanceRowDto>> AdvancesAsync(string? tab, Guid? employeeId, string? search, CancellationToken cancellationToken)
    {
        var members = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).ToDictionary(m => m.Id);
        var q = db.Advances.AsNoTracking().Include(a => a.Installments).AsQueryable();
        if (employeeId is { } e)
        {
            q = q.Where(a => a.EmployeeId == e);
        }

        q = tab switch
        {
            "pending" => q.Where(a => a.Status == AdvanceStatus.InApproval || a.Status == AdvanceStatus.Returned),
            "disburse" => q.Where(a => a.Status == AdvanceStatus.Approved),
            "open" => q.Where(a => a.Status == AdvanceStatus.Disbursed),
            _ => q,
        };
        var list = await q.OrderByDescending(a => a.CreatedAt).Take(1000).ToListAsync(cancellationToken).ConfigureAwait(false);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            list = list.Where(a => a.EmployeeName.Contains(s, StringComparison.OrdinalIgnoreCase) || a.AdvanceNo.Contains(s, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return list.Select(a => Row(a, members.GetValueOrDefault(a.EmployeeId))).ToList();
    }

    public async Task<AdvanceDto?> AdvanceAsync(Guid id, CancellationToken cancellationToken)
    {
        var a = await db.Advances.AsNoTracking().Include(x => x.Installments).FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);
        if (a is null)
        {
            return null;
        }

        var member = (await staff.MembersAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(m => m.Id == a.EmployeeId);
        var approval = await approvals.StatusAsync(AdvanceAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false);
        var granted = await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false);
        var seeSalary = granted.Has(AdvanceService.SalariesView);
        return new AdvanceDto(
            Row(a, member), a.Reason, seeSalary ? a.SalaryAtRequest : null, a.PaidOn, a.PaymentMethod, a.PaymentReference, a.PaidBy, a.CreatedByName, a.LastComment,
            a.Installments.OrderBy(i => i.Period).ThenBy(i => i.Status == InstallmentStatus.Postponed ? 0 : 1)
                .Select(i => new InstallmentDto(i.Id, i.Period, i.Amount, i.Deducted, i.Status.ToString(), i.Note)).ToList(),
            approval,
            CanAmend: a.IsAmendable && granted.Has(DeductionPermissions.AdvanceAmend),
            CanCancelApproved: a.IsAmendable && granted.Has(DeductionPermissions.AdvanceCancelApproved),
            AmendedAt: a.AmendedAt,
            AmendedByName: a.AmendedByName,
            AmendNote: a.AmendNote,
            CanceledAt: a.CanceledAt,
            CanceledByName: a.CanceledByName);
    }

    public async Task<IReadOnlyList<PenaltyRowDto>> PenaltiesAsync(string? tab, Guid? employeeId, string? search, CancellationToken cancellationToken)
    {
        var q = db.Penalties.AsNoTracking().AsQueryable();
        if (employeeId is { } e)
        {
            q = q.Where(p => p.EmployeeId == e);
        }

        q = tab switch
        {
            "pending" => q.Where(p => p.Status == PenaltyStatus.InApproval || p.Status == PenaltyStatus.Returned),
            "warnings" => q.Where(p => p.Effect == PenaltyEffect.Warning),
            "deductions" => q.Where(p => p.Effect != PenaltyEffect.Warning),
            _ => q,
        };
        var types = await db.PenaltyTypes.AsNoTracking().ToDictionaryAsync(t => t.Id, cancellationToken).ConfigureAwait(false);
        var list = await q.OrderByDescending(p => p.CreatedAt).Take(1000).ToListAsync(cancellationToken).ConfigureAwait(false);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            list = list.Where(p => p.EmployeeName.Contains(s, StringComparison.OrdinalIgnoreCase) || p.PenaltyNo.Contains(s, StringComparison.OrdinalIgnoreCase) || p.Description.Contains(s, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return list.Select(p => Row(p, p.PenaltyTypeId is { } t ? types.GetValueOrDefault(t) : null)).ToList();
    }

    public async Task<PenaltyDto?> PenaltyAsync(Guid id, CancellationToken cancellationToken)
    {
        var p = await db.Penalties.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);
        if (p is null)
        {
            return null;
        }

        var type = p.PenaltyTypeId is { } t ? await db.PenaltyTypes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == t, cancellationToken).ConfigureAwait(false) : null;
        var approval = await approvals.StatusAsync(p.Category == PenaltyCategory.Other ? OtherDeductionAdapter.ScreenCode : PenaltyAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false);
        var granted = await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false);
        return new PenaltyDto(
            Row(p, type), p.Statement, p.CreatedByName, p.LastComment, approval,
            CanAmend: p.IsAmendable && granted.Has(DeductionPermissions.AmendOf(p.Category)),
            CanCancelApproved: p.IsAmendable && granted.Has(DeductionPermissions.CancelApprovedOf(p.Category)),
            AmendedAt: p.AmendedAt,
            AmendedByName: p.AmendedByName,
            AmendNote: p.AmendNote,
            CanceledAt: p.CanceledAt,
            CanceledByName: p.CanceledByName);
    }

    public async Task<EmployeeDeductionsDto> EmployeeAsync(Guid employeeId, CancellationToken cancellationToken)
    {
        var advances = await AdvancesAsync(null, employeeId, null, cancellationToken).ConfigureAwait(false);
        var penalties = await PenaltiesAsync(null, employeeId, null, cancellationToken).ConfigureAwait(false);
        var year = clock.Today.Year.ToString(System.Globalization.CultureInfo.InvariantCulture);
        return new EmployeeDeductionsDto(
            advances.Where(a => a.Status == nameof(AdvanceStatus.Disbursed)).Sum(a => a.Remaining),
            penalties.Count(p => p.Effect == nameof(PenaltyEffect.Warning) && p.Status == nameof(PenaltyStatus.Applied)),
            penalties.Where(p => p.Effect == nameof(PenaltyEffect.DeductDays) && p.Status == nameof(PenaltyStatus.Applied) && p.Period.StartsWith(year, StringComparison.Ordinal)).Sum(p => p.Days ?? 0),
            advances, penalties);
    }

    private static AdvanceRowDto Row(Advance a, StaffMember? m) => new(
        a.Id, a.AdvanceNo, a.EmployeeId, a.EmployeeName, m?.DepartmentAr, m?.DepartmentEn, a.Amount, a.Months, a.FirstPeriod,
        a.Status is AdvanceStatus.Disbursed or AdvanceStatus.Approved ? a.Remaining : a.Status == AdvanceStatus.Settled ? 0 : a.Amount, a.AboveCap, a.Status.ToString(), a.CreatedAt);

    private static PenaltyRowDto Row(Penalty p, PenaltyType? t) => new(
        p.Id, p.PenaltyNo, p.Category.ToString(), p.PenaltyTypeId, p.EmployeeId, p.EmployeeName, t?.NameAr, t?.NameEn, p.Effect.ToString(), p.ViolationDate, p.Description,
        p.Days, p.Amount, p.Period, p.AboveCap, p.Status.ToString(), p.CreatedAt);
}
