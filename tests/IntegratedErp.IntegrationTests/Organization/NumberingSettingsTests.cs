using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.Modules.Commercial.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Organization.Application.Settings;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.Organization;

[Collection(DatabaseTestGroup.Name)]
public sealed class NumberingSettingsTests(TestDatabase database)
{
    [SkippableFact]
    public async Task The_company_sets_the_pattern_reset_and_start_of_a_document_number()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenant;
        using (var scope = database.Scope(system: true))
        {
            tenant = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"ns-{Guid.NewGuid():N}"[..20], "ترقيم", "Numbering", default)).Value.Id;
        }

        var day = new DateOnly(2026, 10, 17);

        // By default: the module's pattern.
        Assert.Equal("PKG-00001", await NextAsync(tenant, "price_package", day));

        using (var scope = database.Scope(tenant))
        {
            var service = scope.ServiceProvider.GetRequiredService<NumberingService>();
            var row = (await service.ListAsync(default)).Single(n => n.Key == "price_package");
            Assert.Equal(("PKG-{N:5}", 2L, "PKG-00002", false), (row.Pattern, row.NextValue, row.NextNumber, row.Customized));
            Assert.Contains(await service.ListAsync(default), n => n.Key == "worker" && n.InUse); // new workers are added here since 2026-10-25

            // A yearly counter needs the year in the pattern, or numbers would repeat.
            Assert.Equal("validation.numbering_pattern_year", (await service.UpdateAsync("price_package", new NumberingInput("PK-{N:4}", NumberReset.Yearly, 1), default)).Error.Code);
            Assert.Equal("validation.numbering_pattern_invalid", (await service.UpdateAsync("price_package", new NumberingInput("PK-{X}-{N}", NumberReset.Never, 1), default)).Error.Code);

            // Continue an old serial: from 2869.
            Assert.True((await service.UpdateAsync("price_package", new NumberingInput("BSS{N:6}", NumberReset.Never, 2869), default)).IsSuccess);
        }

        Assert.Equal("BSS002869", await NextAsync(tenant, "price_package", day));
        Assert.Equal("BSS002870", await NextAsync(tenant, "price_package", day));

        using (var scope = database.Scope(tenant))
        {
            var service = scope.ServiceProvider.GetRequiredService<NumberingService>();

            // A start below what was issued never repeats a number.
            Assert.True((await service.UpdateAsync("price_package", new NumberingInput("BSS{N:6}", NumberReset.Never, 10), default)).IsSuccess);
            Assert.Equal("BSS002871", (await service.ListAsync(default)).Single(n => n.Key == "price_package").NextNumber);

            // Yearly, with the year: a counter per year.
            Assert.True((await service.UpdateAsync("price_package", new NumberingInput("PK-{YY}-{N:4}", NumberReset.Yearly, 1), default)).IsSuccess);
        }

        Assert.Equal("PK-26-0001", await NextAsync(tenant, "price_package", day));
        Assert.Equal("PK-27-0001", await NextAsync(tenant, "price_package", new DateOnly(2027, 1, 2)));
    }

    private async Task<string> NextAsync(Guid tenant, string key, DateOnly day)
    {
        using var scope = database.Scope(tenant);
        var db = scope.ServiceProvider.GetRequiredService<CommercialDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync();
        var number = await scope.ServiceProvider.GetRequiredService<NumberSequenceService>().NextNumberAsync(db, key, day, default);
        await transaction.CommitAsync();
        return number;
    }
}
