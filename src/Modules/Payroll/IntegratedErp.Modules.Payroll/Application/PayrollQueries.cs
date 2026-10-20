using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

public sealed record PayrollRunItemDto(
    Guid Id,
    string RunNo,
    string Group,
    Guid LegalEntityId,
    string LegalEntityName,
    DateOnly From,
    DateOnly To,
    string Status,
    bool AwaitingApproval,
    int Workers,
    int Excluded,
    decimal Net,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ApprovedAt);

public sealed record PayrollTotalsDto(
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
    decimal Net,
    decimal GosiEmployee = 0,
    decimal GosiEmployer = 0);

/// <summary>An earlier approved run of the same registration: its period and totals (the comparison and the trend).</summary>
public sealed record PayrollPastRunDto(Guid Id, string RunNo, DateOnly From, DateOnly To, PayrollTotalsDto Totals);

public sealed record PayrollProjectDto(Guid ProjectCrmId, string ProjectName, int Workers, decimal Net);

/// <summary>
/// Who of the registration's workers the run pays and who it leaves out, by reason: the coverage card. <see cref="Eligible"/>
/// = paid + not approved + without a timesheet + paid in another run.
/// </summary>
public sealed record PayrollCoverageDto(int Eligible, int Paid, int TimesheetNotApproved, int NoTimesheet, int PaidElsewhere, int NetNotPositive);

public sealed record PayrollRunDto(
    Guid Id,
    string RunNo,
    string Group,
    Guid LegalEntityId,
    string LegalEntityName,
    DateOnly From,
    DateOnly To,
    string Status,
    bool AwaitingApproval,
    bool CanEdit,
    bool CanDelete,
    DateTimeOffset CreatedAt,
    string CreatedByName,
    DateTimeOffset CalculatedAt,
    DateTimeOffset? SubmittedAt,
    DateTimeOffset? ApprovedAt,
    string? ApprovedByName,
    string? LastComment,
    PayrollTotalsDto Totals,
    PayrollPastRunDto? Previous,
    IReadOnlyList<PayrollPastRunDto> Trend,
    PayrollCoverageDto Coverage,
    IReadOnlyList<PayrollProjectDto> Projects,
    IReadOnlyDictionary<string, int> Notes,
    ApprovalStatusInfo? Approval);

public sealed record PayrollLineDto(
    Guid Id,
    Guid WorkerId,
    string WorkerNo,
    string Name,
    string? ProfessionCode,
    string? ProfessionAr,
    string? ProfessionEn,
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
    decimal Additions,
    decimal Allowances,
    decimal Deductions,
    decimal Net,
    IReadOnlyList<string> Notes,
    string GosiCategory = "",
    decimal GosiBase = 0,
    decimal GosiEmployee = 0,
    decimal GosiEmployer = 0);

/// <summary>The sums of the whole filtered scope (not of the page).</summary>
public sealed record PayrollLineSumsDto(int Workers, decimal PaidDays, decimal Base, decimal Housing, decimal Food, decimal Transport, decimal OtherAllowances, decimal Overtime, decimal Additions, decimal Allowances, decimal Deductions, decimal Net);

public sealed record PayrollLinePageDto(IReadOnlyList<PayrollLineDto> Items, int Total, int Page, int PageSize, PayrollLineSumsDto Sums);

public sealed record PayrollSourceDto(
    Guid TimesheetLineId,
    Guid TimesheetId,
    string TimesheetNo,
    Guid ProjectCrmId,
    string ProjectName,
    DateOnly LineFrom,
    DateOnly LineTo,
    decimal WorkDays,
    decimal DayDivisor,
    decimal AbsenceDays,
    decimal PaySalary,
    decimal SalaryPart,
    decimal Overtime,
    decimal OvertimeHours,
    decimal ClientAdditions,
    decimal ClientDeductions,
    decimal CustomerLoans,
    decimal InternalAdditions,
    decimal InternalDeductions,
    decimal Net);

public sealed record PayrollLineDetailDto(PayrollLineDto Line, decimal ClientAdditions, decimal InternalAdditions, decimal ClientDeductions, decimal CustomerLoans, decimal InternalDeductions, IReadOnlyList<PayrollSourceDto> Sources);

public sealed record PayrollExclusionDto(Guid Id, string Kind, Guid WorkerId, string WorkerNo, string Name, string? ProjectName, string? Reference);

public sealed record SponsorLinkDto(string Sponsor, Guid? LegalEntityId, string? LegalEntityName);

