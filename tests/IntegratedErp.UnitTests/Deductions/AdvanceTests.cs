using IntegratedErp.Modules.Deductions.Domain;

namespace IntegratedErp.UnitTests.Deductions;

public sealed class AdvanceTests
{
    private static Advance Approved(decimal amount, int months, string first)
    {
        var advance = Advance.Create("ADV-2026-00001", Guid.NewGuid(), "منى", "hr", DateTimeOffset.UtcNow);
        Assert.True(advance.Set(amount, months, first, "ظرف", false, 6750, null).IsSuccess);
        advance.Approve(null, DateTimeOffset.UtcNow);
        return advance;
    }

    [Fact]
    public void The_schedule_is_equal_installments_with_the_cents_on_the_last_across_the_year_end()
    {
        var advance = Approved(1000m, 3, "2026-11");
        Assert.Equal([("2026-11", 333.33m), ("2026-12", 333.33m), ("2027-01", 333.34m)], advance.Installments.Select(i => (i.Period, i.Amount)));
        Assert.Equal(1000m, advance.Remaining);
    }

    [Fact]
    public void A_postponed_installment_moves_after_the_last_and_the_remaining_is_unchanged()
    {
        var advance = Approved(900m, 2, "2026-11");
        Assert.True(advance.Disburse(new DateOnly(2026, 10, 20), "Cash", null, "finance").IsSuccess);
        var moved = advance.Postpone(advance.Installments[0].Id, "ظرف").Value;
        Assert.Equal(("2027-01", 450m), (moved.Period, moved.Amount));
        Assert.Equal(InstallmentStatus.Postponed, advance.Installments[0].Status);
        Assert.Equal(900m, advance.Remaining);
        Assert.True(advance.Postpone(advance.Installments[0].Id, "مرة ثانية").IsFailure);
    }

    [Fact]
    public void Only_a_paid_advance_settles_early_and_then_nothing_remains()
    {
        var advance = Approved(600m, 3, "2026-11");
        Assert.True(advance.SettleEarly("سداد").IsFailure);
        Assert.True(advance.Disburse(new DateOnly(2026, 10, 20), "Transfer", "TR-1", "finance").IsSuccess);
        Assert.True(advance.SettleEarly("سداد").IsSuccess);
        Assert.Equal((AdvanceStatus.Settled, 0m), (advance.Status, advance.Remaining));
    }

    [Theory]
    [InlineData("2026-11", true)]
    [InlineData("2024-12", false)]
    [InlineData("2026-13", false)]
    [InlineData("2026/11", false)]
    public void Payroll_months_are_validated(string period, bool valid) => Assert.Equal(valid, Periods.Valid(period));
}
