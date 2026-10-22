using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workflow.Application;

/// <summary>
/// The tables of the system that processes can reach (docs/02-target-architecture/17 §3.1): every module's
/// <see cref="IEntitySource"/>, and the related tables of a record through their lookups (N:1), up to three levels.
/// </summary>
internal sealed class EntityCatalog(IEnumerable<IEntitySource> sources)
{
    /// <summary>How far related tables reach from a record (order → project → customer).</summary>
    public const int MaxDepth = 3;

    /// <summary>The separator of a related table's path of lookups ("project_id/customer_id").</summary>
    public const char PathSeparator = '/';

    private Dictionary<string, (IEntitySource Source, EntityDefinition Definition)>? _entities;

    private Dictionary<string, (IEntitySource Source, EntityDefinition Definition)> Entities =>
        _entities ??= sources.SelectMany(s => s.Entities.Select(e => (Source: s, Definition: e)))
            .GroupBy(x => x.Definition.Key, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

    public IReadOnlyList<EntityDefinition> All => Entities.Values.Select(e => e.Definition).OrderBy(e => e.Key, StringComparer.Ordinal).ToList();

    public EntityDefinition? Find(string? key) => key is not null && Entities.TryGetValue(key, out var e) ? e.Definition : null;

    /// <summary>
    /// The related tables of a table: each lookup chain up to <see cref="MaxDepth"/> (the depth bounds it — a chain may
    /// reach the same table again as another record, e.g. a leave's employee's department's manager).
    /// </summary>
    public IReadOnlyList<(string Path, string NameAr, string NameEn, EntityDefinition Target)> RelatedOf(string entity)
    {
        var found = new List<(string, string, string, EntityDefinition)>();
        void Walk(EntityDefinition from, string path, string ar, string en, int depth)
        {
            if (depth >= MaxDepth)
            {
                return;
            }

            foreach (var lookup in from.Lookups)
            {
                if (Find(lookup.Target) is not { } target)
                {
                    continue;
                }

                var key = path.Length == 0 ? lookup.FieldKey : $"{path}{PathSeparator}{lookup.FieldKey}";
                var nameAr = ar.Length == 0 ? lookup.NameAr : $"{ar} › {lookup.NameAr}";
                var nameEn = en.Length == 0 ? lookup.NameEn : $"{en} › {lookup.NameEn}";
                found.Add((key, nameAr, nameEn, target));
                Walk(target, key, nameAr, nameEn, depth + 1);
            }
        }

        if (Find(entity) is { } root)
        {
            Walk(root, string.Empty, string.Empty, string.Empty, 0);
        }

        return found;
    }

    /// <summary>The table at the end of a lookup path from a table (null: the table itself), or null when the path is unknown.</summary>
    public EntityDefinition? TableAt(string entity, string? path)
    {
        var current = Find(entity);
        foreach (var segment in (path ?? string.Empty).Split(PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            current = current?.Lookups.FirstOrDefault(l => l.FieldKey == segment) is { } lookup ? Find(lookup.Target) : null;
        }

        return current;
    }

    /// <summary>The different values a text field holds in its table (to pick one in a condition).</summary>
    public Task<IReadOnlyList<string>> ValuesAsync(string entity, string fieldKey, CancellationToken cancellationToken) =>
        Entities.TryGetValue(entity, out var e)
            ? e.Source.ValuesAsync(entity, fieldKey, 300, cancellationToken)
            : Task.FromResult<IReadOnlyList<string>>([]);

    public Task<IReadOnlyDictionary<string, string?>?> ReadAsync(string entity, Guid id, CancellationToken cancellationToken) =>
        Entities.TryGetValue(entity, out var e) ? e.Source.ReadAsync(entity, id, cancellationToken) : Task.FromResult<IReadOnlyDictionary<string, string?>?>(null);

    public Task<Result> ApplyAsync(string entity, Guid id, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Entities.TryGetValue(entity, out var e)
            ? e.Source.ApplyAsync(entity, id, changes, cancellationToken)
            : Task.FromResult(Result.Failure(Error.Validation("entity_unknown", "Unknown table.")));

    /// <summary>The record at the end of a lookup path from a record (its table and id), or null when a link is empty.</summary>
    public async Task<(string Entity, Guid Id)?> ResolveAsync(string entity, Guid id, string path, CancellationToken cancellationToken)
    {
        var (current, currentId) = (entity, id);
        foreach (var segment in path.Split(PathSeparator))
        {
            var definition = Find(current);
            var lookup = definition?.Lookups.FirstOrDefault(l => l.FieldKey == segment);
            if (lookup is null || await ReadAsync(current, currentId, cancellationToken).ConfigureAwait(false) is not { } values
                || !Guid.TryParse(values.GetValueOrDefault(segment), out var next))
            {
                return null;
            }

            (current, currentId) = (lookup.Target, next);
        }

        return (current, currentId);
    }
}

/// <summary>
/// A screen's adapter seen through the entity catalog: the screen's own fields and related tables, and every other
/// field of its table and of its related tables (through their lookups). The screen's own declarations are read and
/// applied by its adapter; the catalog's by the owning modules' sources.
/// </summary>
internal sealed class CatalogAdapter(IApprovalRecordAdapter inner, EntityCatalog catalog) : IApprovalRecordAdapter
{
    private ApprovalScreen? _screen;

    public IApprovalRecordAdapter Inner => inner;

    // The screen's table: the one it names, else the one keyed by its code.
    private EntityDefinition? Entity => catalog.Find(inner.Screen.Entity ?? inner.Screen.Code);

    public ApprovalScreen Screen => _screen ??= Effective();

    private ApprovalScreen Effective()
    {
        var own = inner.Screen;
        if (Entity is not { } entity)
        {
            return own;
        }

        var fields = own.Fields.ToList();
        var keys = fields.Select(f => f.Key).ToHashSet(StringComparer.Ordinal);
        fields.AddRange(entity.Fields.Where(f => !keys.Contains(f.Key)));
        var relations = own.RelatedTables.ToList();
        var relationKeys = relations.Select(r => r.Key).ToHashSet(StringComparer.Ordinal);
        relations.AddRange(catalog.RelatedOf(entity.Key)
            .Where(r => !relationKeys.Contains(r.Path))
            .Select(r => new RecordRelation(r.Path, r.NameAr, r.NameEn, r.Target.Fields)));
        return own with { Fields = fields, Relations = relations };
    }

    private bool IsOwnRelation(string relation) => inner.Screen.RelatedTables.Any(r => r.Key == relation);

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        if (await inner.ReadAsync(recordId, cancellationToken).ConfigureAwait(false) is not { } own)
        {
            return null;
        }

        if (Entity is not { } entity || await catalog.ReadAsync(entity.Key, recordId, cancellationToken).ConfigureAwait(false) is not { } more)
        {
            return own;
        }

        var values = new Dictionary<string, string?>(own, StringComparer.Ordinal);
        foreach (var (key, value) in more)
        {
            values.TryAdd(key, value);
        }

        return values;
    }

    public async Task<IReadOnlyDictionary<string, string?>?> ReadRelatedAsync(Guid recordId, string relation, CancellationToken cancellationToken)
    {
        if (IsOwnRelation(relation) || Entity is not { } entity)
        {
            return await inner.ReadRelatedAsync(recordId, relation, cancellationToken).ConfigureAwait(false);
        }

        return await catalog.ResolveAsync(entity.Key, recordId, relation, cancellationToken).ConfigureAwait(false) is { } target
            ? await catalog.ReadAsync(target.Entity, target.Id, cancellationToken).ConfigureAwait(false)
            : null;
    }

    public async Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(changes);
        if (relation is not null && (IsOwnRelation(relation) || Entity is null))
        {
            return await inner.ApplyAsync(recordId, relation, changes, cancellationToken).ConfigureAwait(false);
        }

        if (relation is not null)
        {
            return await catalog.ResolveAsync(Entity!.Key, recordId, relation, cancellationToken).ConfigureAwait(false) is { } target
                ? await catalog.ApplyAsync(target.Entity, target.Id, changes, cancellationToken).ConfigureAwait(false)
                : Result.Failure(Error.Validation("entity_related_missing", "The related record is not set."));
        }

        // The record itself: the screen's own fields through its adapter, the table's other fields through its module.
        var ownKeys = inner.Screen.Fields.Select(f => f.Key).ToHashSet(StringComparer.Ordinal);
        var own = changes.Where(c => ownKeys.Contains(c.Key)).ToDictionary(c => c.Key, c => c.Value, StringComparer.Ordinal);
        var more = changes.Where(c => !ownKeys.Contains(c.Key)).ToDictionary(c => c.Key, c => c.Value, StringComparer.Ordinal);
        if (own.Count > 0 && await inner.ApplyAsync(recordId, null, own, cancellationToken).ConfigureAwait(false) is { IsFailure: true } failed)
        {
            return failed;
        }

        return more.Count == 0 || Entity is null
            ? Result.Success()
            : await catalog.ApplyAsync(Entity.Key, recordId, more, cancellationToken).ConfigureAwait(false);
    }

    public Task<RecordActionResult> RunAsync(Guid recordId, string action, CancellationToken cancellationToken) => inner.RunAsync(recordId, action, cancellationToken);

    public Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken) => inner.StartingAsync(recordId, cancellationToken);

    public Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken) => inner.EndedAsync(recordId, end, comment, cancellationToken);
}