public sealed record LineQuery(string? Search, string? Note, Guid? Project, string? Sort, bool Desc, int Page, int PageSize);

/// <summary>The payroll runs, one run with its KPIs, its lines page by page (filtered and sorted on the server), and a worker's detail.</summary>
internal sealed class PayrollQueries(PayrollDbContext db, IApprovalService approvals, IReferenceData reference, ILegalEntityDirectory legalEntities, IPermissionService permissions)
{
    public async Task<IReadOnlyList<PayrollRunItemDto>> ListAsync(Guid? legalEntityId, CancellationToken cancellationToken) =>
        await db.Runs.AsNoTracking()
            .Where(r => legalEntityId == null || r.LegalEntityId == legalEntityId)
            .OrderByDescending(r => r.To).ThenByDescending(r => r.CreatedAt)
            .Select(r => new PayrollRunItemDto(r.Id, r.RunNo, r.Group.ToString(), r.LegalEntityId, r.LegalEntityName, r.From, r.To, r.Status.ToString(), r.AwaitingApproval,
                r.Totals.Workers, r.Totals.Excluded, r.Totals.Net, r.CreatedAt, r.ApprovedAt))
            .ToListAsync(cancellationToken).ConfigureAwait(false);

    public async Task<PayrollRunDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var r = await db.Runs.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);
        if (r is null)
        {
            return null;
        }

        // The approved runs of the registration before this one: the latest is the comparison, five make the trend.
        var past = await db.Runs.AsNoTracking()
            .Where(x => x.LegalEntityId == r.LegalEntityId && x.Group == r.Group && x.Status == PayrollStatus.Approved && x.To < r.From)
            .OrderByDescending(x => x.To).Take(5)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var trend = past.OrderBy(x => x.To).Select(x => new PayrollPastRunDto(x.Id, x.RunNo, x.From, x.To, Totals(x.Totals))).ToList();

        var kinds = await db.Exclusions.AsNoTracking().Where(e => e.RunId == id)
            .GroupBy(e => e.Kind).Select(g => new { g.Key, Workers = g.Select(e => e.WorkerId).Distinct().Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Workers, cancellationToken).ConfigureAwait(false);
        int Count(PayrollExclusionKind kind) => kinds.GetValueOrDefault(kind);
        var coverage = new PayrollCoverageDto(
            r.Totals.Workers + r.Totals.Excluded, r.Totals.Workers,
            Count(PayrollExclusionKind.TimesheetNotApproved), Count(PayrollExclusionKind.NoTimesheet), Count(PayrollExclusionKind.PaidElsewhere), Count(PayrollExclusionKind.NetNotPositive));

        var projects = (await db.Sources.AsNoTracking().Where(s => s.RunId == id)
                .Select(s => new { s.ProjectCrmId, s.ProjectName, s.LineId, s.Net })
                .ToListAsync(cancellationToken).ConfigureAwait(false))
            .GroupBy(s => (s.ProjectCrmId, s.ProjectName))
            .Select(g => new PayrollProjectDto(g.Key.ProjectCrmId, g.Key.ProjectName, g.Select(s => s.LineId).Distinct().Count(), g.Sum(s => s.Net)))
            .OrderByDescending(p => p.Net)
            .ToList();

        var notes = (await db.Lines.AsNoTracking().Where(l => l.RunId == id && l.Notes != "").Select(l => l.Notes).ToListAsync(cancellationToken).ConfigureAwait(false))
            .SelectMany(n => n.Split(',', StringSplitOptions.RemoveEmptyEntries))
            .GroupBy(n => n).ToDictionary(g => g.Key, g => g.Count());

        var canManage = (await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(PayrollPermissions.WorkersManage);
        var approval = await approvals.StatusAsync(PayrollAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false);
        return new PayrollRunDto(
            r.Id, r.RunNo, r.Group.ToString(), r.LegalEntityId, r.LegalEntityName, r.From, r.To, r.Status.ToString(), r.AwaitingApproval,
            CanEdit: canManage && r.IsEditable, CanDelete: canManage && r.IsEditable,
            r.CreatedAt, r.CreatedByName, r.CalculatedAt, r.SubmittedAt, r.ApprovedAt, r.ApprovedByName, r.LastComment,
            Totals(r.Totals), trend.LastOrDefault(), trend, coverage, projects, notes, approval);
    }

    public async Task<PayrollLinePageDto?> LinesAsync(Guid id, LineQuery q, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(q);
        if (!await db.Runs.AnyAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false))
        {
            return null;
        }

        var lines = Filtered(id, q);
        var sums = await lines.GroupBy(_ => 1).Select(g => new PayrollLineSumsDto(
                g.Count(), g.Sum(l => l.PaidDays), g.Sum(l => l.Base), g.Sum(l => l.Housing), g.Sum(l => l.Food), g.Sum(l => l.Transport), g.Sum(l => l.OtherAllowances),
                g.Sum(l => l.Overtime), g.Sum(l => l.ClientAdditions + l.InternalAdditions), g.Sum(l => l.Allowances), g.Sum(l => l.Deductions), g.Sum(l => l.Net)))
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false)
            ?? new PayrollLineSumsDto(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

        var size = Math.Clamp(q.PageSize, 1, 100);
        var page = Math.Max(1, q.Page);
        var rows = await Sorted(lines, q.Sort, q.Desc).Skip((page - 1) * size).Take(size).ToListAsync(cancellationToken).ConfigureAwait(false);
        var professions = await ProfessionsAsync(cancellationToken).ConfigureAwait(false);
        return new PayrollLinePageDto(rows.Select(l => ToDto(l, professions)).ToList(), sums.Workers, page, size, sums);
    }

    /// <summary>Every line of the filtered scope, in the chosen order (the Excel export).</summary>
    public async Task<(PayrollRun Run, IReadOnlyList<PayrollLineDto> Lines)?> ScopeAsync(Guid id, LineQuery q, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(q);
        var run = await db.Runs.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false);
        if (run is null)
        {
            return null;
        }

        var rows = await Sorted(Filtered(id, q), q.Sort, q.Desc).ToListAsync(cancellationToken).ConfigureAwait(false);
        var professions = await ProfessionsAsync(cancellationToken).ConfigureAwait(false);
        return (run, rows.Select(l => ToDto(l, professions)).ToList());
    }

    public async Task<PayrollLineDetailDto?> LineAsync(Guid id, Guid lineId, CancellationToken cancellationToken)
    {
        var line = await db.Lines.AsNoTracking().Include(l => l.Sources).FirstOrDefaultAsync(l => l.RunId == id && l.Id == lineId, cancellationToken).ConfigureAwait(false);
        if (line is null)
        {
            return null;
        }

        var professions = await ProfessionsAsync(cancellationToken).ConfigureAwait(false);
        return new PayrollLineDetailDto(
            ToDto(line, professions), line.ClientAdditions, line.InternalAdditions, line.ClientDeductions, line.CustomerLoans, line.InternalDeductions,
            line.Sources.OrderBy(s => s.LineFrom).Select(s => new PayrollSourceDto(
                s.TimesheetLineId, s.TimesheetId, s.TimesheetNo, s.ProjectCrmId, s.ProjectName, s.LineFrom, s.LineTo, s.WorkDays, s.DayDivisor, s.AbsenceDays,
                s.PaySalary, s.SalaryPart, s.Overtime, s.OvertimeHours, s.ClientAdditions, s.ClientDeductions, s.CustomerLoans, s.InternalAdditions,
                s.InternalDeductions, s.Net)).ToList());
    }

    public async Task<IReadOnlyList<PayrollExclusionDto>?> ExclusionsAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await db.Runs.AnyAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false))
        {
            return null;
        }

        return await db.Exclusions.AsNoTracking().Where(e => e.RunId == id)
            .OrderBy(e => e.Kind).ThenBy(e => e.WorkerNo)
            .Select(e => new PayrollExclusionDto(e.Id, e.Kind.ToString(), e.WorkerId, e.WorkerNo, e.Name, e.ProjectName, e.Reference))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>The old system's company sponsors and the registration each is linked to.</summary>
    public async Task<IReadOnlyList<SponsorLinkDto>> SponsorsAsync(CancellationToken cancellationToken)
    {
        var entities = (await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).ToDictionary(e => e.Id);
        var links = await db.Sponsors.AsNoTracking().ToListAsync(cancellationToken).ConfigureAwait(false);
        var known = CompanySponsors.Where(s => !links.Any(l => string.Equals(l.Sponsor, s, StringComparison.OrdinalIgnoreCase)))
            .Select(s => new SponsorLinkDto(s, null, null));
        return links.Select(l => new SponsorLinkDto(l.Sponsor, l.LegalEntityId, entities.GetValueOrDefault(l.LegalEntityId)?.NameAr))
            .Concat(known)
            .OrderBy(s => s.Sponsor, StringComparer.OrdinalIgnoreCase).ToList();
    }

    /// <summary>The old system's sponsors that are the company's own registrations (new_sponseredby).</summary>
    private static readonly string[] CompanySponsors = ["Care-Pro - 05", "Care-pro - 07"];

    private IQueryable<PayrollLine> Filtered(Guid id, LineQuery q)
    {
        var lines = db.Lines.AsNoTracking().Where(l => l.RunId == id);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim();
            lines = lines.Where(l => l.Name.Contains(term) || l.WorkerNo.Contains(term) || l.ProjectName.Contains(term));
        }

        if (q.Project is { } project)
        {
            lines = lines.Where(l => l.ProjectCrmId == project);
        }

        if (!string.IsNullOrWhiteSpace(q.Note))
        {
            lines = q.Note == "any" ? lines.Where(l => l.Notes != "") : q.Note == "none" ? lines.Where(l => l.Notes == "") : lines.Where(l => ("," + l.Notes + ",").Contains("," + q.Note + ","));
        }

        return lines;
    }

    private static IQueryable<PayrollLine> Sorted(IQueryable<PayrollLine> lines, string? sort, bool desc) => (sort, desc) switch
    {
        ("name", false) => lines.OrderBy(l => l.Name),
        ("name", true) => lines.OrderByDescending(l => l.Name),
        ("project", false) => lines.OrderBy(l => l.ProjectName).ThenBy(l => l.WorkerNo),
        ("project", true) => lines.OrderByDescending(l => l.ProjectName).ThenBy(l => l.WorkerNo),
        ("days", false) => lines.OrderBy(l => l.PaidDays).ThenBy(l => l.WorkerNo),
        ("days", true) => lines.OrderByDescending(l => l.PaidDays).ThenBy(l => l.WorkerNo),
        ("base", false) => lines.OrderBy(l => l.Base).ThenBy(l => l.WorkerNo),
        ("base", true) => lines.OrderByDescending(l => l.Base).ThenBy(l => l.WorkerNo),
        ("allowances", false) => lines.OrderBy(l => l.Allowances).ThenBy(l => l.WorkerNo),
        ("allowances", true) => lines.OrderByDescending(l => l.Allowances).ThenBy(l => l.WorkerNo),
        ("deductions", false) => lines.OrderBy(l => l.Deductions).ThenBy(l => l.WorkerNo),
        ("deductions", true) => lines.OrderByDescending(l => l.Deductions).ThenBy(l => l.WorkerNo),
        ("net", false) => lines.OrderBy(l => l.Net).ThenBy(l => l.WorkerNo),
        ("net", true) => lines.OrderByDescending(l => l.Net).ThenBy(l => l.WorkerNo),
        (_, true) => lines.OrderByDescending(l => l.WorkerNo),
        _ => lines.OrderBy(l => l.WorkerNo),
    };

    private async Task<Dictionary<string, ReferenceItemInfo>> ProfessionsAsync(CancellationToken cancellationToken) =>
        (await reference.ListAllAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false)).ToDictionary(i => i.Code, StringComparer.Ordinal);

    private static PayrollLineDto ToDto(PayrollLine l, Dictionary<string, ReferenceItemInfo> professions)
    {
        var profession = l.ProfessionCode is { } pc ? professions.GetValueOrDefault(pc) : null;
        return new PayrollLineDto(
            l.Id, l.WorkerId, l.WorkerNo, l.Name, l.ProfessionCode, profession?.NameAr, profession?.NameEn, l.StatusAr, l.StatusEn,
            l.ProjectCrmId, l.ProjectName, l.Projects, l.MonthlySalary, l.PaidDays, l.AbsenceDays, l.Base, l.Housing, l.Food, l.Transport,
            l.OtherAllowances, l.Overtime, l.ClientAdditions + l.InternalAdditions, l.Allowances, l.Deductions, l.Net,
            l.Notes.Split(',', StringSplitOptions.RemoveEmptyEntries), l.GosiCategory, l.GosiBase, l.GosiEmployee, l.GosiEmployer);
    }

    private static PayrollTotalsDto Totals(PayrollTotals t) =>
        new(t.Workers, t.Excluded, t.PaidDays, t.Base, t.Housing, t.Food, t.Transport, t.OtherAllowances, t.Overtime, t.Additions, t.Allowances, t.Deductions, t.Net, t.GosiEmployee, t.GosiEmployer);
}
