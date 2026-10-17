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
}
