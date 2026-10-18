using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.Workforce.Application;

internal sealed class PeriodLedger(WorkforceDbContext db, IOptions<WorkforceOptions> options, IClock clock) : IPeriodLedger
{
    public async Task<Result> StartWorkAsync(IReadOnlyList<WorkStartRequest> starts, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(starts);
        var workerIds = starts.Select(s => s.WorkerId).Distinct().ToList();
        var lineIds = starts.Select(s => (Guid?)s.SourceLineId).ToList();
        var done = await db.Periods.Where(p => p.SourceLineId != null && lineIds.Contains(p.SourceLineId)).Select(p => p.SourceLineId!.Value)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var periods = await db.Periods.Where(p => workerIds.Contains(p.WorkerId)).ToListAsync(cancellationToken).ConfigureAwait(false);
        if (await db.Workers.CountAsync(w => workerIds.Contains(w.Id), cancellationToken).ConfigureAwait(false) != workerIds.Count)
        {
            return Result.Failure(Error.NotFound("worker", "Worker not found."));
        }

        var now = clock.UtcNow;
        foreach (var start in starts.Where(s => !done.Contains(s.SourceLineId)))
        {
            var mine = periods.Where(p => p.WorkerId == start.WorkerId).ToList();

            // L1: periods never overlap: nothing of the worker's may start on or after the new start.
            if (mine.Any(p => p.StartsOn >= start.StartsOn || (p.EndsOn is { } end && end > start.StartsOn)))
            {
                return Result.Failure(Error.Conflict("period_overlap", "The worker already has a period on or after this start of work."));
            }

            if (mine.FirstOrDefault(p => p.IsOpen) is { } open)
            {
                var closed = open.Close(start.StartsOn, start.SourceNo);
                if (closed.IsFailure)
                {
                    return closed;
                }
            }

            var period = WorkerPeriod.Open(
                start.WorkerId, PeriodKind.Work, start.StartsOn,
                new PeriodProject(start.ProjectId, start.ProjectCrmId, start.ProjectName),
                new PeriodRate(start.PackageId, start.PackageNo, start.Salary, start.ServiceFee, start.Housing, start.HousingBillable,
                    start.Transport, start.TransportBillable, start.TotalPrice, start.IsSpecialPrice),
                new PeriodSource(start.SourceType, start.SourceId, start.SourceLineId, start.SourceNo),
                now);
            db.Periods.Add(period);
            periods.Add(period);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> StartHousingAsync(HousingStartRequest start, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(start);
        if (await db.Periods.AnyAsync(p => p.SourceId == start.SourceId && p.WorkerId == start.WorkerId && p.Kind == PeriodKind.Housing, cancellationToken).ConfigureAwait(false))
        {
            return Result.Success(); // already applied
        }

        if (!await db.Workers.AnyAsync(w => w.Id == start.WorkerId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(Error.NotFound("worker", "Worker not found."));
        }

        var mine = await db.Periods.Where(p => p.WorkerId == start.WorkerId).ToListAsync(cancellationToken).ConfigureAwait(false);
        if (mine.Any(p => p.StartsOn >= start.StartsOn || (p.EndsOn is { } end && end > start.StartsOn)))
        {
            return Result.Failure(Error.Conflict("period_overlap", "The worker already has a period on or after this date."));
        }

        if (mine.FirstOrDefault(p => p.IsOpen) is { } open)
        {
            if (open.Kind != PeriodKind.Work)
            {
                return Result.Failure(Error.Conflict("period_not_work", "The worker is not on the job."));
            }

            var closed = open.Close(start.StartsOn, start.SourceNo);
            if (closed.IsFailure)
            {
                return closed;
            }
        }

        db.Periods.Add(WorkerPeriod.Open(
            start.WorkerId, PeriodKind.Housing, start.StartsOn, new PeriodProject(null, null, start.HousingName), null,
            new PeriodSource(start.SourceType, start.SourceId, null, start.SourceNo), clock.UtcNow, start.PaySalary));
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>The periods a movement may leave for each kind it opens.</summary>
    private static readonly Dictionary<PeriodKind, PeriodKind[]> From = new()
    {
        [PeriodKind.Housing] = [PeriodKind.Vacation, PeriodKind.ClientVacation, PeriodKind.Absconded, PeriodKind.Suspended],
        [PeriodKind.Vacation] = [PeriodKind.Work, PeriodKind.Housing],
        [PeriodKind.ClientVacation] = [PeriodKind.Work],
        [PeriodKind.Absconded] = [PeriodKind.Work, PeriodKind.Housing, PeriodKind.Vacation, PeriodKind.ClientVacation],
        [PeriodKind.Suspended] = [PeriodKind.Work, PeriodKind.Housing],
        [PeriodKind.Out] = [PeriodKind.Work, PeriodKind.Housing, PeriodKind.Vacation, PeriodKind.ClientVacation, PeriodKind.Absconded, PeriodKind.Suspended],
    };

    public async Task<Result> StartPeriodAsync(PeriodStartRequest start, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(start);
        if (!Enum.TryParse<PeriodKind>(start.Kind, out var kind) || kind == PeriodKind.Work || !From.TryGetValue(kind, out var allowed))
        {
            return Result.Failure(Error.Validation("period_kind", "This kind of period is not opened by a movement."));
        }

        if (await db.Periods.AnyAsync(p => p.SourceId == start.SourceId && p.WorkerId == start.WorkerId && p.Kind == kind, cancellationToken).ConfigureAwait(false))
        {
            return Result.Success(); // already applied
        }

        if (!await db.Workers.AnyAsync(w => w.Id == start.WorkerId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(Error.NotFound("worker", "Worker not found."));
        }

        var mine = await db.Periods.Where(p => p.WorkerId == start.WorkerId).ToListAsync(cancellationToken).ConfigureAwait(false);
        if (mine.Any(p => p.StartsOn >= start.StartsOn || (p.EndsOn is { } end && end > start.StartsOn)))
        {
            return Result.Failure(Error.Conflict("period_overlap", "The worker already has a period on or after this date."));
        }

        var open = mine.FirstOrDefault(p => p.IsOpen);
        if (open is not null && !allowed.Contains(open.Kind))
        {
            return Result.Failure(Error.Conflict("period_transition", "The worker's current period does not allow this movement."));
        }

        // A vacation on the customer is billed: it keeps the project and the price of the work it interrupts.
        PeriodProject? project = null;
        PeriodRate? rate = null;
        if (kind == PeriodKind.ClientVacation)
        {
            if (open is not null)
            {
                (project, rate) = (new PeriodProject(open.ProjectId, open.ProjectCrmId, open.ProjectName), open.Rate);
            }
            else if (await db.HistoryPeriods.AsNoTracking().Where(h => h.WorkerId == start.WorkerId && h.Kind == PeriodKind.Work && h.EndsOn == null && h.StartsOn < start.StartsOn)
                         .OrderByDescending(h => h.StartsOn).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false) is { } history)
            {
                (project, rate) = (new PeriodProject(null, history.ProjectCrmId, history.Place), history.Rate);
            }
            else
            {
                return Result.Failure(Error.Conflict("period_not_work", "The worker is not on the job."));
            }
        }

        if (open is not null)
        {
            var closed = open.Close(start.StartsOn, start.SourceNo);
            if (closed.IsFailure)
            {
                return closed;
            }
        }

        db.Periods.Add(WorkerPeriod.Open(
            start.WorkerId, kind, start.StartsOn, project ?? new PeriodProject(null, null, start.Place), rate,
            new PeriodSource(start.SourceType, start.SourceId, null, start.SourceNo), clock.UtcNow, start.PaySalary));
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<IReadOnlyList<PeriodInfo>> PeriodsAsync(Guid workerId, CancellationToken cancellationToken)
    {
        var recorded = (await db.Periods.AsNoTracking().Where(p => p.WorkerId == workerId).ToListAsync(cancellationToken).ConfigureAwait(false))
            .Select(Info).ToList();
        var takesOver = recorded.Count > 0 ? recorded.Min(p => p.StartsOn) : (DateOnly?)null;
        var history = (await db.HistoryPeriods.AsNoTracking().Where(p => p.WorkerId == workerId).ToListAsync(cancellationToken).ConfigureAwait(false))
            .Where(p => takesOver is null || p.StartsOn < takesOver)
            .Select(p => new PeriodInfo(
                p.Id, p.Kind.ToString(), null, p.Place, p.StartsOn,
                takesOver is { } over && (p.EndsOn is null || p.EndsOn > over) ? over : p.EndsOn,
                p.SourceType, p.SourceCrmId, p.SourceNo, null, null,
                null, null,
                p.Kind == PeriodKind.Work ? p.Rate.Housing : null,
                p.Kind == PeriodKind.Work ? p.Rate.Transport : null,
                p.Kind == PeriodKind.Work && p.Rate.TotalPrice > 0 ? p.Rate.TotalPrice : null,
                false, false, FromOldSystem: true, ProjectCrmId: p.ProjectCrmId));
        return recorded.Concat(history).OrderByDescending(p => p.StartsOn).ToList();
    }

    public async Task<IReadOnlyList<WorkSpan>> WorkAsync(Guid? projectCrmId, DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var after = to.AddDays(1);
        var firstRecorded = await db.Periods.AsNoTracking().GroupBy(p => p.WorkerId).Select(g => new { g.Key, First = g.Min(p => p.StartsOn) })
            .ToDictionaryAsync(x => x.Key, x => x.First, cancellationToken).ConfigureAwait(false);
        var recorded = (await db.Periods.AsNoTracking()
                .Where(p => (p.Kind == PeriodKind.Work || p.Kind == PeriodKind.ClientVacation) && p.ProjectCrmId != null && (projectCrmId == null || p.ProjectCrmId == projectCrmId)
                    && p.StartsOn < after && (p.EndsOn == null || p.EndsOn > from))
                .ToListAsync(cancellationToken).ConfigureAwait(false))
            .Select(p => new WorkSpan(
                p.Id.ToString("N"), p.WorkerId, p.ProjectCrmId!.Value, p.ProjectName, p.StartsOn, p.EndsOn, p.Rate.PackageNo, p.Rate.Salary, p.Rate.ServiceFee,
                p.Rate.Housing, p.Rate.HousingBillable, p.Rate.Transport, p.Rate.TransportBillable, p.Rate.TotalPrice, p.Rate.IsSpecialPrice,
                p.SourceType, p.SourceNo, FromOldSystem: false));
        var history = (await db.HistoryPeriods.AsNoTracking()
                .Where(p => p.Kind == PeriodKind.Work && p.ProjectCrmId != null && (projectCrmId == null || p.ProjectCrmId == projectCrmId)
                    && p.StartsOn < after && (p.EndsOn == null || p.EndsOn > from))
                .ToListAsync(cancellationToken).ConfigureAwait(false))
            .Where(p => !firstRecorded.TryGetValue(p.WorkerId, out var over) || p.StartsOn < over)
            .Select(p =>
            {
                var ends = firstRecorded.TryGetValue(p.WorkerId, out var over) && (p.EndsOn is null || p.EndsOn > over) ? over : p.EndsOn;
                return new WorkSpan(
                    p.SourceCrmId.ToString("N"), p.WorkerId, p.ProjectCrmId!.Value, p.Place, p.StartsOn, ends, null, 0, 0,
                    p.Rate.Housing, p.Rate.HousingBillable, p.Rate.Transport, p.Rate.TransportBillable, p.Rate.TotalPrice, false,
                    p.SourceType, p.SourceNo, FromOldSystem: true);
            })
            .Where(p => p.EndsOn is null || p.EndsOn > from);
        var settings = options.Value;
        return recorded.Concat(history).Where(p => !settings.IsInactiveProject(p.ProjectName)).OrderBy(p => p.WorkerId).ThenBy(p => p.StartsOn).ToList();
    }

    internal static PeriodInfo Info(WorkerPeriod p)
    {
        var priced = p.Kind is PeriodKind.Work or PeriodKind.ClientVacation;
        return new(
            p.Id, p.Kind.ToString(), p.ProjectId, p.ProjectName, p.StartsOn, p.EndsOn, p.SourceType, p.SourceId, p.SourceNo, p.ClosedByNo,
            p.Rate.PackageNo,
            priced ? p.Rate.Salary : null,
            priced ? p.Rate.ServiceFee : null,
            priced ? p.Rate.Housing : null,
            priced ? p.Rate.Transport : null,
            priced ? p.Rate.TotalPrice : null,
            p.Rate.IsSpecialPrice,
            p.PaySalary,
            ProjectCrmId: p.ProjectCrmId);
    }
}
