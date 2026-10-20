using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

public sealed record StaffRunItemDto(Guid Id, string RunNo, Guid LegalEntityId, string LegalEntityName, string Period, DateOnly From, DateOnly To, string Status, bool AwaitingApproval, int Employees, decimal Net, DateTimeOffset CreatedAt, DateTimeOffset? ApprovedAt);

public sealed record StaffTotalsDto(
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
    decimal Net);

public sealed record StaffPastRunDto(Guid Id, string RunNo, string Period, StaffTotalsDto Totals);

public sealed record StaffDepartmentSumDto(Guid? DepartmentId, string? NameAr, string? NameEn, int Employees, decimal Gross, decimal Deductions, decimal Net, decimal GosiEmployer);

public sealed record StaffGosiSumDto(string Category, int Employees, decimal Base, decimal Employee, decimal Employer);

public sealed record StaffRunDto(
    Guid Id,
    string RunNo,
    Guid LegalEntityId,
    string LegalEntityName,
    string Period,
    DateOnly From,
    DateOnly To,
    string Status,
    bool AwaitingApproval,
    bool CanEdit,
    DateTimeOffset CreatedAt,
    string CreatedByName,
    DateTimeOffset CalculatedAt,
    DateTimeOffset? SubmittedAt,
    DateTimeOffset? ApprovedAt,
    string? ApprovedByName,
    string? LastComment,
    StaffTotalsDto Totals,
    StaffPastRunDto? Previous,
    IReadOnlyList<StaffPastRunDto> Trend,
    IReadOnlyList<StaffDepartmentSumDto> Departments,
    IReadOnlyList<StaffGosiSumDto> Gosi,
    IReadOnlyDictionary<string, int> Notes,
    ApprovalStatusInfo? Approval);

public sealed record StaffLineDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeNo,
    string Name,
    string? DepartmentAr,
    string? DepartmentEn,
    string? JobTitleAr,
    string? JobTitleEn,
    decimal MonthlySalary,
    decimal ServiceDays,
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
    decimal Deductions,
    decimal Deferred,
    decimal Net,
    IReadOnlyList<string> Notes);

/// <summary>The sums of the whole filtered scope (not of the page).</summary>
public sealed record StaffLineSumsDto(int Employees, decimal Basic, decimal Housing, decimal OtherAllowances, decimal Overtime, decimal Allowances, decimal Absence, decimal Penalties, decimal Advances, decimal OtherDeductions, decimal GosiEmployee, decimal Deductions, decimal Net);

public sealed record StaffLinePageDto(IReadOnlyList<StaffLineDto> Items, int Total, int Page, int PageSize, StaffLineSumsDto Sums);

public sealed record StaffItemDto(Guid Id, string Kind, Guid SourceId, string Reference, string Description, string? Period, decimal Days, decimal Due, decimal Deducted, bool Deferred, bool AboveCap);

public sealed record StaffAdjustmentDto(Guid Id, string Kind, decimal Amount, string Reason, string CreatedByName, DateTimeOffset CreatedAt);

public sealed record StaffLineDetailDto(
    StaffLineDto Line,
    decimal MonthlyBasic,
    decimal UnpaidDays,
    decimal AbsenceOnly,
    decimal LateMinutes,
    decimal Late,
    decimal SickPartDays,
    decimal SickPart,
    decimal OvertimeHours,
    decimal Gross,
    string GosiCategory,
    decimal GosiBase,
    decimal GosiEmployer,
    decimal CapLimit,
    string? BankName,
    string? Iban,
    IReadOnlyList<StaffItemDto> Items,
    IReadOnlyList<StaffAdjustmentDto> Adjustments);

public sealed record StaffDeferredDto(Guid LineId, Guid EmployeeId, string EmployeeNo, string Name, string Kind, string Reference, string Description, decimal Due, decimal Deducted, decimal Deferred);

public sealed record StaffEmployeeRunDto(Guid RunId, Guid LineId, string RunNo, string Period, string Status, decimal PaidDays, decimal Gross, decimal Deductions, decimal Net);

public sealed record StaffLineQuery(string? Search, Guid? Department, string? Note, string? Sort, bool Desc, int Page, int PageSize);

