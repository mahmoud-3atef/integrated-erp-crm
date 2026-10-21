using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.Workforce.Application;

/// <summary>A named count (a project, a nationality, a profession) for the dashboard's charts.</summary>
public sealed record NamedCountDto(string? Code, string NameAr, string NameEn, int Count);

/// <summary>One month of movements: work starts (delivery or transfer) and returns to housing.</summary>
public sealed record MonthMovesDto(DateOnly Month, int WorkStarts, int Returns);

/// <summary>The workforce part of the dashboard.</summary>
public sealed record WorkforceDashboardDto(
    int Active,
    IReadOnlyDictionary<string, int> Placements,
    IReadOnlyList<NamedCountDto> Projects,
    int ProjectsWithWorkers,
    IReadOnlyList<NamedCountDto> Nationalities,
    IReadOnlyList<NamedCountDto> Professions,
    IReadOnlyList<MonthMovesDto> Moves,
    int IqamaWithExpiry,
    int IqamaExpiring30,
    int IqamaExpired,
    int HistoryIssues,
    DateOnly? CheckMonth,
    decimal? CheckRate);

/// <summary>
/// The workforce's numbers for the dashboard: where the workers are (the period ledger first, then the old system), on
/// which projects, their nationalities and professions, the movements of the last twelve months, the iqamas to renew,
/// and the data checks (history exceptions, the invoice match).
/// </summary>
internal sealed class WorkforceDashboard(WorkforceDbContext db, IReferenceData reference, IOptions<WorkforceOptions> options, IClock clock) : IWorkforceReport
{
    private static readonly Placement[] Gone = [Placement.Exited, Placement.Absconded];

