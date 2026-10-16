using System.Globalization;
using System.Text.RegularExpressions;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.BuildingBlocks.Numbering;

/// <summary>Which counter to draw from: document type, scope (e.g. legal entity code) and reset period (e.g. year).</summary>
public sealed record NumberRequest(string SequenceKey, string ScopeKey = "", int Period = 0);

/// <summary>
/// Gap-free document numbers (required for tax invoices). The counter row is locked and incremented
/// inside the caller's database transaction, so a number is consumed only if the document is saved:
/// a rollback gives the number back. Concurrent callers wait on the row lock and never get duplicates.
/// </summary>
public sealed class NumberSequenceService(ITenantContext tenant)
{
    public async Task<long> NextAsync(ModuleDbContext db, NumberRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(db);
        ArgumentNullException.ThrowIfNull(request);
        ArgumentException.ThrowIfNullOrWhiteSpace(request.SequenceKey);

        if (db.Database.CurrentTransaction is null)
        {
            throw new InvalidOperationException("Numbers must be allocated inside the transaction that saves the document (gap-free numbering).");
        }

        var tenantId = tenant.TenantId ?? throw new InvalidOperationException("A tenant is required to allocate a document number.");

        // Schema name is the module's own constant (validated), never user input.
        var schema = db.Schema;
        if (!schema.All(c => char.IsAsciiLetterLower(c) || c == '_'))
        {
            throw new InvalidOperationException($"Invalid schema name '{schema}'.");
        }

        var sql = $"""
            MERGE [{schema}].[number_sequence] WITH (HOLDLOCK) AS t
            USING (SELECT @tenant_id AS tenant_id, @sequence_key AS sequence_key, @scope_key AS scope_key, @period AS period) AS s
                ON t.tenant_id = s.tenant_id AND t.sequence_key = s.sequence_key AND t.scope_key = s.scope_key AND t.period = s.period
            WHEN MATCHED THEN UPDATE SET next_value = t.next_value + 1
            WHEN NOT MATCHED THEN INSERT (tenant_id, sequence_key, scope_key, period, next_value) VALUES (s.tenant_id, s.sequence_key, s.scope_key, s.period, 2)
            OUTPUT inserted.next_value - 1 AS [Value];
            """;

        var values = await db.Database.SqlQueryRaw<long>(
                sql,
                new Microsoft.Data.SqlClient.SqlParameter("@tenant_id", tenantId),
                new Microsoft.Data.SqlClient.SqlParameter("@sequence_key", request.SequenceKey.Trim().ToLowerInvariant()),
                new Microsoft.Data.SqlClient.SqlParameter("@scope_key", request.ScopeKey.Trim().ToUpperInvariant()),
                new Microsoft.Data.SqlClient.SqlParameter("@period", request.Period))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return values.Single();
    }
}

/// <summary>
/// Turns a number into a document number from a pattern, e.g. <c>{SCOPE}-INV-{YYYY}-{N:6}</c> ⇒ <c>CP05-INV-2026-000123</c>.
/// Tokens: <c>{N}</c> or <c>{N:width}</c> (zero-padded), <c>{YYYY}</c>, <c>{YY}</c>, <c>{MM}</c>, <c>{SCOPE}</c>.
/// </summary>
public static partial class DocumentNumberFormat
{
    public static string Format(string pattern, long value, DateOnly date, string scope = "")
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(pattern);
        if (!pattern.Contains("{N", StringComparison.Ordinal))
        {
            throw new ArgumentException("Pattern must contain the {N} token.", nameof(pattern));
        }

        return TokenRegex().Replace(pattern, match =>
        {
            var token = match.Groups["token"].Value;
            var width = match.Groups["width"].Success ? int.Parse(match.Groups["width"].Value, CultureInfo.InvariantCulture) : 0;
            return token switch
            {
                "N" => value.ToString(CultureInfo.InvariantCulture).PadLeft(width, '0'),
                "YYYY" => date.Year.ToString("0000", CultureInfo.InvariantCulture),
                "YY" => (date.Year % 100).ToString("00", CultureInfo.InvariantCulture),
                "MM" => date.Month.ToString("00", CultureInfo.InvariantCulture),
                "SCOPE" => scope,
                _ => throw new ArgumentException($"Unknown token {{{token}}} in pattern.", nameof(pattern)),
            };
        });
    }

    [GeneratedRegex(@"\{(?<token>[A-Z]+)(:(?<width>\d{1,2}))?\}")]
    private static partial Regex TokenRegex();
}
