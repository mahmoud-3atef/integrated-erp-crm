using System.Text.Json;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Organization.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.Organization;

[Collection(DatabaseTestGroup.Name)]
public sealed class AuditTests(TestDatabase database)
{
    [SkippableFact]
    public async Task Creating_a_record_writes_an_audit_entry_with_user_tenant_and_values()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");

        Guid tenant;
        using (var scope = database.Scope(system: true))
        {
            tenant = (await scope.ServiceProvider.GetRequiredService<OrganizationService>()
                .CreateTenantAsync($"t-{Guid.NewGuid():N}"[..20], "شركة", "Company", default)).Value.Id;
        }

        Guid entityId;
        using (var scope = database.Scope(tenant, user: "mahmoud"))
        {
            entityId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>()
                .CreateLegalEntityAsync("CP07", "كير برو 07", "Care-Pro 07", "7070707070", null, default)).Value.Id;
        }

        using (var scope = database.Scope(tenant))
        {
            var db = scope.ServiceProvider.GetRequiredService<OrganizationDbContext>();
            var entry = await db.AuditLog.SingleAsync(a => a.EntityId == entityId.ToString());

            Assert.Equal("LegalEntity", entry.EntityType);
            Assert.Equal("Added", entry.Action);
            Assert.Equal("mahmoud", entry.UserName);
            Assert.Equal(tenant, entry.TenantId);
            Assert.True(entry.OccurredAt > DateTimeOffset.UtcNow.AddMinutes(-5));

            using var changes = JsonDocument.Parse(entry.Changes);
            Assert.Equal("Care-Pro 07", changes.RootElement.GetProperty("NameEn").GetProperty("new").GetString());
            Assert.Equal(tenant.ToString(), changes.RootElement.GetProperty("TenantId").GetProperty("new").GetString());
        }
    }

    [SkippableFact]
    public async Task Another_tenant_cannot_read_the_audit_log()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");

        Guid owner, other;
        using (var scope = database.Scope(system: true))
        {
            var service = scope.ServiceProvider.GetRequiredService<OrganizationService>();
            owner = (await service.CreateTenantAsync($"o-{Guid.NewGuid():N}"[..20], "مالك", "Owner", default)).Value.Id;
            other = (await service.CreateTenantAsync($"x-{Guid.NewGuid():N}"[..20], "آخر", "Other", default)).Value.Id;
        }

        using (var scope = database.Scope(owner))
        {
            await scope.ServiceProvider.GetRequiredService<OrganizationService>()
                .CreateLegalEntityAsync("OWN", "خاص", "Own", "1111111111", null, default);
        }

        using (var scope = database.Scope(other))
        {
            var db = scope.ServiceProvider.GetRequiredService<OrganizationDbContext>();
            Assert.Equal(0, await db.AuditLog.CountAsync(a => a.TenantId == owner));
        }
    }
}
