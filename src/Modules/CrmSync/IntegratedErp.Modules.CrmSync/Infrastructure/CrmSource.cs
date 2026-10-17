using System.Data;
using System.Text.RegularExpressions;
using IntegratedErp.Modules.CrmSync.Domain;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.CrmSync.Infrastructure;

/// <summary>One CRM record: its id, change time, state, and every readable column (lower-case names).</summary>
public sealed record CrmRow(Guid Id, DateTime ModifiedOn, DateTime? CreatedOn, int? StateCode, IReadOnlyDictionary<string, object?> Values);

/// <summary>Reads the old CRM. Read-only by construction: there is no way to write through it.</summary>
public interface ICrmSource
{
    /// <summary>
    /// The next page of records changed after (<paramref name="afterModifiedOn"/>, <paramref name="afterId"/>), in
    /// (modifiedon, id) order; null watermark = from the start. With <paramref name="createdFrom"/>, only records
    /// created on or after that date.
    /// </summary>
    Task<IReadOnlyList<CrmRow>> ReadPageAsync(CrmEntity entity, DateTime? afterModifiedOn, Guid? afterId, DateTime? createdFrom, int pageSize, CancellationToken cancellationToken);
}

/// <summary>
/// The old CRM database (Care_Pro_MSCRM) over SQL. Three guards keep it read-only, whatever the account can do:
/// <list type="number">
/// <item>Only SELECT statements built here from validated entity names (no text from users ever reaches SQL).</item>
/// <item>Every read runs in a transaction that is always rolled back.</item>
/// <item>The connection asks for read-only intent (ApplicationIntent=ReadOnly).</item>
/// </list>
/// In production the connection must also use an account with read permission only (db_datareader).
/// </summary>
internal sealed partial class SqlCrmSource(IOptions<CrmSyncOptions> options) : ICrmSource
{
    private static readonly DateTime NoChange = new(1900, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    public async Task<IReadOnlyList<CrmRow>> ReadPageAsync(CrmEntity entity, DateTime? afterModifiedOn, Guid? afterId, DateTime? createdFrom, int pageSize, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(entity);
        if (!CrmEntity.IsValidName(entity.Name))
        {
            throw new ArgumentException($"Invalid CRM entity name \"{entity.Name}\".", nameof(entity));
        }

        // Keyset paging on (modifiedon, id); a missing modifiedon sorts first.
        var sql = $"""
            SELECT TOP (@pageSize) *
            FROM [dbo].[{entity.Name}]
            WHERE (@createdFrom IS NULL OR [createdon] >= @createdFrom)
              AND (@afterModifiedOn IS NULL
                   OR ISNULL([modifiedon], '19000101') > @afterModifiedOn
                   OR (ISNULL([modifiedon], '19000101') = @afterModifiedOn AND [{entity.IdColumn}] > @afterId))
            ORDER BY ISNULL([modifiedon], '19000101'), [{entity.IdColumn}]
            """;
        EnsureReadOnly(sql);

        var builder = new SqlConnectionStringBuilder(ConnectionString()) { ApplicationIntent = ApplicationIntent.ReadOnly };
        await using var connection = new SqlConnection(builder.ConnectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
        try
        {
            await using var command = new SqlCommand(sql, connection, transaction) { CommandTimeout = options.Value.CommandTimeoutSeconds };
            command.Parameters.Add(new SqlParameter("@pageSize", SqlDbType.Int) { Value = pageSize });
            command.Parameters.Add(new SqlParameter("@afterModifiedOn", SqlDbType.DateTime) { Value = (object?)afterModifiedOn ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@afterId", SqlDbType.UniqueIdentifier) { Value = (object?)afterId ?? Guid.Empty });
            command.Parameters.Add(new SqlParameter("@createdFrom", SqlDbType.DateTime) { Value = (object?)createdFrom ?? DBNull.Value });

            var rows = new List<CrmRow>();
            await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
            var columns = Enumerable.Range(0, reader.FieldCount)
                .Select(i => (Index: i, Name: reader.GetName(i).ToLowerInvariant(), Type: reader.GetFieldType(i)))
                .Where(c => c.Type != typeof(byte[]))
                .ToList();
            var idName = entity.IdColumn;
            while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                var values = new Dictionary<string, object?>(columns.Count, StringComparer.Ordinal);
                foreach (var (index, name, _) in columns)
                {
                    values[name] = reader.IsDBNull(index) ? null : Normalize(reader.GetValue(index));
                }

                var id = (Guid)reader.GetValue(reader.GetOrdinal(idName));
                var modified = values.GetValueOrDefault("modifiedon") is DateTime m ? m : NoChange;
                var state = values.GetValueOrDefault("statecode") is int s ? s : (int?)null;
                var created = values.GetValueOrDefault("createdon") as DateTime?;
                rows.Add(new CrmRow(id, modified, created, state, values));
            }

            return rows;
        }
        finally
        {
            // Nothing is ever written, and even if it were, it would not be kept.
            await transaction.RollbackAsync(CancellationToken.None).ConfigureAwait(false);
        }
    }

    /// <summary>Refuses any statement that is not a single SELECT (defence in depth; statements are built here).</summary>
    internal static void EnsureReadOnly(string sql)
    {
        if (!sql.TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase) || sql.Contains(';', StringComparison.Ordinal) || WriteKeyword().IsMatch(sql))
        {
            throw new InvalidOperationException("Only single SELECT statements may be sent to the CRM.");
        }
    }

    // CRM dates are UTC without a kind; mark them so they serialize as UTC.
    private static object Normalize(object value) => value is DateTime d ? DateTime.SpecifyKind(d, DateTimeKind.Utc) : value;

    private string ConnectionString() =>
        string.IsNullOrWhiteSpace(options.Value.ConnectionString)
            ? throw new InvalidOperationException("CrmSync:ConnectionString is not configured.")
            : options.Value.ConnectionString;

    [GeneratedRegex(@"\b(INSERT|UPDATE|DELETE|MERGE|EXEC|EXECUTE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|DENY|INTO|BACKUP|RESTORE|DBCC|SHUTDOWN|OPENROWSET|OPENQUERY)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex WriteKeyword();
}

public sealed class CrmSyncOptions
{
    public const string Section = "CrmSync";

    /// <summary>The CRM database (read-only account in production). Empty: syncing is unavailable.</summary>
    public string ConnectionString { get; set; } = string.Empty;

    /// <summary>The company (tenant code) the CRM's data belongs to in the new system.</summary>
    public string Company { get; set; } = string.Empty;

    /// <summary>Minutes between automatic incremental runs; 0 = only when started by hand.</summary>
    public int IntervalMinutes { get; set; }

    public int PageSize { get; set; } = 1000;

    public int CommandTimeoutSeconds { get; set; } = 120;

    /// <summary>
    /// Entities copied only from a creation date (CRM <c>createdon</c>), e.g. <c>"systemuser": "2025-01-01"</c>.
    /// Older records are never read, and any already in staging are removed.
    /// </summary>
    public Dictionary<string, DateTime> CreatedFrom { get; set; } = new(StringComparer.Ordinal);

    public DateTime? CreatedFromFor(string entity) =>
        CreatedFrom.TryGetValue(entity, out var date) ? DateTime.SpecifyKind(date.Date, DateTimeKind.Utc) : null;
}
