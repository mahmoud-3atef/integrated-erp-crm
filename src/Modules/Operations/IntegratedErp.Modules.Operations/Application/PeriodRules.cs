using IntegratedErp.Modules.Workforce.Contracts;

namespace IntegratedErp.Modules.Operations.Application;

/// <summary>When a worker's next period can start, so a document is refused when it is saved, not when its approval ends.</summary>
internal static class PeriodRules
{
    /// <summary>
    /// The first day a worker can start a new period: the day after the latest one recorded here began (or the day it
    /// ended, when later) — a new period never starts on or before it. Null when the worker has none here yet. The
    /// period a document itself opened (when it is changed) does not count.
    /// </summary>
    public static async Task<DateOnly?> EarliestStartAsync(IPeriodLedger ledger, Guid workerId, Guid? exceptSourceId, CancellationToken cancellationToken)
    {
        var periods = (await ledger.PeriodsAsync(workerId, cancellationToken).ConfigureAwait(false))
            .Where(p => !p.FromOldSystem && p.SourceId != exceptSourceId)
            .ToList();
        return periods.Count == 0 ? null : periods.Max(p => p.EndsOn is { } end && end > p.StartsOn ? end : p.StartsOn.AddDays(1));
    }
}
