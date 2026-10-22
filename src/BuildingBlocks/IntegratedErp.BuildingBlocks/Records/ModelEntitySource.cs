using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.BuildingBlocks.Records;

/// <summary>
/// A module's tables in the entity catalog, read from its own DbContext (so its tenant isolation applies). A module
/// derives from it, lists its <see cref="EntityModel{TEntity}"/>s, and may add computed values
/// (<see cref="EnrichAsync"/>) or apply updatable fields through its rules (<see cref="ApplyAsync"/>).
/// </summary>
public abstract class ModelEntitySource(DbContext db, IReadOnlyList<IEntityModel> models) : IEntitySource
{
    private IReadOnlyList<EntityDefinition>? _entities;

    public IReadOnlyList<EntityDefinition> Entities => _entities ??= models.Select(m => m.Describe(db.Model)).ToList();

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(string entity, Guid id, CancellationToken cancellationToken)
    {
        if (models.FirstOrDefault(m => m.Key == entity) is not { } model
            || await model.ReadAsync(db, id, cancellationToken).ConfigureAwait(false) is not { } values)
        {
            return null;
        }

        var all = new Dictionary<string, string?>(values, StringComparer.Ordinal);
        await EnrichAsync(entity, all, cancellationToken).ConfigureAwait(false);
        return all;
    }

    public virtual Task<Result> ApplyAsync(string entity, Guid id, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("entity_field_not_settable", "A process cannot change this table.")));

    /// <summary>Adds the computed fields of a record (e.g. the project manager as a user).</summary>
    protected virtual Task EnrichAsync(string entity, Dictionary<string, string?> values, CancellationToken cancellationToken) => Task.CompletedTask;
}
