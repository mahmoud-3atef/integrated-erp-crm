using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workforce.Application;

internal sealed class WorkforceDirectory(WorkforceDbContext db, IReferenceData reference) : IWorkforceDirectory, IWorkerSalaries, IStaffRecords
{
    public async Task<IReadOnlyList<StaffRecord>> StaffAsync(CancellationToken cancellationToken)
    {
        var rows = await db.Workers.AsNoTracking().Where(w => w.Kind == WorkerKind.Staff && !w.RemovedInCrm)
            .Join(db.People, w => w.PersonId, p => p.Id, (w, p) => new { Worker = w, Person = p })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var personIds = rows.Select(r => r.Person.Id).ToList();
        var ids = (await db.Identifiers.AsNoTracking()
                .Where(i => personIds.Contains(i.PersonId) && i.Type == IdentifierType.Iqama && i.IsCurrent)
                .ToListAsync(cancellationToken).ConfigureAwait(false))
            .GroupBy(i => i.PersonId).ToDictionary(g => g.Key, g => g.First().Number);
        var nationalities = (await reference.ListAllAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false))
            .ToDictionary(i => i.Code, StringComparer.Ordinal);
        return rows.Select(r =>
            {
                var w = r.Worker;
                var s = w.Salary;
                var nationality = r.Person.NationalityCode is { } nc ? nationalities.GetValueOrDefault(nc) : null;
                var status = CrmWorkerStatus.Name(w.CrmStatus);
                return new StaffRecord(
                    w.Id, r.Person.Id, w.WorkerNo, r.Person.NameEn, r.Person.NameAr, ids.GetValueOrDefault(r.Person.Id), r.Person.NationalityCode,
                    nationality?.NameAr, nationality?.NameEn, w.ProfessionCode, status?.Ar, status?.En, w.Lifecycle == Lifecycle.Active, w.Sponsor,
                    w.ArrivedOn ?? w.ProjectJoinedOn,
                    new WorkerSalary(w.Id, w.Sponsor, s.Basic, s.Housing, s.Food, s.Transport, s.Overtime + s.Other, s.Total),
                    s.Project, s.Hardship, // the old system's mobile allowance is kept as Project, its project allowance as Hardship
                    w.Contract.StartsOn, w.Contract.Months, w.Contract.EndsOn,
                    w.Leave.AnnualDays, w.Leave.Balance, w.Leave.Consumed, w.Leave.OldConsumed, w.Leave.Remaining);
            })
            .OrderBy(x => x.EmployeeNo, StringComparer.Ordinal)
            .ToList();
    }

    public async Task<IReadOnlyList<WorkerSalary>> SalariesAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ids);
        var list = ids.Distinct().ToList();
        var rows = await db.Workers.AsNoTracking().Where(w => list.Contains(w.Id))
            .Select(w => new { w.Id, w.Sponsor, w.Salary })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return rows.Select(r => new WorkerSalary(
                r.Id, r.Sponsor, r.Salary.Basic, r.Salary.Housing, r.Salary.Food, r.Salary.Transport,
                r.Salary.Overtime + r.Salary.Other + r.Salary.Project + r.Salary.Hardship, r.Salary.Total))
            .ToList();
    }

    public async Task<IReadOnlyDictionary<Guid, int>> WorkingByProjectAsync(CancellationToken cancellationToken) =>
        await db.Workers.AsNoTracking()
            .Where(w => w.Kind == WorkerKind.Worker && !w.RemovedInCrm && w.Placement == Placement.Working && w.ProjectCrmId != null)
            .GroupBy(w => w.ProjectCrmId!.Value)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken).ConfigureAwait(false);

    public async Task<IReadOnlyList<WorkerInfo>> OnProjectAsync(Guid crmProjectId, CancellationToken cancellationToken)
    {
        var rows = await db.Workers.AsNoTracking()
            .Where(w => w.Kind == WorkerKind.Worker && !w.RemovedInCrm && w.ProjectCrmId == crmProjectId)
            .Join(db.People, w => w.PersonId, p => p.Id, (w, p) => new { Worker = w, Person = p })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var professions = (await reference.ListAllAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false))
            .ToDictionary(i => i.Code, StringComparer.Ordinal);
        var nationalities = (await reference.ListAllAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false))
            .ToDictionary(i => i.Code, StringComparer.Ordinal);
        return rows
            .OrderByDescending(r => r.Worker.Placement == Placement.Working)
            .ThenBy(r => r.Person.NameEn, StringComparer.OrdinalIgnoreCase)
            .Select(r =>
            {
                var status = CrmWorkerStatus.Name(r.Worker.CrmStatus);
                var profession = r.Worker.ProfessionCode is { } pc ? professions.GetValueOrDefault(pc) : null;
                var nationality = r.Person.NationalityCode is { } nc ? nationalities.GetValueOrDefault(nc) : null;
                return new WorkerInfo(
                    r.Worker.Id, r.Worker.WorkerNo, r.Person.NameEn, r.Worker.Placement.ToString(), status?.Ar, status?.En,
                    profession?.NameAr, profession?.NameEn, nationality?.NameAr, nationality?.NameEn, r.Worker.ProjectJoinedOn);
            })
            .ToList();
    }

    public async Task<IReadOnlyList<WorkingWorker>> WorkingAsync(CancellationToken cancellationToken) =>
        await db.Workers.AsNoTracking()
            .Where(w => w.Kind == WorkerKind.Worker && !w.RemovedInCrm && w.Placement == Placement.Working && w.ProjectCrmId != null)
            .Join(db.People, w => w.PersonId, p => p.Id, (w, p) => new WorkingWorker(
                w.Id, w.CrmId, w.WorkerNo, p.NameEn, w.ProjectCrmId!.Value, w.ProfessionCode, p.NationalityCode, w.Salary.Total, w.ProjectJoinedOn))
            .ToListAsync(cancellationToken).ConfigureAwait(false);

    public async Task<IReadOnlyList<WorkerCard>> SearchAsync(string search, int take, CancellationToken cancellationToken)
    {
        var tokens = (search ?? string.Empty).Split([' ', ',', '\u060C', '\n', '\r', '\t'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(t => t.ToUpperInvariant()).Distinct().ToList();
        if (tokens.Count == 0)
        {
            return [];
        }

        var query = db.Workers.AsNoTracking().Where(w => w.Kind == WorkerKind.Worker && !w.RemovedInCrm);
        if (tokens.Count == 1)
        {
            var text = search!.Trim();
            var upper = tokens[0];
            query = query.Where(w => w.WorkerNo.Contains(upper)
                || db.People.Any(p => p.Id == w.PersonId && p.NameEn.Contains(text))
                || db.Identifiers.Any(i => i.PersonId == w.PersonId && i.Number.Contains(upper)));
        }
        else
        {
            query = query.Where(w => tokens.Contains(w.WorkerNo) || db.Identifiers.Any(i => i.PersonId == w.PersonId && tokens.Contains(i.Number)));
        }

        var ids = await query
            .OrderByDescending(w => (w.Placement == Placement.Housing || w.Placement == Placement.New) && w.Lifecycle == Lifecycle.Active)
            .ThenBy(w => w.WorkerNo)
            .Select(w => w.Id)
            .Take(Math.Clamp(take, 1, 200))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return await CardsAsync(ids, cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<WorkerCard>> AvailableAsync(CancellationToken cancellationToken)
    {
        var open = db.Periods.Where(p => p.EndsOn == null);
        return (await CardsWhereAsync(
                db.Workers.AsNoTracking().Where(w => w.Kind == WorkerKind.Worker && !w.RemovedInCrm && w.Lifecycle == Lifecycle.Active
                    && ((w.Placement == Placement.Housing || w.Placement == Placement.New) || open.Any(p => p.WorkerId == w.Id && p.Kind == PeriodKind.Housing))),
                cancellationToken).ConfigureAwait(false))
            .Where(c => c.Available).ToList();
    }

    public async Task<IReadOnlyList<WorkerCard>> OnJobAsync(CancellationToken cancellationToken)
    {
        var open = db.Periods.Where(p => p.EndsOn == null);
        return (await CardsWhereAsync(
                db.Workers.AsNoTracking().Where(w => w.Kind == WorkerKind.Worker && !w.RemovedInCrm && w.Lifecycle == Lifecycle.Active
                    && (w.Placement == Placement.Working || open.Any(p => p.WorkerId == w.Id && p.Kind == PeriodKind.Work))),
                cancellationToken).ConfigureAwait(false))
            .Where(c => c.OnJob).OrderBy(c => c.ProjectName, StringComparer.OrdinalIgnoreCase).ThenBy(c => c.WorkerNo, StringComparer.Ordinal).ToList();
    }

    public async Task<IReadOnlyList<WorkerCard>> CardsAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ids);
        var list = ids.ToList();
        return await CardsWhereAsync(db.Workers.AsNoTracking().Where(w => list.Contains(w.Id)), cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<WorkerCard>> CardsByCrmAsync(IReadOnlyCollection<string> workerNos, IReadOnlyCollection<Guid> crmIds, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(workerNos);
        ArgumentNullException.ThrowIfNull(crmIds);
        var numbers = workerNos.Select(n => n.Trim().ToUpperInvariant()).Distinct().ToList();
        var crm = crmIds.Distinct().ToList();
        return await CardsWhereAsync(db.Workers.AsNoTracking().Where(w => numbers.Contains(w.WorkerNo) || crm.Contains(w.CrmId)), cancellationToken).ConfigureAwait(false);
    }

    private async Task<List<WorkerCard>> CardsWhereAsync(IQueryable<Worker> workers, CancellationToken cancellationToken)
    {
        var rows = await workers
            .Join(db.People, w => w.PersonId, p => p.Id, (w, p) => new { Worker = w, Person = p })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var personIds = rows.Select(r => r.Person.Id).ToList();
        var iqamas = (await db.Identifiers.AsNoTracking()
                .Where(i => personIds.Contains(i.PersonId) && i.Type == IdentifierType.Iqama && i.IsCurrent)
                .ToListAsync(cancellationToken).ConfigureAwait(false))
            .GroupBy(i => i.PersonId).ToDictionary(g => g.Key, g => g.First());
        var professions = (await reference.ListAllAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false))
            .ToDictionary(i => i.Code, StringComparer.Ordinal);
        var nationalities = (await reference.ListAllAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false))
            .ToDictionary(i => i.Code, StringComparer.Ordinal);
        // A period opened here (a delivered delivery order, a return to housing) says where the worker is, whatever the
        // old system still says; without one, the old system's status counts.
        var workerIds = rows.Select(r => r.Worker.Id).ToList();
        var open = await db.Periods.AsNoTracking().Where(p => workerIds.Contains(p.WorkerId) && p.EndsOn == null)
            .ToDictionaryAsync(p => p.WorkerId, cancellationToken).ConfigureAwait(false);
        return rows.Select(r =>
            {
                var w = r.Worker;
                var profession = w.ProfessionCode is { } pc ? professions.GetValueOrDefault(pc) : null;
                var nationality = r.Person.NationalityCode is { } nc ? nationalities.GetValueOrDefault(nc) : null;
                var iqama = iqamas.GetValueOrDefault(r.Person.Id);
                var active = w.Kind == WorkerKind.Worker && !w.RemovedInCrm && w.Lifecycle == Lifecycle.Active;
                if (open.TryGetValue(w.Id, out var period))
                {
                    var work = period.Kind == PeriodKind.Work;
                    var (placement, ar, en) = Here(period.Kind);
                    var stillActive = active && period.Kind != PeriodKind.Out;
                    var onProject = period.Kind is PeriodKind.Work or PeriodKind.ClientVacation;
                    return new WorkerCard(
                        w.Id, w.CrmId, w.WorkerNo, r.Person.NameEn, placement.ToString(), stillActive && period.Kind == PeriodKind.Housing, ar, en,
                        w.ProfessionCode, profession?.NameAr, profession?.NameEn, r.Person.NationalityCode, nationality?.NameAr, nationality?.NameEn,
                        iqama?.Number, iqama?.ExpiresOn, w.Salary.Total,
                        onProject ? period.ProjectCrmId : null, onProject ? period.ProjectName : null, work ? period.StartsOn : null, stillActive && work,
                        w.Sponsor, w.Salary.Basic);
                }

                var status = CrmWorkerStatus.Name(w.CrmStatus);
                var available = active && (w.Placement == Placement.Housing || w.Placement == Placement.New);
                return new WorkerCard(
                    w.Id, w.CrmId, w.WorkerNo, r.Person.NameEn, w.Placement.ToString(), available, status?.Ar, status?.En,
                    w.ProfessionCode, profession?.NameAr, profession?.NameEn, r.Person.NationalityCode, nationality?.NameAr, nationality?.NameEn,
                    iqama?.Number, iqama?.ExpiresOn, w.Salary.Total, w.ProjectCrmId, w.ProjectName, w.ProjectJoinedOn, active && w.Placement == Placement.Working,
                    w.Sponsor, w.Salary.Basic);
            })
            .OrderByDescending(c => c.Available).ThenBy(c => c.WorkerNo, StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>Where a period opened here puts the worker, and how the screens say it.</summary>
    private static (Placement Placement, string Ar, string En) Here(PeriodKind kind) => kind switch
    {
        PeriodKind.Work => (Placement.Working, "على رأس العمل (من هذا النظام)", "On the job (this system)"),
        PeriodKind.Vacation => (Placement.Vacation, "في إجازة (من هذا النظام)", "On vacation (this system)"),
        PeriodKind.ClientVacation => (Placement.Vacation, "في إجازة على العميل (من هذا النظام)", "On vacation on the customer (this system)"),
        PeriodKind.Absconded => (Placement.Absconded, "منقطع (من هذا النظام)", "Absconded (this system)"),
        PeriodKind.Suspended => (Placement.Suspended, "موقوف (من هذا النظام)", "Suspended (this system)"),
        PeriodKind.Out => (Placement.Exited, "خارج الخدمة (من هذا النظام)", "Exited (this system)"),
        _ => (Placement.Housing, "في السكن (من هذا النظام)", "In housing (this system)"),
    };
}
