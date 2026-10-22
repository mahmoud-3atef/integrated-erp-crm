using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workflow.Contracts;

/// <summary>
/// A table of the system as processes see it (docs/02-target-architecture/17 §3.1), like an entity in Dynamics CRM's
/// metadata: every field of it, and its lookups — the fields holding another table's id, through which a process
/// reaches the related record (N:1) in any of its steps.
/// </summary>
/// <param name="Key">The table's key, "module.table" (e.g. "commercial.project").</param>
public sealed record EntityDefinition(string Key, string NameAr, string NameEn, IReadOnlyList<RecordField> Fields, IReadOnlyList<EntityLookup> Lookups);

/// <summary>
/// A lookup of a table: the field <paramref name="FieldKey"/> holds the id of a record of <paramref name="Target"/>
/// (e.g. a transfer order's "project_id" → "commercial.project"), named for the role it plays.
/// </summary>
public sealed record EntityLookup(string FieldKey, string Target, string NameAr, string NameEn);

/// <summary>
/// Implemented by each module for the tables it opens to processes: it describes them (usually from its EF Core model)
/// and reads one record's values (invariant strings, as <see cref="RecordField"/> says). Changing a field goes through
/// the module's own rules: a source changes only the fields it declares updatable, and refuses the others.
/// </summary>
public interface IEntitySource
{
    IReadOnlyList<EntityDefinition> Entities { get; }

    /// <summary>The record's values (lookup fields hold the related record's id); null when it does not exist here.</summary>
    Task<IReadOnlyDictionary<string, string?>?> ReadAsync(string entity, Guid id, CancellationToken cancellationToken);

    /// <summary>The different values a text field holds in the table (at most <paramref name="max"/>, sorted), to pick one in a condition.</summary>
    Task<IReadOnlyList<string>> ValuesAsync(string entity, string fieldKey, int max, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<string>>([]);

    /// <summary>Changes updatable fields of a record through the module's rules (already type-checked by the engine).</summary>
    Task<Result> ApplyAsync(string entity, Guid id, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("entity_field_not_settable", "A process cannot change this table.")));
}
