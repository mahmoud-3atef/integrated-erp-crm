using System.Text.Json;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Staff.Domain;
using IntegratedErp.Modules.Staff.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Staff.Application;

public sealed record StaffRowDto(
    Guid Id,
    string EmployeeNo,
    string Name,
    string NameEn,
    string? NationalityAr,
    string? NationalityEn,
    string? DepartmentAr,
    string? DepartmentEn,
    string? JobTitleAr,
    string? JobTitleEn,
    string Status,
    string? LegacyStatusAr,
    DateOnly? HireDate,
    DateOnly? ProbationEndsOn,
    DateOnly? ContractEndsOn,
    int Completeness);

public sealed record StaffPageDto(IReadOnlyList<StaffRowDto> Items, int Total, int Page, int PageSize);

public sealed record StaffKpisDto(
    int Employees,
    int Active,
    int Probation,
    int Suspended,
    int Left,
    int ProbationEndingIn30,
    int ContractsEndingIn90,
    int ContractsEndingIn60,
    int ContractsEndingIn30,
    int Incomplete,
    int Vacancies,
    int DepartmentsWithVacancies);

public sealed record StaffQuery(string? Search, string? Tab, Guid? DepartmentId, Guid? LegalEntityId, string? Sort, bool Desc, int Page, int PageSize);

public sealed record SalaryDto(Guid Id, DateOnly EffectiveFrom, decimal Basic, decimal Housing, decimal Food, decimal Transport, decimal Mobile, decimal Project, decimal Other, decimal Total, string Source, string? Reason, string CreatedByName, DateTimeOffset CreatedAt);

public sealed record NamedRef(Guid Id, string NameAr, string NameEn);

public sealed record StaffProfileDto(
    Guid Id,
    string EmployeeNo,
    string? NameAr,
    string NameEn,
    string? IdNumber,
    string? NationalityCode,
    string? NationalityAr,
    string? NationalityEn,
    DateOnly? BirthDate,
    string? Mobile,
    string? Email,
    string? GosiNo,
    string Status,
    string? LegacyStatusAr,
    string? LegacyStatusEn,
    string? Sponsor,
    DateOnly? HireDate,
    DateOnly? ProbationEndsOn,
    NamedRef? LegalEntity,
    NamedRef? Department,
    Guid? PositionId,
    NamedRef? JobTitle,
    string? Grade,
    NamedRef? Manager,
    DateOnly? ContractStartsOn,
    int? ContractMonths,
    DateOnly? ContractEndsOn,
    decimal? AnnualLeaveDays,
    decimal? LeaveBalance,
    decimal? LeaveConsumed,
    decimal? LeaveOldConsumed,
    decimal? LeaveRemaining,
    SalaryDto? Salary,
    int SalaryChanges,
    int Completeness,
    IReadOnlyList<string> Missing,
    string CreatedByName,
    DateTimeOffset CreatedAt,
    bool CanEdit,
    bool CanSeeSalary,
    bool CanChangeSalary);

public sealed record PositionDto(Guid Id, Guid DepartmentId, Guid JobTitleId, string JobTitleAr, string JobTitleEn, Guid? GradeId, string? Grade, Guid? ReportsToId, int Seats, bool IsActive, IReadOnlyList<NamedRef> Occupants);

public sealed record DepartmentDto(Guid Id, Guid? ParentId, string NameAr, string NameEn, string? CostCenter, NamedRef? Manager, int SortOrder, bool IsActive, int Employees, IReadOnlyList<PositionDto> Positions);

public sealed record StructureDto(IReadOnlyList<DepartmentDto> Departments, int Employees, int Unassigned, int Vacancies);

public sealed record JobTitleDto(Guid Id, string NameAr, string NameEn, string? OccupationCode, bool IsActive, int Positions);

public sealed record GradeDto(Guid Id, string Code, string NameAr, decimal? MinBasic, decimal? MaxBasic, bool IsActive, int Positions);

public sealed record CatalogDto(IReadOnlyList<JobTitleDto> JobTitles, IReadOnlyList<GradeDto> Grades);

public sealed record StaffEventDto(string Kind, DateTimeOffset At, string By, IReadOnlyDictionary<string, JsonElement>? Changes, SalaryDto? Salary);

