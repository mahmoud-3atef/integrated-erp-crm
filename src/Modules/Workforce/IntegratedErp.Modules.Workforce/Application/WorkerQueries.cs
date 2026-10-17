using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workforce.Application;

public sealed record WorkerRowDto(
    Guid Id,
    string WorkerNo,
    string Name,
    string Kind,
    string Placement,
    int? CrmStatus,
    string? StatusAr,
    string? StatusEn,
    string? Iqama,
    string? ProfessionAr,
    string? ProfessionEn,
    string? NationalityAr,
    string? NationalityEn,
    string? Sponsor,
    string? ProjectName,
    DateOnly? ProjectJoinedOn,
    int? WorkDays,
    Salary? Salary);

public sealed record WorkerListDto(int Total, IReadOnlyDictionary<string, int> Counts, IReadOnlyList<WorkerRowDto> Items);

public sealed record IdentifierDto(string Type, string Number, DateOnly? ExpiresOn, bool IsCurrent);

public sealed record WorkerDetailDto(
    WorkerRowDto Summary,
    string? IqamaProfessionAr,
    string? IqamaProfessionEn,
    string? RecruitmentAgent,
    DateOnly? ArrivedOn,
    int? MaritalStatus,
    ContractTerms Contract,
    LeaveBalance Leave,
    DateTimeOffset? CrmCreatedAt,
    bool RemovedInCrm,
    IReadOnlyList<IdentifierDto> Identifiers);

public sealed record WorkerFilter(string? Search, string? Placement, string? Kind, string? Sort, bool Descending, int Page, int PageSize);

/// <summary>The workers list (with counts by status, as the old page's cards) and one worker's file.</summary>
internal sealed class WorkerQueries(WorkforceDbContext db, IReferenceData reference, IClock clock)
{
    public async Task<WorkerListDto> ListAsync(WorkerFilter filter, bool withSalary, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(filter);
        var names = await NamesAsync(cancellationToken).ConfigureAwait(false);
        var query = db.Workers.AsNoTracking().Where(w => !w.RemovedInCrm);
        if (Enum.TryParse<WorkerKind>(filter.Kind, out var kind))
        {
            query = query.Where(w => w.Kind == kind);
        }

        if (filter.Search?.Trim() is { Length: > 0 } search)
        {
            var upper = search.ToUpperInvariant();
            var professionCodes = names.Professions.Where(p => p.Value.Ar.Contains(search, StringComparison.OrdinalIgnoreCase) || p.Value.En.Contains(search, StringComparison.OrdinalIgnoreCase))
                .Select(p => p.Key).ToList();
            query = query.Where(w =>
                w.WorkerNo.Contains(upper)
                || db.People.Any(p => p.Id == w.PersonId && p.NameEn.Contains(search))
                || db.Identifiers.Any(i => i.PersonId == w.PersonId && i.Number.Contains(upper))
                || (w.ProjectName != null && w.ProjectName.Contains(search))
                || (w.ProfessionCode != null && professionCodes.Contains(w.ProfessionCode)));
        }

        // Counts by status ignore the status filter (the cards show every status of the current search).
        var counts = await query.GroupBy(w => w.Placement).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key.ToString(), x => x.Count, cancellationToken).ConfigureAwait(false);
        if (Enum.TryParse<Placement>(filter.Placement, out var placement))
        {
            query = query.Where(w => w.Placement == placement);
        }

        var total = await query.CountAsync(cancellationToken).ConfigureAwait(false);
        var joined = query.Join(db.People, w => w.PersonId, p => p.Id, (w, p) => new { Worker = w, Person = p });
        joined = (filter.Sort, filter.Descending) switch
        {
            ("name", false) => joined.OrderBy(x => x.Person.NameEn),
            ("name", true) => joined.OrderByDescending(x => x.Person.NameEn),
            ("joined", false) => joined.OrderBy(x => x.Worker.ProjectJoinedOn),
            ("joined", true) => joined.OrderByDescending(x => x.Worker.ProjectJoinedOn),
            ("salary", false) => joined.OrderBy(x => x.Worker.Salary.Total),
            ("salary", true) => joined.OrderByDescending(x => x.Worker.Salary.Total),
            (_, true) => joined.OrderByDescending(x => x.Worker.WorkerNo),
            _ => joined.OrderBy(x => x.Worker.WorkerNo),
        };
        var pageSize = Math.Clamp(filter.PageSize, 10, 200);
        var page = await joined.Skip(Math.Max(0, filter.Page - 1) * pageSize).Take(pageSize)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var personIds = page.Select(x => x.Person.Id).ToList();
        var iqamas = await db.Identifiers.AsNoTracking()
            .Where(i => personIds.Contains(i.PersonId) && i.Type == IdentifierType.Iqama && i.IsCurrent)
            .ToDictionaryAsync(i => i.PersonId, i => i.Number, cancellationToken).ConfigureAwait(false);