/// <summary>The staff payroll runs, one run with its KPIs and summaries, its lines page by page (on the server), a line's detail, and the deferred items.</summary>
internal sealed class StaffPayrollQueries(PayrollDbContext db, IApprovalService approvals, IPermissionService permissions)
{
    public async Task<IReadOnlyList<StaffRunItemDto>> ListAsync(Guid? legalEntityId, string? tab, CancellationToken cancellationToken)
    {
        var q = db.StaffRuns.AsNoTracking().Where(r => legalEntityId == null || r.LegalEntityId == legalEntityId);
        q = tab switch
        {
            "pending" => q.Where(r => r.Status == PayrollStatus.InApproval),
            "approved" => q.Where(r => r.Status == PayrollStatus.Approved),
            "open" => q.Where(r => r.Status == PayrollStatus.Draft || r.Status == PayrollStatus.Returned),
            _ => q,
        };
        return await q.OrderByDescending(r => r.Period).ThenBy(r => r.LegalEntityName)
            .Select(r => new StaffRunItemDto(r.Id, r.RunNo, r.LegalEntityId, r.LegalEntityName, r.Period, r.From, r.To, r.Status.ToString(), r.AwaitingApproval, r.Totals.Employees, r.Totals.Net, r.CreatedAt, r.ApprovedAt))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<StaffRunDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var r = await db.StaffRuns.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);
        if (r is null)
        {
            return null;
        }

#pragma warning disable CA1309 // EF translates string.Compare to SQL; the periods are ASCII "YYYY-MM".
        var past = await db.StaffRuns.AsNoTracking()
            .Where(x => x.LegalEntityId == r.LegalEntityId && x.Status == PayrollStatus.Approved && string.Compare(x.Period, r.Period) < 0)
#pragma warning restore CA1309
            .OrderByDescending(x => x.Period).Take(5).ToListAsync(cancellationToken).ConfigureAwait(false);
        var trend = past.OrderBy(x => x.Period, StringComparer.Ordinal).Select(x => new StaffPastRunDto(x.Id, x.RunNo, x.Period, Totals(x.Totals))).ToList();

        var lines = await db.StaffLines.AsNoTracking().Where(l => l.RunId == id)
            .Select(l => new { l.DepartmentId, l.DepartmentAr, l.DepartmentEn, l.Gross, l.Deductions, l.Net, l.GosiCategory, l.GosiBase, l.GosiEmployee, l.GosiEmployer, l.Notes })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var departments = lines.GroupBy(l => (l.DepartmentId, l.DepartmentAr, l.DepartmentEn))
            .Select(g => new StaffDepartmentSumDto(g.Key.DepartmentId, g.Key.DepartmentAr, g.Key.DepartmentEn, g.Count(), g.Sum(l => l.Gross), g.Sum(l => l.Deductions), g.Sum(l => l.Net), g.Sum(l => l.GosiEmployer)))
            .OrderByDescending(d => d.Net).ToList();
        var gosi = lines.GroupBy(l => l.GosiCategory)
            .Select(g => new StaffGosiSumDto(g.Key, g.Count(), g.Sum(l => l.GosiBase), g.Sum(l => l.GosiEmployee), g.Sum(l => l.GosiEmployer)))
            .OrderBy(g => g.Category, StringComparer.Ordinal).ToList();
        var notes = lines.Where(l => l.Notes != "").SelectMany(l => l.Notes.Split(',', StringSplitOptions.RemoveEmptyEntries))
            .GroupBy(n => n).ToDictionary(g => g.Key, g => g.Count());

        var canManage = (await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(PayrollPermissions.StaffManage);
        var approval = await approvals.StatusAsync(StaffPayrollAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false);
        return new StaffRunDto(
            r.Id, r.RunNo, r.LegalEntityId, r.LegalEntityName, r.Period, r.From, r.To, r.Status.ToString(), r.AwaitingApproval, canManage && r.IsEditable,
            r.CreatedAt, r.CreatedByName, r.CalculatedAt, r.SubmittedAt, r.ApprovedAt, r.ApprovedByName, r.LastComment,
            Totals(r.Totals), trend.LastOrDefault(), trend, departments, gosi, notes, approval);
    }

    public async Task<StaffLinePageDto?> LinesAsync(Guid id, StaffLineQuery q, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(q);
        if (!await db.StaffRuns.AnyAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false))
        {
            return null;
        }

