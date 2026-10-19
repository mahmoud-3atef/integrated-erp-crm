using IntegratedErp.Modules.Billing.Contracts;
using IntegratedErp.Modules.Payroll.Application;
using IntegratedErp.Modules.Workforce.Contracts;

namespace IntegratedErp.UnitTests.Payroll;

public sealed class PayrollCalculatorTests
{
    private static readonly DateOnly From = new(2026, 9, 1);
    private static readonly DateOnly To = new(2026, 9, 30);
    private static readonly Guid WorkerId = Guid.NewGuid();

    [Fact]
    public void A_worker_moved_between_two_projects_is_paid_once_with_the_project_of_most_days()
    {
        var a = Line(Guid.NewGuid(), "مشروع أ", 1, 10, 10, 2000, overtime: 50);
        var b = Line(Guid.NewGuid(), "مشروع ب", 11, 30, 20, 2000, deductions: 100);
        var (v, sources) = PayrollCalculator.Worker([a, b], new WorkerSalary(WorkerId, "Care-Pro - 05", 1500, 300, 100, 100, 0, 2000), null, From, To);

        Assert.Equal(("مشروع ب", 2, 30m, 2), (v.ProjectName, v.Projects, v.PaidDays, sources.Count));
        Assert.Equal(a.WorkerNet + b.WorkerNet, v.Net);
        Assert.Equal(v.Net, PayrollCalculator.NetOf(v));
        Assert.Contains("multi_project", v.Notes);
        Assert.DoesNotContain("salary_split", v.Notes);
    }

    [Fact]
    public void Without_the_salary_elements_the_whole_salary_is_basic_and_the_line_is_marked()
    {
        var line = Line(Guid.NewGuid(), "مشروع أ", 10, 30, 21, 1500);
        var (v, _) = PayrollCalculator.Worker([line], null, null, From, To);

        Assert.Equal((1050m, 0m, 1050m), (v.Base, v.Housing, v.Net));
        Assert.Contains("salary_split", v.Notes);
        Assert.Contains("joined", v.Notes);
    }

    private static PayrollTimesheetLine Line(Guid project, string name, int fromDay, int toDay, decimal days, decimal salary, decimal overtime = 0, decimal deductions = 0)
    {
        var due = Math.Round(days / 30 * salary, 2);
        return new PayrollTimesheetLine(
            Guid.NewGuid(), Guid.NewGuid(), "TS-2026-00001", "Approved", null, project, name, WorkerId, "BSS0001", "WORKER", null,
            new DateOnly(2026, 9, fromDay), new DateOnly(2026, 9, toDay), days, 30, salary, salary * 0.75m, 0, 0, overtime, 0, deductions, 0, 0, 0,
            due, 0, due + overtime - deductions);
    }
}
