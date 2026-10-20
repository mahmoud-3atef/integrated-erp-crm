using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.Modules.Staff.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Staff.Application;

/// <summary>The staff and the departments for other modules (attendance first).</summary>
internal sealed class StaffDirectory(StaffDbContext db) : IStaffDirectory, IStaffPayroll
{
    public async Task<IReadOnlyList<StaffMember>> MembersAsync(CancellationToken cancellationToken)
    {
        var departments = await db.Departments.AsNoTracking().ToDictionaryAsync(d => d.Id, cancellationToken).ConfigureAwait(false);
        var titles = await (from p in db.Positions.AsNoTracking()
                            join t in db.JobTitles.AsNoTracking() on p.JobTitleId equals t.Id
                            select new { p.Id, t.NameAr, t.NameEn }).ToDictionaryAsync(x => x.Id, cancellationToken).ConfigureAwait(false);
        var employees = await db.Employees.AsNoTracking().OrderBy(e => e.EmployeeNo).ToListAsync(cancellationToken).ConfigureAwait(false);
        return employees.Select(e =>
        {
            var d = e.DepartmentId is { } did ? departments.GetValueOrDefault(did) : null;
            var t = e.PositionId is { } pid ? titles.GetValueOrDefault(pid) : null;
            return new StaffMember(e.Id, e.EmployeeNo, e.NameAr, e.NameEn, e.IdNumber, e.LegalEntityId, e.DepartmentId, d?.NameAr, d?.NameEn, t?.NameAr, t?.NameEn, e.Status.ToString(), e.HireDate, e.EndedOn, e.UserId);
        }).ToList();
    }

    public async Task<StaffManager?> ManagerAsync(Guid employeeId, CancellationToken cancellationToken)
    {
        var e = await db.Employees.AsNoTracking().FirstOrDefaultAsync(x => x.Id == employeeId, cancellationToken).ConfigureAwait(false);
        if (e is null)
        {
            return null;
        }

        Guid? managerId = null;
        var reports = e.PositionId is { } pid
            ? await db.Positions.AsNoTracking().Where(p => p.Id == pid).Select(p => p.ReportsToId).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false)
            : null;
        if (reports is { } r)
        {
            managerId = await db.Employees.AsNoTracking().Where(x => x.PositionId == r && x.Status != Domain.StaffStatus.Left && x.Id != e.Id).Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        }

        var departments = await db.Departments.AsNoTracking().ToDictionaryAsync(d => d.Id, cancellationToken).ConfigureAwait(false);
        var seen = new HashSet<Guid>();
        for (var dept = e.DepartmentId is { } d ? departments.GetValueOrDefault(d) : null; managerId is null && dept is not null && seen.Add(dept.Id);
             dept = dept.ParentId is { } parent ? departments.GetValueOrDefault(parent) : null)
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

        var manager = await db.Employees.AsNoTracking().Where(x => x.Id == id).Select(x => new { x.NameAr, x.NameEn, x.UserId }).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        return manager is null ? null : new StaffManager(id, manager.NameAr ?? manager.NameEn, manager.UserId);
    }

    public async Task<StaffPay?> SalaryAsync(Guid employeeId, DateOnly on, CancellationToken cancellationToken) =>
        await db.Salaries.AsNoTracking().Where(s => s.EmployeeId == employeeId && s.EffectiveFrom <= on).OrderByDescending(s => s.EffectiveFrom)
            .Select(s => new StaffPay(s.Basic, s.Total)).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);

    public async Task<IReadOnlyList<StaffDepartment>> DepartmentsAsync(CancellationToken cancellationToken) =>
        await db.Departments.AsNoTracking().Where(d => d.IsActive).OrderBy(d => d.SortOrder).ThenBy(d => d.NameAr)
            .Select(d => new StaffDepartment(d.Id, d.NameAr, d.NameEn, d.ParentId)).ToListAsync(cancellationToken).ConfigureAwait(false);

    public async Task<IReadOnlyList<StaffPayInfo>> PayInfoAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var departments = await db.Departments.AsNoTracking().ToDictionaryAsync(d => d.Id, cancellationToken).ConfigureAwait(false);
        var titles = await (from p in db.Positions.AsNoTracking()
                            join t in db.JobTitles.AsNoTracking() on p.JobTitleId equals t.Id
                            select new { p.Id, t.NameAr, t.NameEn }).ToDictionaryAsync(x => x.Id, cancellationToken).ConfigureAwait(false);
        var employees = await db.Employees.AsNoTracking()
            .Where(e => (e.HireDate == null || e.HireDate <= to) && (e.Status != Domain.StaffStatus.Left || (e.EndedOn != null && e.EndedOn >= from)))
            .OrderBy(e => e.EmployeeNo).ToListAsync(cancellationToken).ConfigureAwait(false);
        var ids = employees.Select(e => e.Id).ToList();
        var salaries = (await db.Salaries.AsNoTracking().Where(s => ids.Contains(s.EmployeeId)).ToListAsync(cancellationToken).ConfigureAwait(false))
            .GroupBy(s => s.EmployeeId).ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.EffectiveFrom).ThenByDescending(s => s.CreatedAt).ToList());
        return employees.Select(e =>
        {
            var d = e.DepartmentId is { } did ? departments.GetValueOrDefault(did) : null;
            var t = e.PositionId is { } pid ? titles.GetValueOrDefault(pid) : null;
            var mine = salaries.GetValueOrDefault(e.Id) ?? [];
            var current = mine.FirstOrDefault(s => s.EffectiveFrom <= to);
            var acting = e.ActingUntil is { } until && until >= from ? e.ActingAllowance ?? 0 : 0;
            return new StaffPayInfo(
                e.Id, e.EmployeeNo, e.NameAr ?? e.NameEn, e.LegalEntityId, e.DepartmentId, d?.NameAr, d?.NameEn, t?.NameAr, t?.NameEn, e.Status.ToString(),
                e.HireDate, e.EndedOn, e.NationalityCode, e.GosiSince, e.BankName, e.Iban,
                current is null ? null : new StaffSalaryInfo(current.Basic, current.Housing, current.Food, current.Transport, current.Mobile, current.Project, current.Other, current.Total),
                mine.Any(s => s.EffectiveFrom > from && s.EffectiveFrom <= to), acting, e.GosiNo);
        }).ToList();
    }

    public async Task<bool> SetGosiAsync(Guid employeeId, string gosiNo, DateOnly? since, CancellationToken cancellationToken)
    {
        var e = await db.Employees.FirstOrDefaultAsync(x => x.Id == employeeId, cancellationToken).ConfigureAwait(false);
        if (e is null || string.IsNullOrWhiteSpace(gosiNo) || gosiNo.Trim().Length > 30)
        {
            return false;
        }

        var set = e.SetPersonal(e.NameAr, e.NameEn, e.IdNumber, e.NationalityCode, e.NationalityAr, e.NationalityEn, e.BirthDate, e.Mobile, e.Email, gosiNo.Trim());
        if (set.IsFailure)
        {
            return false;
        }

        e.SetGosiSince(since ?? e.GosiSince);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return true;
    }

    public Task<int> WithoutRegistrationAsync(CancellationToken cancellationToken) =>
        db.Employees.CountAsync(e => e.LegalEntityId == null && e.Status != Domain.StaffStatus.Left, cancellationToken);
}
