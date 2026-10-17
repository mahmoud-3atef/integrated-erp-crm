using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workforce.Application;

internal sealed class WorkforceDirectory(WorkforceDbContext db, IReferenceData reference) : IWorkforceDirectory
{
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
        return rows.Select(r =>
            {
                var w = r.Worker;
                var status = CrmWorkerStatus.Name(w.CrmStatus);
                var profession = w.ProfessionCode is { } pc ? professions.GetValueOrDefault(pc) : null;
                var nationality = r.Person.NationalityCode is { } nc ? nationalities.GetValueOrDefault(nc) : null;
                var iqama = iqamas.GetValueOrDefault(r.Person.Id);
                var available = w.Kind == WorkerKind.Worker && !w.RemovedInCrm && w.Lifecycle == Lifecycle.Active
                    && (w.Placement == Placement.Housing || w.Placement == Placement.New);
                return new WorkerCard(
                    w.Id, w.CrmId, w.WorkerNo, r.Person.NameEn, w.Placement.ToString(), available, status?.Ar, status?.En,
                    w.ProfessionCode, profession?.NameAr, profession?.NameEn, r.Person.NationalityCode, nationality?.NameAr, nationality?.NameEn,
                    iqama?.Number, iqama?.ExpiresOn, w.Salary.Total, w.ProjectCrmId, w.ProjectName);
            })
            .OrderByDescending(c => c.Available).ThenBy(c => c.WorkerNo, StringComparer.Ordinal)
            .ToList();
    }
}
