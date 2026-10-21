using IntegratedErp.Modules.Expenses.Application;
using IntegratedErp.Modules.Expenses.Contracts;
using IntegratedErp.Modules.Organization.Application.Organization;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.Workforce;

[Collection(DatabaseTestGroup.Name)]
public sealed class ExpenseTests(TestDatabase database)
{
    [SkippableFact]
    public async Task Expenses_are_numbered_checked_listed_with_their_totals_spread_over_their_months_and_cancelled_with_a_reason()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"ex-{Guid.NewGuid():N}"[..16], "شركة المصاريف", "Expense Co", default)).Value.Id;
        }

        using (var scope = database.Scope(tenantId, user: "finance"))
        {
            var service = scope.ServiceProvider.GetRequiredService<ExpenseService>();
            var on = new DateOnly(2026, 9, 10);
            Assert.True((await service.CreateAsync(new ExpenseInput(on, "NOT_A_CATEGORY", null, null, 100, 0, 1, null, null, null), default)).IsFailure);
            Assert.True((await service.CreateAsync(new ExpenseInput(on, "TRAVEL_TICKET", null, null, 100, 150, 1, null, null, null), default)).IsFailure);
            Assert.True((await service.CreateAsync(new ExpenseInput(on, "TRAVEL_TICKET", Guid.NewGuid(), null, 100, 0, 1, null, null, null), default)).IsFailure);

            var renewal = await service.CreateAsync(new ExpenseInput(new DateOnly(2026, 4, 1), "iqama_renewal", null, null, 1200, 0, 12, "الجوازات", null, null), default);
            var general = await service.CreateAsync(new ExpenseInput(on, "OTHER", null, null, 300, 45, 1, null, "R-1", "ضيافة"), default);
            Assert.True(renewal.IsSuccess && general.IsSuccess);

            var list = await service.ListAsync(new ExpenseFilter(null, null, null, null, null, null, null, false, 1, 50), default);
            Assert.Equal((2, 1500m, 45m), (list.Total, list.Amount, list.Vat));
            Assert.All(list.Items, e => Assert.StartsWith("EXP-2026-", e.ExpenseNo, StringComparison.Ordinal));

            var september = await scope.ServiceProvider.GetRequiredService<IExpenseLedger>().SharesAsync(new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30), default);
            Assert.Equal(400m, september.Sum(s => s.Amount));

            Assert.True((await service.CancelAsync(general.Value, " ", default)).IsFailure);
            Assert.True((await service.CancelAsync(general.Value, "سُجّل مرتين", default)).IsSuccess);
            Assert.Equal(1, (await service.ListAsync(new ExpenseFilter(null, null, null, null, null, null, null, false, 1, 50), default)).Total);
            Assert.Equal(100m, (await scope.ServiceProvider.GetRequiredService<IExpenseLedger>().SharesAsync(new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30), default)).Sum(s => s.Amount));
        }
    }
}
