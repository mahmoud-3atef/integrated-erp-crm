using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workforce.Application;

internal sealed class PeriodLedger(WorkforceDbContext db, IClock clock) : IPeriodLedger
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

    public async Task<IReadOnlyList<PeriodInfo>> PeriodsAsync(Guid workerId, CancellationToken cancellationToken) =>
        (await db.Periods.AsNoTracking().Where(p => p.WorkerId == workerId).OrderByDescending(p => p.StartsOn)
            .ToListAsync(cancellationToken).ConfigureAwait(false))
        .Select(Info)
        .ToList();

    internal static PeriodInfo Info(WorkerPeriod p) => new(
        p.Id, p.Kind.ToString(), p.ProjectId, p.ProjectName, p.StartsOn, p.EndsOn, p.SourceType, p.SourceId, p.SourceNo, p.ClosedByNo,
        p.Rate.PackageNo,
        p.Kind == PeriodKind.Work ? p.Rate.Salary : null,
        p.Kind == PeriodKind.Work ? p.Rate.ServiceFee : null,
        p.Kind == PeriodKind.Work ? p.Rate.Housing : null,
        p.Kind == PeriodKind.Work ? p.Rate.Transport : null,
        p.Kind == PeriodKind.Work ? p.Rate.TotalPrice : null,
        p.Rate.IsSpecialPrice);
}
