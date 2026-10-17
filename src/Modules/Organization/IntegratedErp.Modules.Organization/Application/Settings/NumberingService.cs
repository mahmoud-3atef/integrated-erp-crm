using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Organization.Domain.Settings;
using IntegratedErp.Modules.Organization.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Organization.Application.Settings;

public sealed record NumberingInput(string Pattern, NumberReset Reset, long StartAt);

/// <summary>A numbered document type as the numbering screen shows it: its setting and the number it gives next.</summary>
public sealed record NumberingDto(
    string Key,
    string GroupAr,
    string GroupEn,
    string NameAr,
    string NameEn,
    bool InUse,
    string Pattern,
    NumberReset Reset,
    long StartAt,
    string DefaultPattern,
    NumberReset DefaultReset,
    bool Customized,
    long NextValue,
    string NextNumber,
    string? UpdatedByName,
    DateTimeOffset? UpdatedAt);

/// <summary>
/// The company's numbering settings: each module's numbered documents (delivery orders, price packages, worker
/// numbers, invoices…) with their pattern, their reset and the number to start from. Read by every module when it
/// issues a number (<see cref="NumberSequenceService.NextNumberAsync"/>).
/// </summary>
internal sealed class NumberingService(OrganizationDbContext db, NumberingCatalog catalog, ITenantContext tenant, ICurrentUser user, IClock clock) : INumberingRules
{
    public async Task<NumberingRule?> FindAsync(string key, CancellationToken cancellationToken)
    {
        var setting = await db.Set<NumberingSetting>().AsNoTracking().FirstOrDefaultAsync(s => s.Key == key, cancellationToken).ConfigureAwait(false);
        return setting is null ? null : new NumberingRule(setting.Pattern, setting.Reset, setting.StartAt);
    }

    public async Task<IReadOnlyList<NumberingDto>> ListAsync(CancellationToken cancellationToken)
    {
        var settings = await db.Set<NumberingSetting>().AsNoTracking().ToDictionaryAsync(s => s.Key, cancellationToken).ConfigureAwait(false);
        var today = clock.Today;
        var list = new List<NumberingDto>();
        foreach (var d in catalog.All.OrderBy(d => d.GroupEn, StringComparer.Ordinal).ThenBy(d => d.NameEn, StringComparer.Ordinal))
        {
            var s = settings.GetValueOrDefault(d.Key);
            var pattern = s?.Pattern ?? d.DefaultPattern;
            var reset = s?.Reset ?? d.DefaultReset;
            var counter = await CounterAsync(d.Schema, d.Key, NumberingExtensions.Period(reset, today), cancellationToken).ConfigureAwait(false);
            var next = Math.Max(counter ?? 1, Math.Max(1, s?.StartAt ?? 1));
            list.Add(new NumberingDto(
                d.Key, d.GroupAr, d.GroupEn, d.NameAr, d.NameEn, d.InUse, pattern, reset, s?.StartAt ?? 1, d.DefaultPattern, d.DefaultReset,
                s is not null, next, DocumentNumberFormat.Format(pattern, next, today), s?.UpdatedByName, s?.UpdatedAt));
        }

        return list;
    }

    /// <summary>Changes a document type's numbering; a start below the numbers already issued has no effect (no repeats).</summary>
    public async Task<Result> UpdateAsync(string key, NumberingInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (catalog.Find(key) is null)
        {
            return Result.Failure(Error.NotFound("numbering", "Numbered document type not found."));
        }

        if (NumberingExtensions.Validate(input.Pattern, input.Reset) is { } problem)
        {
            return Result.Failure(Error.Validation(problem, "The number pattern cannot be used."));
        }

        if (input.StartAt is < 1 or > 999_999_999_999)
        {
            return Result.Failure(Error.Validation("numbering_start", "Start from a number between 1 and 999,999,999,999."));
        }

        var setting = await db.Set<NumberingSetting>().FirstOrDefaultAsync(s => s.Key == key, cancellationToken).ConfigureAwait(false);
        if (setting is null)
        {
            setting = NumberingSetting.Create(key);
            db.Add(setting);
        }

        setting.Set(input.Pattern, input.Reset, input.StartAt, user.DisplayName, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>Back to the module's default pattern and reset (the counters stay).</summary>
    public async Task<Result> ResetAsync(string key, CancellationToken cancellationToken)
    {
        await db.Set<NumberingSetting>().Where(s => s.Key == key).ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>The counter's next value, read from the module's own counters table (null when it has none yet).</summary>
    private async Task<long?> CounterAsync(string schema, string key, int period, CancellationToken cancellationToken)
    {
        // The schema comes from a module's declaration, never from input; still only plain names reach the SQL.
        if (string.IsNullOrEmpty(schema) || !schema.All(c => char.IsAsciiLetterLower(c) || c == '_') || tenant.TenantId is not { } tenantId)
        {
            return null;
        }

        try
        {
            var sql = $"SELECT next_value AS [Value] FROM [{schema}].[number_sequence] WHERE tenant_id = @tenant AND sequence_key = @key AND scope_key = '' AND period = @period";
            var values = await db.Database.SqlQueryRaw<long>(
                    sql,
                    new SqlParameter("@tenant", tenantId),
                    new SqlParameter("@key", key),
                    new SqlParameter("@period", period))
                .ToListAsync(cancellationToken).ConfigureAwait(false);
            return values.Count > 0 ? values[0] : null;
        }
        catch (SqlException)
        {
            return null; // the module is off (no table)
        }
    }
}