/// <summary>The staff directory (paged and filtered on the server) with its cards, an employee's file, the organisation, the catalogues and a file's history.</summary>
internal sealed class StaffQueries(StaffDbContext db, ILegalEntityDirectory legalEntities, IPermissionService permissions, IClock clock)
{
    public async Task<StaffPageDto> DirectoryAsync(StaffQuery q, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(q);
        var today = clock.Today;
        var employees = db.Employees.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim();
            employees = employees.Where(e => e.EmployeeNo.Contains(term) || e.NameEn.Contains(term) || (e.NameAr != null && e.NameAr.Contains(term)) || (e.IdNumber != null && e.IdNumber.Contains(term)));
        }

        if (q.DepartmentId is { } d)
        {
            employees = employees.Where(e => e.DepartmentId == d);
        }

        if (q.LegalEntityId is { } le)
        {
            employees = employees.Where(e => e.LegalEntityId == le);
        }

        var in90 = today.AddDays(90);
        employees = q.Tab switch
        {
            "active" => employees.Where(e => e.Status == StaffStatus.Active),
            "probation" => employees.Where(e => e.Status == StaffStatus.Probation),
            "ending" => employees.Where(e => e.Status != StaffStatus.Left && e.ContractEndsOn != null && e.ContractEndsOn >= today && e.ContractEndsOn <= in90),
            "incomplete" => employees.Where(e => e.Status != StaffStatus.Left && (e.DepartmentId == null || e.PositionId == null)),
            "left" => employees.Where(e => e.Status == StaffStatus.Left),
            _ => employees.Where(e => e.Status != StaffStatus.Left),
        };

