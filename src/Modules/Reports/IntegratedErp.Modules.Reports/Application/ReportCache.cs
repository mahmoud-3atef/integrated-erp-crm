using System.Collections.Concurrent;
using IntegratedErp.BuildingBlocks.Live;
using Microsoft.Extensions.Caching.Memory;

namespace IntegratedErp.Modules.Reports.Application;

/// <summary>
/// What a report built from slow sources (the old system's invoices and tasks, ~150 MB of copied JSON) keeps in memory
/// (the user's request, 2026-10-24: the reports were slow from outside). Built again only when its sources changed (the
/// version of the areas it reads, from <see cref="LiveChanges"/>), not every few minutes; and built once when several
/// pages ask at the same moment (the dashboard asks in parallel), instead of once per request.
/// </summary>
internal sealed class ReportCache(IMemoryCache cache, LiveChanges live)
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> Gates = new(StringComparer.Ordinal);

    /// <summary>
    /// The value kept under <paramref name="key"/> for the current version of <paramref name="areas"/>, or a new one
    /// from <paramref name="build"/>. <paramref name="keep"/> is a safety limit (a change no save announced).
    /// </summary>
    public async Task<T> GetAsync<T>(string key, Guid tenantId, IReadOnlyCollection<string> areas, TimeSpan keep, Func<Task<T>> build, CancellationToken cancellationToken)
    {
        var version = live.Version(tenantId, areas);
        if (cache.TryGetValue(key, out Kept<T>? kept) && kept!.Version == version)
        {
            return kept.Value;
        }

        var gate = Gates.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            // Another request may have built it while this one waited.
            version = live.Version(tenantId, areas);
            if (cache.TryGetValue(key, out kept) && kept!.Version == version)
            {
                return kept.Value;
            }

            // The version is read before building: a change made meanwhile leaves this copy older, so it is built again.
            var value = await build().ConfigureAwait(false);
            cache.Set(key, new Kept<T>(version, value), keep);
            return value;
        }
        finally
        {
            gate.Release();
        }
    }

    private sealed record Kept<T>(long Version, T Value);
}

/// <summary>The areas (modules, or copied CRM entities) each kept report reads.</summary>
internal static class ReportSources
{
    public static readonly string[] LegacyInvoices = ["crm_sync.new_invoice", "crm_sync.new_invoicdetail", "commercial"];

    public static readonly string[] LegacyTasks = ["crm_sync.task"];

    public static readonly string[] Profit = [.. LegacyInvoices, "operations", "workforce", "expense", "organization"];
}
