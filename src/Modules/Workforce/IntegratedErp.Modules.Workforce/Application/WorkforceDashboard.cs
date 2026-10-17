using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Organization.Contracts;
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
internal sealed class WorkforceDashboard(WorkforceDbContext db, IReferenceData reference, IOptions<WorkforceOptions> options, IClock clock)
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
        var inactive = now.Where(w => w.Placement == Placement.Inactive).Select(w => w.Id).ToHashSet();
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
            await MovesAsync(today, inactive, cancellationToken).ConfigureAwait(false),
            activeIqamas.Count,
            activeIqamas.Count(i => i.ExpiresOn >= today && i.ExpiresOn <= today.AddDays(30)),
            activeIqamas.Count(i => i.ExpiresOn < today),
            historyIssues, checkMonth, checkRate);
    }

    /// <summary>
    /// The work starts and returns to housing of the last twelve months, from the timeline: the old system's history up
    /// to each worker's first period recorded here, then the recorded periods.
    /// </summary>
    private async Task<IReadOnlyList<MonthMovesDto>> MovesAsync(DateOnly today, HashSet<Guid> inactive, CancellationToken cancellationToken)
    {
        var from = new DateOnly(today.Year, today.Month, 1).AddMonths(-11);
        var firstRecorded = await db.Periods.AsNoTracking().GroupBy(p => p.WorkerId).Select(g => new { g.Key, First = g.Min(p => p.StartsOn) })
            .ToDictionaryAsync(x => x.Key, x => x.First, cancellationToken).ConfigureAwait(false);
        var recorded = await db.Periods.AsNoTracking().Where(p => p.StartsOn >= from && (p.Kind == PeriodKind.Work || p.Kind == PeriodKind.Housing))
            .Select(p => new { p.WorkerId, p.Kind, p.StartsOn, Place = p.ProjectName }).ToListAsync(cancellationToken).ConfigureAwait(false);
        var history = await db.HistoryPeriods.AsNoTracking().Where(p => p.StartsOn >= from && (p.Kind == PeriodKind.Work || p.Kind == PeriodKind.Housing))
            .Select(p => new { p.WorkerId, p.Kind, p.StartsOn, p.Place }).ToListAsync(cancellationToken).ConfigureAwait(false);

        // Neither the inactive workers' movements nor anyone's work starts on an inactive project.
        var moves = recorded
            .Concat(history.Where(h => !firstRecorded.TryGetValue(h.WorkerId, out var first) || h.StartsOn < first))
            .Where(m => !inactive.Contains(m.WorkerId) && !(m.Kind == PeriodKind.Work && options.Value.IsInactiveProject(m.Place)))
            .ToLookup(m => new DateOnly(m.StartsOn.Year, m.StartsOn.Month, 1));
        return Enumerable.Range(0, 12).Select(i => from.AddMonths(i))
            .Select(m => new MonthMovesDto(m, moves[m].Count(x => x.Kind == PeriodKind.Work), moves[m].Count(x => x.Kind == PeriodKind.Housing)))
            .ToList();
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
