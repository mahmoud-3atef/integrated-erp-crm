using IntegratedErp.Modules.Reports.Application;

namespace IntegratedErp.UnitTests.Reports;

public sealed class TaskRulesTests
{
    private static readonly DateOnly Today = new(2026, 10, 22);

    private static LegacyTask Task(DateOnly? created, DateOnly? due, bool completed = false, DateOnly? modified = null) =>
        new(Guid.NewGuid(), "wait paid", "FinanceInvoice", "invoice", "INV00681", created, modified, due, completed, false);

    [Fact]
    public void A_task_is_late_after_its_due_day_or_after_three_days_open_without_one()
    {
        Assert.True(TaskRules.Late(Task(new(2026, 10, 1), new(2026, 10, 21)), Today));
        Assert.False(TaskRules.Late(Task(new(2026, 10, 1), Today), Today));
        Assert.False(TaskRules.Late(Task(new(2026, 10, 19), null), Today));
        Assert.True(TaskRules.Late(Task(new(2026, 10, 18), null), Today));
        Assert.Equal(("lateNoDue", 4), TaskRules.Timing(Task(new(2026, 10, 18), null), Today));
        Assert.Equal(("late", 1), TaskRules.Timing(Task(new(2026, 10, 1), new(2026, 10, 21)), Today));
    }

    [Fact]
    public void A_completed_task_is_on_time_when_done_by_its_due_day()
    {
        Assert.True(TaskRules.OnTime(Task(new(2026, 10, 1), new(2026, 10, 5), completed: true, modified: new(2026, 10, 5))));
        var late = Task(new(2026, 10, 1), new(2026, 10, 5), completed: true, modified: new(2026, 10, 8));
        Assert.False(TaskRules.OnTime(late));
        Assert.Equal(("doneLate", 3), TaskRules.Timing(late, Today));
        Assert.False(TaskRules.Late(late, Today));
    }
}
