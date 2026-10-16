using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Organization.Contracts;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.Organization;

[Collection(DatabaseTestGroup.Name)]
public sealed class ArabicTextTests(TestDatabase database)
{
    // Guards against non-Unicode columns or parameters: Arabic would silently come back as "???".
    [SkippableFact]
    public async Task Arabic_names_round_trip_through_the_database()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");

        var code = $"ar-{Guid.NewGuid():N}"[..20];
        using (var scope = database.Scope(system: true))
        {
            Assert.True((await scope.ServiceProvider.GetRequiredService<OrganizationService>()
                .CreateTenantAsync(code, "كير برو للخدمات", "Care-Pro Services", default)).IsSuccess);
        }

        using (var scope = database.Scope(system: true))
        {
            var tenant = await scope.ServiceProvider.GetRequiredService<ITenantDirectory>().FindByCodeAsync(code, default);
            Assert.Equal("كير برو للخدمات", tenant?.NameAr);
        }
    }
}