        var lines = Filtered(id, q);
        var sums = await lines.GroupBy(_ => 1).Select(g => new StaffLineSumsDto(
                g.Count(), g.Sum(l => l.Basic), g.Sum(l => l.Housing), g.Sum(l => l.OtherAllowances), g.Sum(l => l.Overtime), g.Sum(l => l.Allowances),
                g.Sum(l => l.Absence + l.Late + l.SickPart), g.Sum(l => l.Penalties), g.Sum(l => l.Advances), g.Sum(l => l.OtherDeductions), g.Sum(l => l.GosiEmployee),
                g.Sum(l => l.Deductions), g.Sum(l => l.Net)))
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false)
            ?? new StaffLineSumsDto(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        var size = Math.Clamp(q.PageSize, 1, 100);
        var page = Math.Max(1, q.Page);
        var rows = await Sorted(lines, q.Sort, q.Desc).Skip((page - 1) * size).Take(size).ToListAsync(cancellationToken).ConfigureAwait(false);
        return new StaffLinePageDto(rows.Select(ToDto).ToList(), sums.Employees, page, size, sums);
    }

    /// <summary>Every line of the filtered scope, in the chosen order (the Excel register).</summary>
    public async Task<(StaffPayrollRun Run, IReadOnlyList<StaffLineDto> Lines)?> ScopeAsync(Guid id, StaffLineQuery q, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(q);
        var run = await db.StaffRuns.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (run is null)
        {
            return null;
        }

        var rows = await Sorted(Filtered(id, q), q.Sort, q.Desc).ToListAsync(cancellationToken).ConfigureAwait(false);
        return (run, rows.Select(ToDto).ToList());
    }

    public async Task<StaffLineDetailDto?> LineAsync(Guid id, Guid lineId, CancellationToken cancellationToken)
    {
        var l = await db.StaffLines.AsNoTracking().Include(x => x.Items).FirstOrDefaultAsync(x => x.RunId == id && x.Id == lineId, cancellationToken).ConfigureAwait(false);
        if (l is null)
        {
            return null;
        }

        var adjustments = await db.StaffAdjustments.AsNoTracking().Where(a => a.RunId == id && a.EmployeeId == l.EmployeeId).OrderBy(a => a.CreatedAt)
            .Select(a => new StaffAdjustmentDto(a.Id, a.Kind.ToString(), a.Amount, a.Reason, a.CreatedByName, a.CreatedAt))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var granted = await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false);
        var fullIban = granted.Has(PayrollPermissions.StaffManage) || granted.Has("staff.bank.manage");
        return new StaffLineDetailDto(
            ToDto(l), l.MonthlyBasic, l.UnpaidDays, l.Absence, l.LateMinutes, l.Late, l.SickPartDays, l.SickPart, l.OvertimeHours, l.Gross,
            l.GosiCategory, l.GosiBase, l.GosiEmployer, l.CapLimit, l.BankName, fullIban ? l.Iban : Masked(l.Iban),
            l.Items.OrderBy(i => i.Kind).ThenBy(i => i.Period).Select(i => new StaffItemDto(i.Id, i.Kind.ToString(), i.SourceId, i.Reference, i.Description, i.Period, i.Days, i.Due, i.Deducted, i.Deferred, i.AboveCap)).ToList(),
            adjustments);
    }

    /// <summary>An employee's lines in the staff runs, latest first (the employee file's «payroll» tab).</summary>
    public async Task<IReadOnlyList<StaffEmployeeRunDto>> EmployeeAsync(Guid employeeId, CancellationToken cancellationToken) =>
        await (from l in db.StaffLines.AsNoTracking()
               join r in db.StaffRuns.AsNoTracking() on l.RunId equals r.Id
               where l.EmployeeId == employeeId
               orderby r.Period descending
               select new StaffEmployeeRunDto(r.Id, l.Id, r.RunNo, r.Period, r.Status.ToString(), l.PaidDays, l.Gross, l.Deductions, l.Net))
            .Take(36).ToListAsync(cancellationToken).ConfigureAwait(false);

    public async Task<IReadOnlyList<StaffDeferredDto>?> DeferredAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await db.StaffRuns.AnyAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false))
        {
            return null;
        }

        return await (from i in db.StaffItems.AsNoTracking()
                      join l in db.StaffLines.AsNoTracking() on i.LineId equals l.Id
                      where i.RunId == id && i.Deferred
                      orderby l.EmployeeNo
                      select new StaffDeferredDto(l.Id, l.EmployeeId, l.EmployeeNo, l.Name, i.Kind.ToString(), i.Reference, i.Description, i.Due, i.Deducted, i.Due - i.Deducted))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    private IQueryable<StaffPayrollLine> Filtered(Guid id, StaffLineQuery q)
    {
        var lines = db.StaffLines.AsNoTracking().Where(l => l.RunId == id);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim();
            lines = lines.Where(l => l.Name.Contains(term) || l.EmployeeNo.Contains(term));
        }

        if (q.Department is { } department)
        {
            lines = lines.Where(l => l.DepartmentId == department);
        }

        if (!string.IsNullOrWhiteSpace(q.Note))
        {
            lines = q.Note == "any" ? lines.Where(l => l.Notes != "") : lines.Where(l => ("," + l.Notes + ",").Contains("," + q.Note + ","));
        }

        return lines;
    }

    private static IQueryable<StaffPayrollLine> Sorted(IQueryable<StaffPayrollLine> lines, string? sort, bool desc) => (sort, desc) switch
    {
        ("name", false) => lines.OrderBy(l => l.Name),
        ("name", true) => lines.OrderByDescending(l => l.Name),
        ("department", false) => lines.OrderBy(l => l.DepartmentAr).ThenBy(l => l.EmployeeNo),
        ("department", true) => lines.OrderByDescending(l => l.DepartmentAr).ThenBy(l => l.EmployeeNo),
        ("days", false) => lines.OrderBy(l => l.PaidDays).ThenBy(l => l.EmployeeNo),
        ("days", true) => lines.OrderByDescending(l => l.PaidDays).ThenBy(l => l.EmployeeNo),
        ("basic", false) => lines.OrderBy(l => l.Basic).ThenBy(l => l.EmployeeNo),
        ("basic", true) => lines.OrderByDescending(l => l.Basic).ThenBy(l => l.EmployeeNo),
        ("allowances", false) => lines.OrderBy(l => l.Allowances).ThenBy(l => l.EmployeeNo),
        ("allowances", true) => lines.OrderByDescending(l => l.Allowances).ThenBy(l => l.EmployeeNo),
        ("deductions", false) => lines.OrderBy(l => l.Deductions).ThenBy(l => l.EmployeeNo),
        ("deductions", true) => lines.OrderByDescending(l => l.Deductions).ThenBy(l => l.EmployeeNo),
        ("net", false) => lines.OrderBy(l => l.Net).ThenBy(l => l.EmployeeNo),
        ("net", true) => lines.OrderByDescending(l => l.Net).ThenBy(l => l.EmployeeNo),
        (_, true) => lines.OrderByDescending(l => l.EmployeeNo),
        _ => lines.OrderBy(l => l.EmployeeNo),
    };

    private static StaffLineDto ToDto(StaffPayrollLine l) => new(
        l.Id, l.EmployeeId, l.EmployeeNo, l.Name, l.DepartmentAr, l.DepartmentEn, l.JobTitleAr, l.JobTitleEn, l.MonthlySalary, l.ServiceDays, l.PaidDays,
        l.Basic, l.Housing, l.OtherAllowances, l.Overtime, l.Additions, l.Allowances, l.Absence + l.Late + l.SickPart, l.Penalties, l.Advances, l.OtherDeductions,
        l.GosiEmployee, l.Deductions, l.Deferred, l.Net, l.Notes.Split(',', StringSplitOptions.RemoveEmptyEntries));

    private static string? Masked(string? iban) => iban is { Length: > 8 } ? $"{iban[..2]}•• •••• {iban[^4..]}" : iban;

    private static StaffTotalsDto Totals(StaffRunTotals t) => new(
        t.Employees, t.NoSalary, t.WithoutIban, t.Joiners, t.Leavers, t.PaidDays, t.Basic, t.Housing, t.OtherAllowances, t.Overtime, t.Additions, t.Allowances,
        t.Absence, t.Penalties, t.Advances, t.OtherDeductions, t.GosiEmployee, t.GosiEmployer, t.Deductions, t.Deferred, t.Net);
}
