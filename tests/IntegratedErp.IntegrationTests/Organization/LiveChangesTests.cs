using IntegratedErp.BuildingBlocks.Live;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Organization.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.Organization;

[Collection(DatabaseTestGroup.Name)]
public sealed class LiveChangesTests(TestDatabase database)
{
    [SkippableFact]
    public async Task A_saved_change_is_announced_to_its_company_once_final_and_never_when_rolled_back()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenant, other;
        using (var scope = database.Scope(system: true))
        {
            var organization = scope.ServiceProvider.GetRequiredService<OrganizationService>();
            tenant = (await organization.CreateTenantAsync($"lv-{Guid.NewGuid():N}"[..20], "شركة", "Company", default)).Value.Id;
            other = (await organization.CreateTenantAsync($"lv-{Guid.NewGuid():N}"[..20], "شركة أخرى", "Other", default)).Value.Id;
        }

        var live = database.Services.GetRequiredService<LiveChanges>();
        using var mine = live.Subscribe(tenant);
        using var theirs = live.Subscribe(other);

        // Saved on its own: announced at once, with the module's schema, to the company only.
        using (var scope = database.Scope(tenant))
        {
            Assert.True((await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateLegalEntityAsync("LV01", "كيان", "Entity", "1010101010", null, default)).IsSuccess);
        }

        Assert.True(mine.Reader.TryRead(out var area));
        Assert.Equal("organization", area);
        Assert.False(theirs.Reader.TryRead(out _));

        // Inside a transaction: only when it commits.
        using (var scope = database.Scope(tenant))
        {
            var db = scope.ServiceProvider.GetRequiredService<OrganizationDbContext>();
            await using var transaction = await db.Database.BeginTransactionAsync();
            Assert.True((await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateLegalEntityAsync("LV02", "كيان 2", "Entity 2", "2020202020", null, default)).IsSuccess);
            Assert.False(mine.Reader.TryRead(out _));
            await transaction.CommitAsync();
        }

        Assert.True(mine.Reader.TryRead(out area));
        Assert.Equal("organization", area);

        // Rolled back: never.
        using (var scope = database.Scope(tenant))
        {
            var db = scope.ServiceProvider.GetRequiredService<OrganizationDbContext>();
            await using var transaction = await db.Database.BeginTransactionAsync();
            Assert.True((await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateLegalEntityAsync("LV03", "كيان 3", "Entity 3", "3030303030", null, default)).IsSuccess);
            await transaction.RollbackAsync();
        }

        Assert.False(mine.Reader.TryRead(out _));
    }
}
