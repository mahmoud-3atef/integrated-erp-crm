using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workforce.Application;

/// <summary>
/// Builds every worker's history from the old system (docs/03-migration-plan/02 §3, slice 1.5): work starts
/// (new_empwork), approved housing orders (mw_lodginorderdetails) and approved vacations (hr_vicrequest) put in date
/// order; each movement starts a period that the next one closes (the day of a move belongs to the new period).
/// What does not add up is recorded for review. Rebuilt after every sync in which any of them, or the workers, changed.
/// From 2025, with the last movement before 2025 as the starting point.
/// </summary>
internal sealed class HistoryBuilder(WorkforceDbContext db, ICrmStaging staging, IClock clock) : ICrmStagingConsumer
{
    private static readonly TimeSpan Riyadh = TimeSpan.FromHours(3);
    private static readonly DateOnly From = new(2025, 1, 1);

    public string Name => "period history";

    public async Task<string> ApplyAsync(CancellationToken cancellationToken)
    {
        var state = await db.HistoryImports.FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (state is null)
        {
            state = new HistoryImport();
            db.HistoryImports.Add(state);
        }

        var workStarts = await staging.ChangedSinceAsync("new_empwork", state.WorkStartsWatermark, cancellationToken).ConfigureAwait(false);
        var housing = await staging.ChangedSinceAsync("mw_lodginorderdetails", state.HousingWatermark, cancellationToken).ConfigureAwait(false);
        var vacations = await staging.ChangedSinceAsync("hr_vicrequest", state.VacationsWatermark, cancellationToken).ConfigureAwait(false);
        var workerChanges = await staging.ChangedSinceAsync("new_employee", state.WorkersWatermark, cancellationToken).ConfigureAwait(false);
        if (state.BuiltAt is not null && workStarts.Count == 0 && housing.Count == 0 && vacations.Count == 0 && workerChanges.Count == 0)
        {
            return "no changes";
        }

        // The whole copy (a few thousand records): the history is rebuilt from scratch.
        var allStarts = state.WorkStartsWatermark is null ? workStarts : await staging.ChangedSinceAsync("new_empwork", null, cancellationToken).ConfigureAwait(false);
        var allHousing = state.HousingWatermark is null ? housing : await staging.ChangedSinceAsync("mw_lodginorderdetails", null, cancellationToken).ConfigureAwait(false);
        var allVacations = state.VacationsWatermark is null ? vacations : await staging.ChangedSinceAsync("hr_vicrequest", null, cancellationToken).ConfigureAwait(false);

        var workers = await db.Workers.AsNoTracking().Where(w => w.Kind == WorkerKind.Worker && !w.RemovedInCrm)
            .Select(w => new { w.Id, w.CrmId, w.Placement, w.ProjectCrmId, w.ProjectName, w.CrmStatus })
            .ToDictionaryAsync(w => w.CrmId, cancellationToken).ConfigureAwait(false);

        // A work start without a price takes the worker's default service price, as the old system's attendance does.
        var allWorkers = state.WorkersWatermark is null ? workerChanges : await staging.ChangedSinceAsync("new_employee", null, cancellationToken).ConfigureAwait(false);
        var defaults = new Dictionary<Guid, decimal>();
        foreach (var record in allWorkers.Where(r => !r.IsDeleted))
        {
            using var document = JsonDocument.Parse(record.Payload);
            if (Money(document.RootElement, "new_totalservices") is { } price and > 0)
            {
                defaults[record.CrmId] = price;
            }
        }

        var events = new List<Movement>();
        foreach (var record in allStarts.Where(r => !r.IsDeleted))
        {
            using var document = JsonDocument.Parse(record.Payload);
            var row = document.RootElement;
            if (Int(row, "statecode") is not (null or 0) || Id(row, "new_employeeid") is not { } worker || Date(row, "new_startdate") is not { } on)
            {
                continue;
            }

            var price = Money(row, "new_serviceprice") ?? Money(row, "new_totalservices");
            if (price is not > 0 && defaults.TryGetValue(worker, out var fallback))
            {
                price = fallback;
            }

            var housingPart = Money(row, "new_housing") ?? Money(row, "new_phallaowance") ?? 0;
            var transport = Money(row, "new_transportation") ?? Money(row, "new_transportationallowance") ?? 0;
            events.Add(new Movement(
                worker, on, Stamp(row, "createdon"), PeriodKind.Work, Id(row, "new_projectid"), Text(row, "new_projectidname"),
                price is > 0 ? new PeriodRate(null, null, 0, 0, housingPart, false, transport, false, price.Value, false) : PeriodRate.None,
                Date(row, "new_enddate") is { } end ? end.AddDays(1) : null, "empwork", record.CrmId, Text(row, "new_number") ?? "—", Return: false, NoPrice: price is not > 0));
        }

        foreach (var record in allHousing.Where(r => !r.IsDeleted))
        {
            using var document = JsonDocument.Parse(record.Payload);
            var row = document.RootElement;
            if (Int(row, "statuscode") != 100000009 || Id(row, "mw_empid") is not { } worker || Date(row, "mw_arrivedate") is not { } on)
            {
                continue;
            }

            var place = string.Join(" — ", new[] { Text(row, "mw_housingname"), Text(row, "mw_housingapartmentsname") }.Where(x => x is not null));
            events.Add(new Movement(
                worker, on, Stamp(row, "createdon"), PeriodKind.Housing, null, place.Length > 0 ? place : null, PeriodRate.None, null,
                "housing_order", record.CrmId, Text(row, "mw_name") ?? "—", Return: Int(row, "new_entertype") == 100000001, NoPrice: false));
        }

        foreach (var record in allVacations.Where(r => !r.IsDeleted))
        {
            using var document = JsonDocument.Parse(record.Payload);
            var row = document.RootElement;
            if (Int(row, "statuscode") is not (100000010 or 100000033) || Id(row, "hr_empid") is not { } worker || Date(row, "hr_vicstartdate") is not { } on)
            {
                continue;
            }

            var finalExit = Int(row, "new_exist") == 1;
            events.Add(new Movement(
                worker, on, Stamp(row, "createdon"), finalExit ? PeriodKind.Out : PeriodKind.Vacation, null, null, PeriodRate.None,
                finalExit ? null : Date(row, "new_enddate") is { } end ? end.AddDays(1) : null,
                "vacation", record.CrmId, Text(row, "hr_reqnumber") ?? "—", Return: false, NoPrice: false));
        }

        var periods = new List<HistoryPeriod>();
        var issues = new List<HistoryIssue>();
        var today = clock.Today;
        var byWorker = events.Where(e => workers.ContainsKey(e.Worker)).ToLookup(e => e.Worker);
        foreach (var worker in workers.Values)
        {
            var mine = byWorker[worker.CrmId].OrderBy(e => e.On).ThenBy(e => e.CreatedOn).ToList();

            // From 2025, starting from the last movement before it.
            var seed = mine.LastOrDefault(e => e.On < From);
            mine = mine.Where(e => e.On >= From || e == seed).ToList();

            // Two movements on one day: the later one counts.
            var kept = new List<Movement>();
            foreach (var group in mine.GroupBy(e => e.On))
            {
                var ordered = group.OrderBy(e => e.CreatedOn).ToList();
                if (ordered.Count > 1)
                {
                    issues.Add(new HistoryIssue(worker.Id, HistoryIssues.SameDay, group.Key,
                        $"{ordered.Count} حركات في يوم واحد ({string.Join("، ", ordered.Select(e => e.SourceNo))})؛ اعتُمدت الأخيرة {ordered[^1].SourceNo}.", ordered[^1].SourceNo));
                }

                // A duplicate work start on the same project often carries the price the kept one lacks.
                var latest = ordered[^1];
                if (latest.Kind == PeriodKind.Work && latest.NoPrice
                    && ordered.LastOrDefault(e => e.Kind == PeriodKind.Work && !e.NoPrice && e.ProjectCrmId == latest.ProjectCrmId) is { } priced)
                {
                    latest = latest with { Rate = priced.Rate, NoPrice = false };
                }

                kept.Add(latest);
            }

            for (var i = 0; i < kept.Count; i++)
            {
                var e = kept[i];
                var next = i + 1 < kept.Count ? kept[i + 1] : null;
                DateOnly? ends = next?.On;
                if (e.EndsOn is { } before && before <= e.On)
                {
                    issues.Add(new HistoryIssue(worker.Id, HistoryIssues.EndBeforeStart, e.On,
                        $"تاريخ نهاية {Describe(e)} ({before.AddDays(-1):yyyy-MM-dd}) قبل بدايتها؛ تجاهلته.", e.SourceNo));
                    e = e with { EndsOn = null };
                }

                if (e.EndsOn is { } explicitEnd)
                {
                    if (next is null || explicitEnd < next.On)
                    {
                        ends = explicitEnd;
                        if (next is not null || explicitEnd <= today)
                        {
                            issues.Add(new HistoryIssue(worker.Id, HistoryIssues.Gap, explicitEnd,
                                next is null
                                    ? $"انتهت {Describe(e)} في {explicitEnd.AddDays(-1):yyyy-MM-dd} بلا حركة بعدها."
                                    : $"انتهت {Describe(e)} في {explicitEnd.AddDays(-1):yyyy-MM-dd} وبدأت الحركة التالية {next.SourceNo} في {next.On:yyyy-MM-dd}: أيام غير مغطاة.",
                                e.SourceNo));
                        }
                    }
                    else if (explicitEnd > next.On)
                    {
                        issues.Add(new HistoryIssue(worker.Id, HistoryIssues.EndAfterNext, next.On,
                            $"تاريخ نهاية {Describe(e)} ({explicitEnd.AddDays(-1):yyyy-MM-dd}) بعد بداية الحركة التالية {next.SourceNo}؛ اعتُمدت بداية التالية.", e.SourceNo));
                    }
                }

                if (e.Kind == PeriodKind.Work && e.NoPrice)
                {
                    issues.Add(new HistoryIssue(worker.Id, HistoryIssues.WorkWithoutPrice, e.On, $"المباشرة {e.SourceNo} على «{e.Place}» بلا سعر خدمة، ولا سعر خدمة مسجل على العامل.", e.SourceNo));
                }

                if (e.Return && i > 0 && kept[i - 1].Kind != PeriodKind.Work)
                {
                    issues.Add(new HistoryIssue(worker.Id, HistoryIssues.ReturnWithoutWork, e.On,
                        $"أمر التسكين {e.SourceNo} (عامل مرتجع) والعامل قبله لم يكن على مشروع.", e.SourceNo));
                }

                periods.Add(new HistoryPeriod(worker.Id, e.Kind, e.On, ends, e.ProjectCrmId, e.Place, e.Rate, e.SourceType, e.SourceCrmId, e.SourceNo));
            }

            // Where the history leaves the worker, against the old system's status.
            var last = kept.LastOrDefault();
            var current = last is null || (last.EndsOn is { } end && end <= today) ? (PeriodKind?)null : last.Kind;
            if (worker.Placement == Placement.Working && !kept.Any(e => e.Kind == PeriodKind.Work))
            {
                issues.Add(new HistoryIssue(worker.Id, HistoryIssues.OnJobWithoutWorkStart, null,
                    $"على رأس العمل في النظام القديم على «{worker.ProjectName ?? "—"}» بلا أي مباشرة.", null));
            }
            else if (current is { } kind && Expected(kind) is { } expected && !expected.Contains(worker.Placement))
            {
                issues.Add(new HistoryIssue(worker.Id, HistoryIssues.StatusMismatch, last!.On,
                    $"آخر حركة {Describe(last)} ({last.SourceNo}) لكن الحالة في النظام القديم «{CrmWorkerStatus.Name(worker.CrmStatus)?.Ar ?? worker.Placement.ToString()}».", last.SourceNo));
            }
            else if (current == PeriodKind.Work && worker.Placement == Placement.Working && last!.ProjectCrmId is { } project
                     && worker.ProjectCrmId is { } workerProject && project != workerProject)
            {
                issues.Add(new HistoryIssue(worker.Id, HistoryIssues.ProjectMismatch, last.On,
                    $"آخر مباشرة {last.SourceNo} على «{last.Place}» لكن مشروعه في النظام القديم «{worker.ProjectName}».", last.SourceNo));
            }
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await db.HistoryPeriods.ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
        await db.HistoryIssues.ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
        db.HistoryPeriods.AddRange(periods);
        db.HistoryIssues.AddRange(issues);
        var summary = $"{periods.Count} periods for {periods.Select(p => p.WorkerId).Distinct().Count()} workers, {issues.Count} issues";
        state.Built(
            workStarts.Count > 0 ? workStarts.Max(r => r.LastSyncedAt) : null,
            housing.Count > 0 ? housing.Max(r => r.LastSyncedAt) : null,
            vacations.Count > 0 ? vacations.Max(r => r.LastSyncedAt) : null,
            workerChanges.Count > 0 ? workerChanges.Max(r => r.LastSyncedAt) : null,
            clock.UtcNow, summary);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return summary;
    }

    /// <summary>The old system's statuses that agree with being in a period of this kind.</summary>
    private static Placement[]? Expected(PeriodKind kind) => kind switch
    {
        PeriodKind.Work => [Placement.Working],
        PeriodKind.Housing => [Placement.Housing, Placement.New],
        PeriodKind.Vacation => [Placement.Vacation],
        PeriodKind.Out => [Placement.Exited],
        _ => null,
    };

    private static string Describe(Movement e) => e.Kind switch
    {
        PeriodKind.Work => $"المباشرة {e.SourceNo} على «{e.Place}»",
        PeriodKind.Housing => $"التسكين {e.SourceNo}",
        _ => $"الإجازة {e.SourceNo}",
    };

    private sealed record Movement(
        Guid Worker,
        DateOnly On,
        DateTimeOffset? CreatedOn,
        PeriodKind Kind,
        Guid? ProjectCrmId,
        string? Place,
        PeriodRate Rate,
        DateOnly? EndsOn,
        string SourceType,
        Guid SourceCrmId,
        string SourceNo,
        bool Return,
        bool NoPrice);

    private static string? Text(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()) ? v.GetString()!.Trim() : null;

    private static Guid? Id(JsonElement row, string field) => Guid.TryParse(Text(row, field), out var id) ? id : null;

    private static int? Int(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;

    private static decimal? Money(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) ? v.ValueKind switch
        {
            JsonValueKind.Number when v.TryGetDecimal(out var d) => Math.Round(d, 2),
            JsonValueKind.String when decimal.TryParse(v.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var d) => Math.Round(d, 2),
            _ => null,
        } : null;

    private static DateOnly? Date(JsonElement row, string field) =>
        Stamp(row, field) is { } at ? DateOnly.FromDateTime(at.ToOffset(Riyadh).DateTime) : null;

    private static DateTimeOffset? Stamp(JsonElement row, string field) =>
        DateTimeOffset.TryParse(Text(row, field), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var at) ? at : null;
}
