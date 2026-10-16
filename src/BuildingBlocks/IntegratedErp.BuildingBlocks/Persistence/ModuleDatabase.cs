using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.BuildingBlocks.Persistence;

/// <summary>A module's database schema, as seen by the migration runner.</summary>
public interface IModuleDatabase
{
    string Schema { get; }

    Task<IReadOnlyList<string>> GetPendingMigrationsAsync(CancellationToken cancellationToken);

    Task MigrateAsync(CancellationToken cancellationToken);
}

internal sealed class ModuleDatabase<TContext>(TContext context) : IModuleDatabase
    where TContext : ModuleDbContext
{
    public string Schema => context.Schema;

    public async Task<IReadOnlyList<string>> GetPendingMigrationsAsync(CancellationToken cancellationToken) =>
        (await context.Database.GetPendingMigrationsAsync(cancellationToken).ConfigureAwait(false)).ToList();

    public Task MigrateAsync(CancellationToken cancellationToken) => context.Database.MigrateAsync(cancellationToken);
}