        var total = await employees.CountAsync(cancellationToken).ConfigureAwait(false);
        employees = (q.Sort, q.Desc) switch
        {
            ("name", false) => employees.OrderBy(e => e.NameAr ?? e.NameEn),
            ("name", true) => employees.OrderByDescending(e => e.NameAr ?? e.NameEn),
            ("hire", false) => employees.OrderBy(e => e.HireDate).ThenBy(e => e.EmployeeNo),
            ("hire", true) => employees.OrderByDescending(e => e.HireDate).ThenBy(e => e.EmployeeNo),
            ("contract", false) => employees.OrderBy(e => e.ContractEndsOn == null).ThenBy(e => e.ContractEndsOn).ThenBy(e => e.EmployeeNo),
            ("contract", true) => employees.OrderByDescending(e => e.ContractEndsOn).ThenBy(e => e.EmployeeNo),
            (_, true) => employees.OrderByDescending(e => e.EmployeeNo),
            _ => employees.OrderBy(e => e.EmployeeNo),
        };
        var size = Math.Clamp(q.PageSize, 1, 100);
        var page = Math.Max(1, q.Page);
        var rows = await employees.Skip((page - 1) * size).Take(size).ToListAsync(cancellationToken).ConfigureAwait(false);
        var lookups = await LookupsAsync(cancellationToken).ConfigureAwait(false);
        var salaried = await SalariedAsync(rows.Select(r => r.Id).ToList(), cancellationToken).ConfigureAwait(false);
        return new StaffPageDto(rows.Select(e =>
        {
            var department = e.DepartmentId is { } dep ? lookups.Departments.GetValueOrDefault(dep) : null;
            var title = e.PositionId is { } p && lookups.Positions.GetValueOrDefault(p) is { } position ? lookups.Titles.GetValueOrDefault(position.JobTitleId) : null;
            return new StaffRowDto(e.Id, e.EmployeeNo, e.DisplayName, e.NameEn, e.NationalityAr, e.NationalityEn, department?.NameAr, department?.NameEn, title?.NameAr, title?.NameEn,
                e.Status.ToString(), e.LegacyStatusAr, e.HireDate, e.ProbationEndsOn, e.ContractEndsOn, Completeness(e, salaried.Contains(e.Id)).Score);
        }).ToList(), total, page, size);
    }

    public async Task<StaffKpisDto> KpisAsync(CancellationToken cancellationToken)
    {
        var today = clock.Today;
        var all = await db.Employees.AsNoTracking()
            .Select(e => new { e.Status, e.ProbationEndsOn, e.ContractEndsOn, e.DepartmentId, e.PositionId })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var current = all.Where(e => e.Status != StaffStatus.Left).ToList();
        bool Ending(DateOnly? end, int days) => end is { } e && e >= today && e <= today.AddDays(days);
        var positions = await db.Positions.AsNoTracking().Where(p => p.IsActive).Select(p => new { p.Id, p.DepartmentId, p.Seats }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var taken = current.Where(e => e.PositionId != null).GroupBy(e => e.PositionId!.Value).ToDictionary(g => g.Key, g => g.Count());
        var open = positions.Select(p => (p.DepartmentId, Free: Math.Max(0, p.Seats - taken.GetValueOrDefault(p.Id)))).Where(p => p.Free > 0).ToList();
        return new StaffKpisDto(
            current.Count,
            current.Count(e => e.Status == StaffStatus.Active),
            current.Count(e => e.Status == StaffStatus.Probation),
            current.Count(e => e.Status == StaffStatus.Suspended),
            all.Count(e => e.Status == StaffStatus.Left),
            current.Count(e => e.Status == StaffStatus.Probation && Ending(e.ProbationEndsOn, 30)),
            current.Count(e => Ending(e.ContractEndsOn, 90)),
            current.Count(e => Ending(e.ContractEndsOn, 60)),
            current.Count(e => Ending(e.ContractEndsOn, 30)),
            current.Count(e => e.DepartmentId == null || e.PositionId == null),
            open.Sum(p => p.Free),
            open.Select(p => p.DepartmentId).Distinct().Count());
    }

    public async Task<StaffProfileDto?> ProfileAsync(Guid id, CancellationToken cancellationToken)
    {
        var e = await db.Employees.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);
        if (e is null)
        {
            return null;
        }

        var lookups = await LookupsAsync(cancellationToken).ConfigureAwait(false);
        var salaries = await db.Salaries.AsNoTracking().Where(s => s.EmployeeId == id).OrderByDescending(s => s.EffectiveFrom).ThenByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var current = salaries.FirstOrDefault(s => s.EffectiveFrom <= clock.Today) ?? salaries.LastOrDefault();
        var position = e.PositionId is { } p ? lookups.Positions.GetValueOrDefault(p) : null;
        var title = position is not null ? lookups.Titles.GetValueOrDefault(position.JobTitleId) : null;
        var grade = position?.GradeId is { } g ? lookups.Grades.GetValueOrDefault(g) : null;
        var department = e.DepartmentId is { } d ? lookups.Departments.GetValueOrDefault(d) : null;
        var entity = e.LegalEntityId is { } le ? (await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(x => x.Id == le) : null;
        var manager = await ManagerAsync(e, position, lookups, cancellationToken).ConfigureAwait(false);
        var (score, missing) = Completeness(e, current is { Total: > 0 });
        var granted = await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false);
        var seeSalary = granted.Has(StaffPermissions.SalariesView);
        return new StaffProfileDto(
            e.Id, e.EmployeeNo, e.NameAr, e.NameEn, e.IdNumber, e.NationalityCode, e.NationalityAr, e.NationalityEn, e.BirthDate, e.Mobile, e.Email, e.GosiNo,
            e.Status.ToString(), e.LegacyStatusAr, e.LegacyStatusEn, e.Sponsor, e.HireDate, e.ProbationEndsOn,
            entity is null ? null : new NamedRef(entity.Id, entity.NameAr, entity.NameEn),
            department is null ? null : new NamedRef(department.Id, department.NameAr, department.NameEn),
            e.PositionId, title is null ? null : new NamedRef(title.Id, title.NameAr, title.NameEn), grade is null ? null : $"{grade.Code} · {grade.NameAr}", manager,
            e.ContractStartsOn, e.ContractMonths, e.ContractEndsOn, e.AnnualLeaveDays, e.LeaveBalance, e.LeaveConsumed, e.LeaveOldConsumed, e.LeaveRemaining,
            seeSalary && current is not null ? ToDto(current) : null, seeSalary ? Math.Max(0, salaries.Count - 1) : 0,
            score, missing, e.CreatedByName, e.CreatedAt,
            granted.Has(StaffPermissions.Manage), seeSalary, granted.Has(StaffPermissions.SalariesManage));
    }

    public async Task<IReadOnlyList<StaffEventDto>?> HistoryAsync(Guid id, CancellationToken cancellationToken)
    {
        if (!await db.Employees.AnyAsync(e => e.Id == id, cancellationToken).ConfigureAwait(false))
        {
            return null;
        }

        var key = id.ToString();
        var audit = await db.AuditLog.AsNoTracking().Where(a => a.TenantId == db.CurrentTenantId && a.EntityType == nameof(StaffEmployee) && a.EntityId == key)
            .OrderByDescending(a => a.OccurredAt).Take(200).ToListAsync(cancellationToken).ConfigureAwait(false);
        var events = audit.Select(a => new StaffEventDto(a.Action == "Added" ? "Created" : "Changed", a.OccurredAt, a.UserName,
            JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(a.Changes), null)).ToList();
        if ((await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(StaffPermissions.SalariesView))
        {
            var salaries = await db.Salaries.AsNoTracking().Where(s => s.EmployeeId == id).ToListAsync(cancellationToken).ConfigureAwait(false);
            events.AddRange(salaries.Select(s => new StaffEventDto("Salary", s.CreatedAt, s.CreatedByName, null, ToDto(s))));
        }

        return events.OrderByDescending(x => x.At).ToList();
    }

    public async Task<StructureDto> StructureAsync(CancellationToken cancellationToken)
    {
        var departments = await db.Departments.AsNoTracking().OrderBy(d => d.SortOrder).ThenBy(d => d.NameAr).ToListAsync(cancellationToken).ConfigureAwait(false);
        var positions = await db.Positions.AsNoTracking().ToListAsync(cancellationToken).ConfigureAwait(false);
        var lookups = await LookupsAsync(cancellationToken).ConfigureAwait(false);
        var people = await db.Employees.AsNoTracking().Where(e => e.Status != StaffStatus.Left)
            .Select(e => new { e.Id, e.NameAr, e.NameEn, e.DepartmentId, e.PositionId })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var names = await db.Employees.AsNoTracking().Select(e => new { e.Id, e.NameAr, e.NameEn }).ToDictionaryAsync(e => e.Id, cancellationToken).ConfigureAwait(false);
        NamedRef? Person(Guid? id) => id is { } x && names.TryGetValue(x, out var n) ? new NamedRef(x, n.NameAr ?? n.NameEn, n.NameEn) : null;
        var vacancies = 0;
        var list = departments.Select(d =>
        {
            var mine = positions.Where(p => p.DepartmentId == d.Id).Select(p =>
            {
                var occupants = people.Where(e => e.PositionId == p.Id).Select(e => new NamedRef(e.Id, e.NameAr ?? e.NameEn, e.NameEn)).ToList();
                if (p.IsActive)
                {
                    vacancies += Math.Max(0, p.Seats - occupants.Count);
                }

                var title = lookups.Titles.GetValueOrDefault(p.JobTitleId);
                var grade = p.GradeId is { } g ? lookups.Grades.GetValueOrDefault(g) : null;
                return new PositionDto(p.Id, p.DepartmentId, p.JobTitleId, title?.NameAr ?? "—", title?.NameEn ?? "—", p.GradeId, grade is null ? null : $"{grade.Code} · {grade.NameAr}", p.ReportsToId, p.Seats, p.IsActive, occupants);
            }).OrderBy(p => p.ReportsToId is null ? 0 : 1).ThenBy(p => p.JobTitleAr).ToList();
            return new DepartmentDto(d.Id, d.ParentId, d.NameAr, d.NameEn, d.CostCenter, Person(d.ManagerId), d.SortOrder, d.IsActive, people.Count(e => e.DepartmentId == d.Id), mine);
        }).ToList();
        return new StructureDto(list, people.Count, people.Count(e => e.DepartmentId == null || e.PositionId == null), vacancies);
    }

    public async Task<CatalogDto> CatalogAsync(CancellationToken cancellationToken)
    {
        var positions = await db.Positions.AsNoTracking().Select(p => new { p.JobTitleId, p.GradeId }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var titles = await db.JobTitles.AsNoTracking().OrderBy(j => j.NameAr).ToListAsync(cancellationToken).ConfigureAwait(false);
        var grades = await db.Grades.AsNoTracking().OrderBy(g => g.Code).ToListAsync(cancellationToken).ConfigureAwait(false);
        return new CatalogDto(
            titles.Select(j => new JobTitleDto(j.Id, j.NameAr, j.NameEn, j.OccupationCode, j.IsActive, positions.Count(p => p.JobTitleId == j.Id))).ToList(),
            grades.Select(g => new GradeDto(g.Id, g.Code, g.NameAr, g.MinBasic, g.MaxBasic, g.IsActive, positions.Count(p => p.GradeId == g.Id))).ToList());
    }

    /// <summary>Employees for a picker (a department's manager): number and name.</summary>
    public async Task<IReadOnlyList<NamedRef>> PeopleAsync(string? search, CancellationToken cancellationToken)
    {
        var employees = db.Employees.AsNoTracking().Where(e => e.Status != StaffStatus.Left);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            employees = employees.Where(e => e.EmployeeNo.Contains(term) || e.NameEn.Contains(term) || (e.NameAr != null && e.NameAr.Contains(term)));
        }

        return await employees.OrderBy(e => e.NameAr ?? e.NameEn).Take(30)
            .Select(e => new NamedRef(e.Id, (e.NameAr ?? e.NameEn) + " · " + e.EmployeeNo, e.NameEn))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// The direct manager: whoever holds the position this one reports to; else the department's manager (when it is
    /// someone else); else the manager of the department above.
    /// </summary>
    private async Task<NamedRef?> ManagerAsync(StaffEmployee e, Position? position, Lookups lookups, CancellationToken cancellationToken)
    {
        Guid? managerId = null;
        if (position?.ReportsToId is { } reports)
        {
            managerId = await db.Employees.AsNoTracking().Where(x => x.PositionId == reports && x.Status != StaffStatus.Left).Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        }

        for (var dept = e.DepartmentId is { } d ? lookups.Departments.GetValueOrDefault(d) : null; managerId is null && dept is not null;
             dept = dept.ParentId is { } parent ? lookups.Departments.GetValueOrDefault(parent) : null)
        {
            if (dept.ManagerId is { } m && m != e.Id)
            {
                managerId = m;
            }
        }

        if (managerId is not { } id)
        {
            return null;
        }

        var manager = await db.Employees.AsNoTracking().Where(x => x.Id == id).Select(x => new { x.NameAr, x.NameEn }).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        return manager is null ? null : new NamedRef(id, manager.NameAr ?? manager.NameEn, manager.NameEn);
    }

    /// <summary>How complete the file is (0–100) and what is missing (keys the screens translate).</summary>
    private static (int Score, IReadOnlyList<string> Missing) Completeness(StaffEmployee e, bool hasSalary)
    {
        var checks = new (string Key, bool Done)[]
        {
            ("department", e.DepartmentId is not null), ("position", e.PositionId is not null), ("legal_entity", e.LegalEntityId is not null),
            ("hire_date", e.HireDate is not null), ("id_number", e.IdNumber is not null), ("nationality", e.NationalityCode is not null),
            ("birth_date", e.BirthDate is not null), ("mobile", e.Mobile is not null), ("gosi_no", e.GosiNo is not null),
            ("contract", e.ContractEndsOn is not null || e.ContractMonths is not null), ("salary", hasSalary),
        };
        var missing = checks.Where(c => !c.Done).Select(c => c.Key).ToList();
        return ((int)Math.Round(100.0 * (checks.Length - missing.Count) / checks.Length), missing);
    }

    private async Task<HashSet<Guid>> SalariedAsync(List<Guid> ids, CancellationToken cancellationToken) =>
        (await db.Salaries.AsNoTracking().Where(s => ids.Contains(s.EmployeeId) && s.Total > 0).Select(s => s.EmployeeId).Distinct().ToListAsync(cancellationToken).ConfigureAwait(false)).ToHashSet();

    private sealed record Lookups(Dictionary<Guid, Department> Departments, Dictionary<Guid, Position> Positions, Dictionary<Guid, JobTitle> Titles, Dictionary<Guid, Grade> Grades);

    private async Task<Lookups> LookupsAsync(CancellationToken cancellationToken) => new(
        await db.Departments.AsNoTracking().ToDictionaryAsync(d => d.Id, cancellationToken).ConfigureAwait(false),
        await db.Positions.AsNoTracking().ToDictionaryAsync(p => p.Id, cancellationToken).ConfigureAwait(false),
        await db.JobTitles.AsNoTracking().ToDictionaryAsync(j => j.Id, cancellationToken).ConfigureAwait(false),
        await db.Grades.AsNoTracking().ToDictionaryAsync(g => g.Id, cancellationToken).ConfigureAwait(false));

    private static SalaryDto ToDto(StaffSalary s) =>
        new(s.Id, s.EffectiveFrom, s.Basic, s.Housing, s.Food, s.Transport, s.Mobile, s.Project, s.Other, s.Total, s.Source.ToString(), s.Reason, s.CreatedByName, s.CreatedAt);
}
