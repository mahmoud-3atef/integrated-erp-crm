using System.Globalization;
using System.Text.RegularExpressions;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace IntegratedErp.BuildingBlocks.Numbering;

/// <summary>Which counter to draw from: document type, scope (e.g. legal entity code) and reset period (e.g. year).</summary>
public sealed record NumberRequest(string SequenceKey, string ScopeKey = "", int Period = 0);

/// <summary>When a sequence's counter starts again.</summary>
public enum NumberReset
{
    Never,
    Yearly,
    Monthly,
}

/// <summary>
/// A numbered document type a module declares (like its permissions): its key, the module schema holding its
/// counter, its names, and its default pattern and reset. The company may change the pattern, the reset and the
/// number to start from (<see cref="NumberingRule"/>). <paramref name="InUse"/> false: declared ahead of the screen
/// that will use it (e.g. worker numbers, invoices), so the company can set its serial now.
/// </summary>
public sealed record NumberSequenceDefinition(
    string Key,
    string Schema,
    string GroupAr,
    string GroupEn,
    string NameAr,
    string NameEn,
    string DefaultPattern,
    NumberReset DefaultReset,
    bool InUse = true);

/// <summary>The company's setting for a sequence: its pattern, its reset, and the least number to issue next.</summary>
public sealed record NumberingRule(string Pattern, NumberReset Reset, long StartAt);

/// <summary>The company's numbering settings (implemented by the Organization module).</summary>
public interface INumberingRules
{
    Task<NumberingRule?> FindAsync(string key, CancellationToken cancellationToken);
}

/// <summary>All sequences of the enabled modules.</summary>
public sealed class NumberingCatalog(IEnumerable<NumberSequenceDefinition> definitions)
{
    private readonly Dictionary<string, NumberSequenceDefinition> _byKey =
        definitions.GroupBy(d => d.Key, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

    public IReadOnlyCollection<NumberSequenceDefinition> All => _byKey.Values;

    public NumberSequenceDefinition? Find(string key) => _byKey.GetValueOrDefault(key);
}

public static class NumberingExtensions
{
    /// <summary>Declares a module's numbered document types (call from <c>IModule.RegisterServices</c>).</summary>
    public static IServiceCollection AddNumberSequences(this IServiceCollection services, params NumberSequenceDefinition[] definitions)
    {
        ArgumentNullException.ThrowIfNull(definitions);
        foreach (var definition in definitions)
        {
            services.AddSingleton(definition);
        }

        services.TryAddSingleton<NumberingCatalog>();
        return services;
    }

    /// <summary>The counter's period for a day: 0 (never reset), the year, or year and month.</summary>
    public static int Period(NumberReset reset, DateOnly date) => reset switch
    {
        NumberReset.Yearly => date.Year,
        NumberReset.Monthly => (date.Year * 100) + date.Month,
        _ => 0,
    };

    /// <summary>
    /// Why a pattern cannot be used (an error code), or null: it needs {N}, only known tokens, and the year (and month)
    /// when the counter starts again every year (month), or numbers would repeat.
    /// </summary>
    public static string? Validate(string? pattern, NumberReset reset)
    {
        if (string.IsNullOrWhiteSpace(pattern) || pattern.Length > 40)
        {
            return "numbering_pattern_empty";
        }

        try
        {
            _ = DocumentNumberFormat.Format(pattern, 1, new DateOnly(2026, 1, 1));
        }
        catch (ArgumentException)
        {
            return "numbering_pattern_invalid";
        }

        var year = pattern.Contains("{YYYY}", StringComparison.Ordinal) || pattern.Contains("{YY}", StringComparison.Ordinal);
        return reset switch
        {
            NumberReset.Yearly when !year => "numbering_pattern_year",
            NumberReset.Monthly when !year || !pattern.Contains("{MM}", StringComparison.Ordinal) => "numbering_pattern_month",
            _ => null,
        };
    }
}

/// <summary>
/// Gap-free document numbers (required for tax invoices). The counter row is locked and incremented
/// inside the caller's database transaction, so a number is consumed only if the document is saved:
/// a rollback gives the number back. Concurrent callers wait on the row lock and never get duplicates.
/// </summary>
public sealed class NumberSequenceService(ITenantContext tenant, NumberingCatalog catalog, IEnumerable<INumberingRules> rules)
{
    /// <summary>
    /// The next document number of a declared sequence, as the company set it (pattern, reset, number to start from)
    /// or by its default. Inside the transaction that saves the document, like the counters below.
    /// </summary>
    public async Task<string> NextNumberAsync(ModuleDbContext db, string key, DateOnly date, CancellationToken cancellationToken)
    {
        var definition = catalog.Find(key) ?? throw new InvalidOperationException($"Number sequence '{key}' is not declared.");
        NumberingRule? rule = null;
        foreach (var source in rules)
        {
            rule ??= await source.FindAsync(key, cancellationToken).ConfigureAwait(false);
        }

        var pattern = rule?.Pattern ?? definition.DefaultPattern;
        var reset = rule?.Reset ?? definition.DefaultReset;
        var value = await NextAsync(db, new NumberRequest(key, Period: NumberingExtensions.Period(reset, date)), rule?.StartAt ?? 1, cancellationToken)
            .ConfigureAwait(false);
        return DocumentNumberFormat.Format(pattern, value, date);
    }

    public Task<long> NextAsync(ModuleDbContext db, NumberRequest request, CancellationToken cancellationToken) => NextAsync(db, request, 1, cancellationToken);

    /// <summary>The next value of a counter, never below <paramref name="startAt"/> (e.g. a serial continued from the old system).</summary>
    public async Task<long> NextAsync(ModuleDbContext db, NumberRequest request, long startAt, CancellationToken cancellationToken)
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
            WHEN MATCHED THEN UPDATE SET next_value = (CASE WHEN t.next_value < @start THEN @start ELSE t.next_value END) + 1
            WHEN NOT MATCHED THEN INSERT (tenant_id, sequence_key, scope_key, period, next_value) VALUES (s.tenant_id, s.sequence_key, s.scope_key, s.period, @start + 1)
            OUTPUT inserted.next_value - 1 AS [Value];
            """;

        var values = await db.Database.SqlQueryRaw<long>(
                sql,
                new Microsoft.Data.SqlClient.SqlParameter("@tenant_id", tenantId),
                new Microsoft.Data.SqlClient.SqlParameter("@sequence_key", request.SequenceKey.Trim().ToLowerInvariant()),
                new Microsoft.Data.SqlClient.SqlParameter("@scope_key", request.ScopeKey.Trim().ToUpperInvariant()),
                new Microsoft.Data.SqlClient.SqlParameter("@period", request.Period),
                new Microsoft.Data.SqlClient.SqlParameter("@start", Math.Max(1L, startAt)))
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