    public async Task<WorkforceDashboardDto> GetAsync(CancellationToken cancellationToken)
    {
        var workers = await db.Workers.AsNoTracking().Where(w => w.Kind == WorkerKind.Worker && !w.RemovedInCrm)
            .Join(db.People, w => w.PersonId, p => p.Id, (w, p) => new { w.Id, w.PersonId, w.Placement, w.ProjectCrmId, w.ProjectName, w.ProfessionCode, p.NationalityCode })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var open = await db.Periods.AsNoTracking().Where(p => p.EndsOn == null)
            .Select(p => new { p.WorkerId, p.Kind, p.ProjectCrmId, p.ProjectName })
            .ToDictionaryAsync(p => p.WorkerId, cancellationToken).ConfigureAwait(false);

        // Where each worker is now: an open period recorded here wins over the old system's status.
        var now = workers.Select(w =>
            {
                var period = open.GetValueOrDefault(w.Id);
                return period?.Kind switch
                {
                    PeriodKind.Work => new { w.Id, w.PersonId, Placement = Placement.Working, ProjectCrmId = period.ProjectCrmId, ProjectName = period.ProjectName, w.ProfessionCode, w.NationalityCode },
                    PeriodKind.Housing => new { w.Id, w.PersonId, Placement = Placement.Housing, ProjectCrmId = (Guid?)null, ProjectName = (string?)null, w.ProfessionCode, w.NationalityCode },
                    _ => new { w.Id, w.PersonId, w.Placement, w.ProjectCrmId, w.ProjectName, w.ProfessionCode, w.NationalityCode },
                };
            })
            .ToList();
        now = now.Where(w => w.Placement != Placement.Inactive).ToList();
        var active = now.Where(w => !Gone.Contains(w.Placement)).ToList();
        var placements = now.GroupBy(w => w.Placement.ToString()).ToDictionary(g => g.Key, g => g.Count());

        var working = active.Where(w => w.Placement == Placement.Working && w.ProjectCrmId != null).ToList();
        var projects = working.GroupBy(w => w.ProjectCrmId!.Value)
            .Select(g => new NamedCountDto(g.Key.ToString(), g.First().ProjectName ?? "—", g.First().ProjectName ?? "—", g.Count()))
            .OrderByDescending(p => p.Count).ToList();

        var nationalityNames = (await reference.ListAllAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false)).ToDictionary(i => i.Code, StringComparer.Ordinal);
        var professionNames = (await reference.ListAllAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false)).ToDictionary(i => i.Code, StringComparer.Ordinal);
        var nationalities = Top(active.GroupBy(w => w.NationalityCode), code => code is not null && nationalityNames.TryGetValue(code, out var n) ? (n.NameAr, n.NameEn) : ("غير محدد", "Not set"));
        var professions = Top(active.GroupBy(w => w.ProfessionCode), code => code is not null && professionNames.TryGetValue(code, out var n) ? (n.NameAr, n.NameEn) : ("غير محدد", "Not set"));

        var today = clock.Today;
        var activePeople = active.Select(w => w.PersonId).ToHashSet();
        var iqamas = await db.Identifiers.AsNoTracking().Where(i => i.Type == IdentifierType.Iqama && i.IsCurrent && i.ExpiresOn != null)
            .Select(i => new { i.PersonId, i.ExpiresOn }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var activeIqamas = iqamas.Where(i => activePeople.Contains(i.PersonId)).ToList();

        var historyIssues = await db.HistoryIssues.AsNoTracking().CountAsync(cancellationToken).ConfigureAwait(false);
        var check = await db.InvoiceCheckLines.AsNoTracking().GroupBy(l => new { l.Month, l.Result }).Select(g => new { g.Key.Month, g.Key.Result, Count = g.Count() })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var checkMonth = check.Count > 0 ? check.Max(c => c.Month) : (DateOnly?)null;
        decimal? checkRate = null;
        if (checkMonth is { } month)
        {
            var counted = check.Where(c => c.Month == month && c.Result != InvoiceCheckResults.ProjectNotInvoiced).ToList();
            var total = counted.Sum(c => c.Count);
            checkRate = total == 0 ? null : Math.Round(100m * counted.Where(c => c.Result == InvoiceCheckResults.Match).Sum(c => c.Count) / total, 1);
        }

        return new WorkforceDashboardDto(
            active.Count, placements, projects.Take(8).ToList(), projects.Count, nationalities, professions,
            await MovesAsync(today, cancellationToken).ConfigureAwait(false),
            activeIqamas.Count,
            activeIqamas.Count(i => i.ExpiresOn >= today && i.ExpiresOn <= today.AddDays(30)),
            activeIqamas.Count(i => i.ExpiresOn < today),
            historyIssues, checkMonth, checkRate);
    }

    /// <summary>
    /// The work starts and returns to housing of the last twelve months, from the timeline: the old system's history up
    /// to each worker's first period recorded here, then the recorded periods.
    /// </summary>
    private async Task<IReadOnlyList<MonthMovesDto>> MovesAsync(DateOnly today, CancellationToken cancellationToken)
    {
        var from = new DateOnly(today.Year, today.Month, 1).AddMonths(-11);
        var firstRecorded = await db.Periods.AsNoTracking().GroupBy(p => p.WorkerId).Select(g => new { g.Key, First = g.Min(p => p.StartsOn) })
            .ToDictionaryAsync(x => x.Key, x => x.First, cancellationToken).ConfigureAwait(false);
        var recorded = await db.Periods.AsNoTracking().Where(p => p.StartsOn >= from && (p.Kind == PeriodKind.Work || p.Kind == PeriodKind.Housing))
            .Select(p => new { p.WorkerId, p.Kind, p.StartsOn, Place = p.ProjectName }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var history = await db.HistoryPeriods.AsNoTracking().Where(p => p.StartsOn >= from && (p.Kind == PeriodKind.Work || p.Kind == PeriodKind.Housing))
            .Select(p => new { p.WorkerId, p.Kind, p.StartsOn, p.Place }).ToListAsync(cancellationToken).ConfigureAwait(false);

        // Nothing on the inactive workers' project counts: neither a start on it nor a return from it. A worker parked there
        // later still moved before (as the old report counts).
        var moves = recorded
            .Concat(history.Where(h => !firstRecorded.TryGetValue(h.WorkerId, out var first) || h.StartsOn < first))
            .GroupBy(m => m.WorkerId)
            .SelectMany(g =>
            {
                var ordered = g.OrderBy(m => m.StartsOn).ToList();
                return ordered.Where((m, i) => m.Kind == PeriodKind.Work
                    ? !options.Value.IsInactiveProject(m.Place)
                    : !options.Value.IsInactiveProject(ordered.Take(i).LastOrDefault(x => x.Kind == PeriodKind.Work)?.Place));
            })
            .ToLookup(m => new DateOnly(m.StartsOn.Year, m.StartsOn.Month, 1));
        return Enumerable.Range(0, 12).Select(i => from.AddMonths(i))
            .Select(m => new MonthMovesDto(m, moves[m].Count(x => x.Kind == PeriodKind.Work), moves[m].Count(x => x.Kind == PeriodKind.Housing)))
            .ToList();
    }

    public async Task<WorkforceNow> NowAsync(CancellationToken cancellationToken)
    {
        var now = await GetAsync(cancellationToken).ConfigureAwait(false);
        return new WorkforceNow(now.Placements.GetValueOrDefault(nameof(Placement.Working)), now.Placements.GetValueOrDefault(nameof(Placement.Housing)), now.ProjectsWithWorkers);
    }

    public async Task<IReadOnlyList<WorkforceMove>> MovesAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var after = to.AddDays(1);
        var workers = await db.Workers.AsNoTracking().Where(w => w.Kind == WorkerKind.Worker && !w.RemovedInCrm)
            .Join(db.People, w => w.PersonId, p => p.Id, (w, p) => new { w.Id, w.WorkerNo, w.Placement, p.NameAr, p.NameEn })
            .ToDictionaryAsync(w => w.Id, cancellationToken).ConfigureAwait(false);
        var firstRecorded = await db.Periods.AsNoTracking().GroupBy(p => p.WorkerId).Select(g => new { g.Key, First = g.Min(p => p.StartsOn) })
            .ToDictionaryAsync(x => x.Key, x => x.First, cancellationToken).ConfigureAwait(false);

        // The timeline of the workers who moved (and the work just before a return, to know where they came back from).
        var recorded = await db.Periods.AsNoTracking().Where(p => p.StartsOn < after && (p.Kind == PeriodKind.Work || p.Kind == PeriodKind.Housing))
            .Select(p => new { p.WorkerId, p.Kind, p.StartsOn, p.ProjectCrmId, Place = p.ProjectName }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var history = await db.HistoryPeriods.AsNoTracking().Where(p => p.StartsOn < after && (p.Kind == PeriodKind.Work || p.Kind == PeriodKind.Housing))
            .Select(p => new { p.WorkerId, p.Kind, p.StartsOn, p.ProjectCrmId, p.Place }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var timeline = recorded
            .Concat(history.Where(h => !firstRecorded.TryGetValue(h.WorkerId, out var first) || h.StartsOn < first))
            .Where(m => workers.ContainsKey(m.WorkerId))
            .ToLookup(m => m.WorkerId);

        var moves = new List<WorkforceMove>();
        foreach (var group in timeline)
        {
            var w = workers[group.Key];
            var ordered = group.OrderBy(m => m.StartsOn).ToList();
            for (var i = 0; i < ordered.Count; i++)
            {
                var m = ordered[i];
                if (m.StartsOn < from || (m.Kind == PeriodKind.Work && options.Value.IsInactiveProject(m.Place)))
                {
                    continue;
                }

                // A return from the inactive workers' project is not a return.
                var before = m.Kind == PeriodKind.Housing ? ordered.Take(i).LastOrDefault(x => x.Kind == PeriodKind.Work) : null;
                if (before is not null && options.Value.IsInactiveProject(before.Place))
                {
                    continue;
                }

                moves.Add(new WorkforceMove(
                    w.Id, w.WorkerNo, w.NameAr ?? w.NameEn, m.Kind == PeriodKind.Work ? "Work" : "Housing", m.StartsOn,
                    m.Kind == PeriodKind.Work ? m.ProjectCrmId : null, m.Place, before?.ProjectCrmId, before?.Place, before?.StartsOn));
            }
        }

        return moves.OrderBy(m => m.StartsOn).ToList();
    }

    public async Task<IReadOnlyList<WorkforceArrival>> ArrivalsAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var today = clock.Today;
        var arrived = await db.Workers.AsNoTracking()
            .Where(w => w.Kind == WorkerKind.Worker && !w.RemovedInCrm && w.ArrivedOn != null && w.ArrivedOn >= from && w.ArrivedOn <= to)
            .Join(db.People, w => w.PersonId, p => p.Id, (w, p) => new { w.Id, w.WorkerNo, w.Sponsor, w.ArrivedOn, w.Placement, p.NameAr, p.NameEn })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var timelines = await TimelinesAsync(arrived.Select(a => a.Id).ToHashSet(), cancellationToken).ConfigureAwait(false);
        return arrived.Select(a =>
            {
                var since = a.ArrivedOn!.Value;
                var spans = timelines[a.Id].Where(p => (p.EndsOn ?? today.AddDays(1)) > since).ToList();
                int Days(PeriodKind kind) => spans.Where(p => p.Kind == kind).Sum(p => Math.Max(0, Math.Min((p.EndsOn ?? today.AddDays(1)).DayNumber, today.AddDays(1).DayNumber) - Math.Max(p.StartsOn.DayNumber, since.DayNumber)));
                var first = spans.Where(p => p.Kind == PeriodKind.Work && p.StartsOn >= since).OrderBy(p => p.StartsOn).FirstOrDefault();
                return new WorkforceArrival(a.Id, a.WorkerNo, a.NameAr ?? a.NameEn, a.Sponsor, since, a.Placement.ToString(), first?.StartsOn, first?.Place, Days(PeriodKind.Work), Days(PeriodKind.Housing));
            })
            .OrderByDescending(a => a.ArrivedOn).ThenBy(a => a.WorkerNo, StringComparer.Ordinal).ToList();
    }

    public async Task<IReadOnlyList<WorkforceInHousing>> InHousingAsync(CancellationToken cancellationToken)
    {
        var today = clock.Today;
        var workers = await db.Workers.AsNoTracking().Where(w => w.Kind == WorkerKind.Worker && !w.RemovedInCrm && w.Placement != Placement.Inactive)
            .Join(db.People, w => w.PersonId, p => p.Id, (w, p) => new { w.Id, w.WorkerNo, w.Placement, w.Salary, p.NameAr, p.NameEn })
            .ToDictionaryAsync(w => w.Id, cancellationToken).ConfigureAwait(false);
        var open = await db.Periods.AsNoTracking().Where(p => p.EndsOn == null).Select(p => new { p.WorkerId, p.Kind }).ToDictionaryAsync(p => p.WorkerId, p => p.Kind, cancellationToken).ConfigureAwait(false);

        // Where each worker is now: an open period recorded here, then the old system's status (as the dashboard counts).
        var housed = workers.Values.Where(w => open.TryGetValue(w.Id, out var kind) ? kind == PeriodKind.Housing && InHousingStatus(w.Placement) : w.Placement == Placement.Housing).ToList();
        var timelines = await TimelinesAsync(housed.Select(w => w.Id).ToHashSet(), cancellationToken).ConfigureAwait(false);
        return housed.Select(w =>
            {
                var line = timelines[w.Id].OrderBy(p => p.StartsOn).ToList();
                var stay = line.LastOrDefault(p => p.Kind == PeriodKind.Housing);
                var before = stay is null ? null : line.LastOrDefault(p => p.Kind == PeriodKind.Work && p.StartsOn <= stay.StartsOn);
                return new WorkforceInHousing(w.Id, w.WorkerNo, w.NameAr ?? w.NameEn, stay?.StartsOn ?? today, stay?.Place, before?.ProjectCrmId, before?.Place, w.Salary.Total);
            })
            .OrderBy(h => h.Since).ToList();
    }

    public async Task<IReadOnlyList<WorkerDays>> DaysAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var after = to.AddDays(1);
        var ids = (await db.Periods.AsNoTracking().Where(p => (p.Kind == PeriodKind.Work || p.Kind == PeriodKind.Housing) && p.StartsOn < after && (p.EndsOn == null || p.EndsOn > from)).Select(p => p.WorkerId)
                .Union(db.HistoryPeriods.AsNoTracking().Where(p => (p.Kind == PeriodKind.Work || p.Kind == PeriodKind.Housing) && p.StartsOn < after && (p.EndsOn == null || p.EndsOn > from)).Select(p => p.WorkerId))
                .ToListAsync(cancellationToken).ConfigureAwait(false)).ToHashSet();
        var workers = await db.Workers.AsNoTracking().Where(w => ids.Contains(w.Id) && w.Kind == WorkerKind.Worker)
            .Join(db.People, w => w.PersonId, p => p.Id, (w, p) => new { w.Id, w.CrmId, w.WorkerNo, w.Sponsor, w.Salary, w.Placement, Name = p.NameAr ?? p.NameEn })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var timelines = await TimelinesAsync(workers.Select(w => w.Id).ToHashSet(), cancellationToken).ConfigureAwait(false);
        var today = clock.Today.AddDays(1);
        int Overlap(Span s) => Math.Max(0, Math.Min((s.EndsOn ?? today).DayNumber, after.DayNumber) - Math.Max(s.StartsOn.DayNumber, from.DayNumber));
        return workers.Select(w =>
            {
                // No work on the inactive workers' project; a stay still open counts only while the worker is in housing (a
                // worker since gone on vacation, transferred or out has no such days); a stay followed by a move counts as it was.
                var spans = timelines[w.Id]
                    .Where(s => s.Kind == PeriodKind.Work ? !options.Value.IsInactiveProject(s.Place) : s.EndsOn is not null || InHousingStatus(w.Placement))
                    .Where(s => s.StartsOn < after && (s.EndsOn ?? today) > from)
                    .ToList();
                var projects = spans.Where(s => s.Kind == PeriodKind.Work)
                    .GroupBy(s => (s.ProjectCrmId, s.Place)).Select(g => new ProjectDays(g.Key.ProjectCrmId, g.Key.Place, g.Sum(Overlap))).Where(p => p.Days > 0).ToList();
                var housing = spans.Where(s => s.Kind == PeriodKind.Housing).Sum(Overlap);
                return new WorkerDays(w.Id, w.CrmId, w.WorkerNo, w.Name, w.Sponsor, w.Salary.Total, projects, housing, w.Placement == Placement.New,
                    spans.Select(s => new WorkerSpan(s.Kind == PeriodKind.Work ? "Work" : "Housing", s.StartsOn, s.EndsOn, s.ProjectCrmId, s.Place)).ToList());
            })
            .Where(w => w.WorkDays > 0 || w.HousingDays > 0)
            .ToList();
    }

    /// <summary>The statuses of a worker in the company's housing (a new arrival waits there too).</summary>
    private static bool InHousingStatus(Placement placement) => placement is Placement.Housing or Placement.New;

    internal sealed record Span(PeriodKind Kind, DateOnly StartsOn, DateOnly? EndsOn, Guid? ProjectCrmId, string? Place);

    /// <summary>The timeline of some workers: the old system's history up to the first period recorded here, then the recorded ones.</summary>
    internal async Task<ILookup<Guid, Span>> TimelinesAsync(HashSet<Guid> ids, CancellationToken cancellationToken)
    {
        var list = ids.ToList();
        var recorded = await db.Periods.AsNoTracking().Where(p => list.Contains(p.WorkerId) && (p.Kind == PeriodKind.Work || p.Kind == PeriodKind.Housing))
            .Select(p => new { p.WorkerId, p.Kind, p.StartsOn, p.EndsOn, p.ProjectCrmId, Place = p.ProjectName }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var first = recorded.GroupBy(p => p.WorkerId).ToDictionary(g => g.Key, g => g.Min(p => p.StartsOn));
        var history = await db.HistoryPeriods.AsNoTracking().Where(p => list.Contains(p.WorkerId) && (p.Kind == PeriodKind.Work || p.Kind == PeriodKind.Housing))
            .Select(p => new { p.WorkerId, p.Kind, p.StartsOn, p.EndsOn, p.ProjectCrmId, p.Place }).ToListAsync(cancellationToken).ConfigureAwait(false);
        return recorded.Select(p => (p.WorkerId, Span: new Span(p.Kind, p.StartsOn, p.EndsOn, p.ProjectCrmId, p.Place)))
            .Concat(history.Where(h => !first.TryGetValue(h.WorkerId, out var f) || h.StartsOn < f)
                .Select(h => (h.WorkerId, Span: new Span(h.Kind, h.StartsOn, first.TryGetValue(h.WorkerId, out var f) && (h.EndsOn is null || h.EndsOn > f) ? f : h.EndsOn, h.ProjectCrmId, h.Place))))
            .ToLookup(x => x.WorkerId, x => x.Span);
    }

    /// <summary>The six largest groups, then "others".</summary>
    private static List<NamedCountDto> Top<T>(IEnumerable<IGrouping<string?, T>> groups, Func<string?, (string Ar, string En)> name)
    {
        var sorted = groups.Select(g => (g.Key, Count: g.Count())).OrderByDescending(g => g.Count).ToList();
        var top = sorted.Take(6).Select(g =>
        {
            var (ar, en) = name(g.Key);
            return new NamedCountDto(g.Key, ar, en, g.Count);
        }).ToList();
        if (sorted.Count > 6)
        {
            top.Add(new NamedCountDto(null, "أخرى", "Others", sorted.Skip(6).Sum(g => g.Count)));
        }

        return top;
    }
}
