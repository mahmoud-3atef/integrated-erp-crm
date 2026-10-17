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
    Salary? Salary,
    bool FromLedger = false,
    string? CrmStatusAr = null,
    string? CrmStatusEn = null);

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

/// <summary>A list of one kind: workers and company staff are separate lists with separate permissions.</summary>
public sealed record WorkerFilter(WorkerKind Kind, string? Search, string? Placement, string? Sort, bool Descending, int Page, int PageSize);

/// <summary>The workers list (with counts by status, as the old page's cards) and one worker's file.</summary>
internal sealed class WorkerQueries(WorkforceDbContext db, IReferenceData reference, IClock clock)
{
    public async Task<WorkerListDto> ListAsync(WorkerFilter filter, bool withSalary, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(filter);
        var names = await NamesAsync(cancellationToken).ConfigureAwait(false);
        var query = db.Workers.AsNoTracking().Where(w => !w.RemovedInCrm && w.Kind == filter.Kind);

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

        // Counts by status ignore the status filter (the cards show every status of the current search). A worker with a
        // work period opened here (a delivered delivery order) is on the job, whatever the old system still says.
        var openWork = db.Periods.Where(p => p.EndsOn == null && p.Kind == PeriodKind.Work);
        var counts = await query
            .Select(w => openWork.Any(p => p.WorkerId == w.Id) ? Placement.Working : w.Placement)
            .GroupBy(x => x).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key.ToString(), x => x.Count, cancellationToken).ConfigureAwait(false);
        if (Enum.TryParse<Placement>(filter.Placement, out var placement))
        {
            query = query.Where(w => (openWork.Any(p => p.WorkerId == w.Id) ? Placement.Working : w.Placement) == placement);
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

        var workerIds = page.Select(x => x.Worker.Id).ToList();
        var periods = await openWork.AsNoTracking().Where(p => workerIds.Contains(p.WorkerId)).ToDictionaryAsync(p => p.WorkerId, cancellationToken).ConfigureAwait(false);
        var items = page.Select(x => Row(x.Worker, x.Person, iqamas.GetValueOrDefault(x.Person.Id), names, withSalary, periods.GetValueOrDefault(x.Worker.Id))).ToList();
        return new WorkerListDto(total, counts, items);
    }

    /// <summary>One file of the given kind (a worker id does not open as staff, and the other way round).</summary>
    public async Task<WorkerDetailDto?> GetAsync(Guid id, WorkerKind kind, bool withSalary, CancellationToken cancellationToken)
    {
        var worker = await db.Workers.AsNoTracking().FirstOrDefaultAsync(w => w.Id == id && w.Kind == kind, cancellationToken).ConfigureAwait(false);
        if (worker is null)
        {
            return null;
        }

        var person = await db.People.AsNoTracking().Include(p => p.Identifiers).FirstAsync(p => p.Id == worker.PersonId, cancellationToken).ConfigureAwait(false);
        var names = await NamesAsync(cancellationToken).ConfigureAwait(false);
        var iqama = person.Identifiers.FirstOrDefault(i => i.Type == IdentifierType.Iqama && i.IsCurrent)?.Number;
        var iqamaProfession = worker.IqamaProfessionCode is { } code ? names.Professions.GetValueOrDefault(code) : default;
        var period = await db.Periods.AsNoTracking().FirstOrDefaultAsync(p => p.WorkerId == id && p.EndsOn == null && p.Kind == PeriodKind.Work, cancellationToken).ConfigureAwait(false);
        return new WorkerDetailDto(
            Row(worker, person, iqama, names, withSalary, period),
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

    /// <summary>
    /// A worker's row. With an open work period from this system (<paramref name="period"/>) the worker is on the job on
    /// its project from its start; the old system's status is kept beside it until the switchover.
    /// </summary>
    private WorkerRowDto Row(Worker w, Person p, string? iqama, Names names, bool withSalary, WorkerPeriod? period = null)
    {
        var profession = w.ProfessionCode is { } pc ? names.Professions.GetValueOrDefault(pc) : default;
        var nationality = p.NationalityCode is { } nc ? names.Nationalities.GetValueOrDefault(nc) : default;
        var status = CrmWorkerStatus.Name(w.CrmStatus);
        var today = DateOnly.FromDateTime(clock.UtcNow.ToOffset(TimeSpan.FromHours(3)).DateTime);
        if (period is not null)
        {
            int? days = period.StartsOn <= today ? today.DayNumber - period.StartsOn.DayNumber + 1 : null;
            return new WorkerRowDto(
                w.Id, w.WorkerNo, p.NameEn, w.Kind.ToString(), nameof(Placement.Working), w.CrmStatus, "على رأس العمل", "On the job", iqama,
                profession.Ar, profession.En, nationality.Ar, nationality.En, w.Sponsor, period.ProjectName, period.StartsOn, days,
                withSalary ? w.Salary : null, FromLedger: true, CrmStatusAr: status?.Ar, CrmStatusEn: status?.En);
        }

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