        var items = page.Select(x => Row(x.Worker, x.Person, iqamas.GetValueOrDefault(x.Person.Id), names, withSalary)).ToList();
        return new WorkerListDto(total, counts, items);
    }

    public async Task<WorkerDetailDto?> GetAsync(Guid id, bool withSalary, CancellationToken cancellationToken)
    {
        var worker = await db.Workers.AsNoTracking().FirstOrDefaultAsync(w => w.Id == id, cancellationToken).ConfigureAwait(false);
        if (worker is null)
        {
            return null;
        }

        var person = await db.People.AsNoTracking().Include(p => p.Identifiers).FirstAsync(p => p.Id == worker.PersonId, cancellationToken).ConfigureAwait(false);
        var names = await NamesAsync(cancellationToken).ConfigureAwait(false);
        var iqama = person.Identifiers.FirstOrDefault(i => i.Type == IdentifierType.Iqama && i.IsCurrent)?.Number;
        var iqamaProfession = worker.IqamaProfessionCode is { } code ? names.Professions.GetValueOrDefault(code) : default;
        return new WorkerDetailDto(
            Row(worker, person, iqama, names, withSalary),
            iqamaProfession.Ar,
            iqamaProfession.En,
            worker.RecruitmentAgent,
            worker.ArrivedOn,
            person.MaritalStatus,
            worker.Contract,
            worker.Leave,
            worker.CrmCreatedAt,
            worker.RemovedInCrm,
            person.Identifiers.OrderBy(i => i.Type).ThenByDescending(i => i.IsCurrent)
                .Select(i => new IdentifierDto(i.Type.ToString(), i.Number, i.ExpiresOn, i.IsCurrent)).ToList());
    }

    private WorkerRowDto Row(Worker w, Person p, string? iqama, Names names, bool withSalary)
    {
        var profession = w.ProfessionCode is { } pc ? names.Professions.GetValueOrDefault(pc) : default;
        var nationality = p.NationalityCode is { } nc ? names.Nationalities.GetValueOrDefault(nc) : default;
        var status = CrmWorkerStatus.Name(w.CrmStatus);
        var today = DateOnly.FromDateTime(clock.UtcNow.ToOffset(TimeSpan.FromHours(3)).DateTime);
        int? workDays = w.Placement == Placement.Working && w.ProjectJoinedOn is { } joined && joined <= today
            ? today.DayNumber - joined.DayNumber + 1
            : null;
        return new WorkerRowDto(
            w.Id, w.WorkerNo, p.NameEn, w.Kind.ToString(), w.Placement.ToString(), w.CrmStatus, status?.Ar, status?.En, iqama,
            profession.Ar, profession.En, nationality.Ar, nationality.En, w.Sponsor, w.ProjectName, w.ProjectJoinedOn, workDays,
            withSalary ? w.Salary : null);
    }

    private sealed record Names(
        IReadOnlyDictionary<string, (string Ar, string En)> Nationalities,
        IReadOnlyDictionary<string, (string Ar, string En)> Professions);

    private async Task<Names> NamesAsync(CancellationToken cancellationToken)
    {
        // Including switched-off items: a worker may still point to one (e.g. merged after the import).
        var nationalities = await reference.ListAllAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false);
        var professions = await reference.ListAllAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false);
        return new Names(
            nationalities.ToDictionary(i => i.Code, i => (i.NameAr, i.NameEn), StringComparer.Ordinal),
            professions.ToDictionary(i => i.Code, i => (i.NameAr, i.NameEn), StringComparer.Ordinal));
    }
}
