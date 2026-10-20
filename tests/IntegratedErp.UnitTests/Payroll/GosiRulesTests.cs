using IntegratedErp.Modules.Billing.Contracts;
using IntegratedErp.Modules.Payroll.Application;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Workforce.Contracts;

namespace IntegratedErp.UnitTests.Payroll;

public sealed class GosiRulesTests
{
    private static readonly StaffGosi Legacy = new(GosiCategory.SaudiLegacy, 9.75m, 11.75m, 1500, 45000);
    private static readonly StaffGosi NonSaudi = new(GosiCategory.NonSaudi, 0, 2, 400, 45000);

    [Theory]
    [InlineData("SAU", "2020-01-01", GosiCategory.SaudiLegacy)]
    [InlineData("SA", "2024-07-02", GosiCategory.SaudiLegacy)]
    [InlineData("SAU", "2024-07-03", GosiCategory.SaudiNew)]
    [InlineData("SAU", null, GosiCategory.SaudiLegacy)]
    [InlineData("EGY", "2025-01-01", GosiCategory.NonSaudi)]
    [InlineData(null, null, GosiCategory.NonSaudi)]
    public void The_category_follows_the_nationality_and_the_day_the_person_joined_GOSI(string? nationality, string? since, GosiCategory expected) =>
        Assert.Equal(expected, GosiRules.CategoryOf(nationality, since is null ? null : DateOnly.Parse(since, System.Globalization.CultureInfo.InvariantCulture)));

    [Fact]
    public void The_contributory_wage_is_kept_within_the_floor_and_the_ceiling_and_prorated_by_the_days()
    {
        Assert.Equal((1500m, 146.25m, 176.25m), GosiRules.Contribution(Legacy, 1000, 30));
        Assert.Equal((45000m, 4387.5m, 5287.5m), GosiRules.Contribution(Legacy, 60000, 31));
        Assert.Equal((4000m, 390m, 470m), GosiRules.Contribution(Legacy, 8000, 15));
        Assert.Equal((8000m, 0m, 160m), GosiRules.Contribution(NonSaudi, 8000, 30));
    }

    [Fact]
    public void A_Saudi_workers_share_comes_off_the_net_and_a_non_Saudi_costs_the_company_two_percent_only()
    {
        var rates = new Dictionary<GosiCategory, StaffGosi> { [GosiCategory.SaudiLegacy] = Legacy, [GosiCategory.NonSaudi] = NonSaudi };
        var salary = new WorkerSalary(Guid.NewGuid(), "Care-Pro - 05", 3000, 1000, 0, 0, 0, 4000);

        var (saudi, _) = PayrollCalculator.Worker([Line(4000)], salary, Card("SAU", new DateOnly(2020, 1, 1)), From, To, rates);
        Assert.Equal(("SaudiLegacy", 4000m, 390m, 470m), (saudi.GosiCategory, saudi.GosiBase, saudi.GosiEmployee, saudi.GosiEmployer));
        Assert.Equal(4000m - 390m, saudi.Net);
        Assert.Equal(saudi.Net, PayrollCalculator.NetOf(saudi));

        // The wage registered with GOSI is used in place of the basic and housing.
        var (registered, _) = PayrollCalculator.Worker([Line(4000)], salary, Card("SAU", new DateOnly(2020, 1, 1)), From, To, rates, 5000);
        Assert.Equal((5000m, 487.5m), (registered.GosiBase, registered.GosiEmployee));

        var (other, _) = PayrollCalculator.Worker([Line(4000)], salary, Card("PAK", new DateOnly(2020, 1, 1)), From, To, rates);
        Assert.Equal(("NonSaudi", 0m, 80m, 4000m), (other.GosiCategory, other.GosiEmployee, other.GosiEmployer, other.Net));
    }

    private static readonly DateOnly From = new(2026, 9, 1);
    private static readonly DateOnly To = new(2026, 9, 30);
    private static readonly Guid WorkerId = Guid.NewGuid();

    private static WorkerCard Card(string nationality, DateOnly joined) => new(
        WorkerId, Guid.NewGuid(), "BSS0001", "عامل", "Project", false, "على رأس العمل", "On the job", "WORKER", null, null,
        nationality, null, null, null, null, 4000, null, null, joined);

    private static PayrollTimesheetLine Line(decimal salary) => new(
        Guid.NewGuid(), Guid.NewGuid(), "TS-2026-00001", "Approved", null, Guid.NewGuid(), "مشروع أ", WorkerId, "BSS0001", "WORKER", null,
        From, To, 30, 30, salary, salary * 0.75m, 0, 0, 0, 0, 0, 0, 0, 0, salary, 0, salary);
}
