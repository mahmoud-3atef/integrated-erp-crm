using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Organization.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.Organization;

[Collection(DatabaseTestGroup.Name)]
public sealed class NumberingAndOutboxTests(TestDatabase database)
{
    private sealed record TestHappened(string What) : IntegrationEvent;

    private async Task<Guid> NewTenantAsync()
    {
        using var scope = database.Scope(system: true);
        return (await scope.ServiceProvider.GetRequiredService<OrganizationService>()
            .CreateTenantAsync($"n-{Guid.NewGuid():N}"[..20], "ترقيم", "Numbering", default)).Value.Id;
    }

    private async Task<long> AllocateAsync(Guid tenant, NumberRequest request, bool commit = true)
    {
        using var scope = database.Scope(tenant);
        var db = scope.ServiceProvider.GetRequiredService<OrganizationDbContext>();
        var numbering = scope.ServiceProvider.GetRequiredService<NumberSequenceService>();

        await using var transaction = await db.Database.BeginTransactionAsync();
        var value = await numbering.NextAsync(db, request, default);
        if (commit)
        {
            await transaction.CommitAsync();
        }
        else
        {
            await transaction.RollbackAsync();
        }

        return value;
    }

    [SkippableFact]
    public async Task Numbers_are_sequential_per_scope_and_period()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenant = await NewTenantAsync();

        Assert.Equal(1, await AllocateAsync(tenant, new NumberRequest("invoice", "CP05", 2026)));
        Assert.Equal(2, await AllocateAsync(tenant, new NumberRequest("invoice", "CP05", 2026)));
        Assert.Equal(1, await AllocateAsync(tenant, new NumberRequest("invoice", "CP07", 2026)));
        Assert.Equal(1, await AllocateAsync(tenant, new NumberRequest("invoice", "CP05", 2027)));
    }

    [SkippableFact]
    public async Task A_rolled_back_document_gives_its_number_back()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenant = await NewTenantAsync();
        var request = new NumberRequest("invoice", "CP05", 2026);

        Assert.Equal(1, await AllocateAsync(tenant, request));
        Assert.Equal(2, await AllocateAsync(tenant, request, commit: false));
        Assert.Equal(2, await AllocateAsync(tenant, request));
    }

    [SkippableFact]
    public async Task Concurrent_allocations_have_no_gaps_and_no_duplicates()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenant = await NewTenantAsync();
        var request = new NumberRequest("delivery_order");

        var numbers = await Task.WhenAll(Enumerable.Range(0, 25).Select(_ => AllocateAsync(tenant, request)));

        Assert.Equal(Enumerable.Range(1, 25).Select(i => (long)i), numbers.Order());
    }

    [SkippableFact]
    public async Task Each_tenant_has_its_own_counters()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var a = await NewTenantAsync();
        var b = await NewTenantAsync();

        Assert.Equal(1, await AllocateAsync(a, new NumberRequest("invoice")));
        Assert.Equal(2, await AllocateAsync(a, new NumberRequest("invoice")));
        Assert.Equal(1, await AllocateAsync(b, new NumberRequest("invoice")));
    }

    [SkippableFact]
    public async Task Allocation_outside_a_transaction_is_refused()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenant = await NewTenantAsync();

        using var scope = database.Scope(tenant);
        var db = scope.ServiceProvider.GetRequiredService<OrganizationDbContext>();
        var numbering = scope.ServiceProvider.GetRequiredService<NumberSequenceService>();

        await Assert.ThrowsAsync<InvalidOperationException>(() => numbering.NextAsync(db, new NumberRequest("invoice"), default));
    }

    [SkippableFact]
    public async Task Integration_events_are_stored_with_the_change_and_not_without_it()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenant = await NewTenantAsync();
        var saved = new TestHappened("saved");
        var discarded = new TestHappened("discarded");

        using (var scope = database.Scope(tenant))
        {
            var db = scope.ServiceProvider.GetRequiredService<OrganizationDbContext>();
            db.AddIntegrationEvent(saved);
            await db.SaveChangesAsync();

            await using var transaction = await db.Database.BeginTransactionAsync();
            db.AddIntegrationEvent(discarded);
            await db.SaveChangesAsync();
            await transaction.RollbackAsync();
        }

        using (var scope = database.Scope(tenant))
        {
            var db = scope.ServiceProvider.GetRequiredService<OrganizationDbContext>();
            var message = await db.Outbox.SingleAsync(m => m.Id == saved.EventId);
            Assert.Equal(tenant, message.TenantId);
            Assert.Null(message.ProcessedAt);
            Assert.Contains("\"What\":\"saved\"", message.Payload, StringComparison.Ordinal);
            Assert.False(await db.Outbox.AnyAsync(m => m.Id == discarded.EventId));
        }
    }
}
