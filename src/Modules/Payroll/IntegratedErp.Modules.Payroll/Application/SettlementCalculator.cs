using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.Modules.Payroll.Domain;

namespace IntegratedErp.Modules.Payroll.Application;

/// <summary>What a settlement's figures come from (docs/03-migration-plan/18 §3).</summary>
/// <param name="Wage">The monthly wage: the total salary with its allowances.</param>
/// <param name="LastDay">The service's last day, or the day before the leave.</param>
/// <param name="UnpaidFrom">The first day no payroll run paid (null: every day to the last one was paid).</param>
/// <param name="ExcludedDays">Unpaid leave days not counted in the service (beyond 20 a year, article 116).</param>
/// <param name="LeaveDays">The leave's days (vacation) or the unused annual balance (end of service).</param>
/// <param name="Due">The advances' installments, penalties and deductions it takes.</param>
/// <param name="Timesheets">A worker's approved timesheet lines no run paid: paid at the timesheet's own net.</param>
/// <param name="WorkedDays">A worker's days on the job from <paramref name="UnpaidFrom"/> (not the calendar's: housing is not paid).</param>
public sealed record SettlementCalculation(
    SettlementKind Kind,
    EndReason? Reason,
    ContractTerm Term,
    DateOnly? ContractEndsOn,
    decimal Wage,
    DateOnly HireDate,
    DateOnly LastDay,
    DateOnly? UnpaidFrom,
    decimal ExcludedDays,
    decimal LeaveDays,
    IReadOnlyList<DueDeduction> Due,
    decimal OtherAdditions,
    decimal Custody,
    decimal OtherDeductions,
    IReadOnlyList<TimesheetPay>? Timesheets = null,
    decimal? WorkedDays = null);

/// <summary>An approved timesheet line a settlement pays (its days and the timesheet's net for the worker).</summary>
public sealed record TimesheetPay(Guid LineId, string TimesheetNo, decimal Days, decimal Net);

/// <summary>
/// The settlement's figures under the Saudi labour law. The day's wage is the monthly wage ÷ 30.
/// <list type="bullet">
/// <item>The days no payroll run paid, up to the last day, by the payroll's 30-day rule for each month.</item>
/// <item>The leave pay: the leave's days in advance (article 109), or the unused balance at the end (article 111).</item>
/// <item>The end-of-service award (article 84): half a month's wage for each of the first five years and a month's for
/// each year after, the fractions of a year counted; a resignation's share (article 85): none under two years, a third to
/// five, two thirds to ten, all after; none in the probation (article 54) or under article 80; all for force majeure or
/// a woman after marrying or giving birth (article 87), death and disability.</item>
/// <item>Article 77's compensation when the employer ends it without a lawful reason: 15 days' wage for each year of an
/// indefinite contract, the wage of the rest of a fixed-term one, two months' wage at least.</item>
/// <item>Less the installments, the day penalties at the day's wage, the amount penalties and other deductions, and the
/// custody and other deductions entered.</item>
/// </list>
/// </summary>
public static class SettlementCalculator
{
    public const decimal DaysInYear = 365m;

    public static SettlementResult Calculate(SettlementCalculation c)
    {
        ArgumentNullException.ThrowIfNull(c);
        var day = c.Wage / 30m;
        var lines = new List<SettlementLineValues>();

        foreach (var line in c.Timesheets ?? [])
        {
            lines.Add(new(SettlementSide.Addition, "timesheet_pay", line.Days, 0, Money(line.Net), line.LineId, null, line.TimesheetNo));
        }

        var unpaidDays = c.WorkedDays ?? (c.UnpaidFrom is { } from && from <= c.LastDay ? PayDays(from, c.LastDay) : 0);
        if (unpaidDays > 0)
        {
            lines.Add(new(SettlementSide.Addition, "unpaid_salary", unpaidDays, Money(day), Money(unpaidDays * day)));
        }

        decimal serviceDays = 0, years = 0, full = 0, factor = 0;
        if (c.Kind == SettlementKind.Vacation)
        {
            if (c.LeaveDays > 0)
            {
                lines.Add(new(SettlementSide.Addition, "leave_allowance", c.LeaveDays, Money(day), Money(c.LeaveDays * day)));
            }
        }
        else
        {
            serviceDays = Math.Max(0, c.LastDay.DayNumber - c.HireDate.DayNumber + 1 - c.ExcludedDays);
            years = serviceDays / DaysInYear;
            full = Money((c.Wage / 2m * Math.Min(years, 5m)) + (c.Wage * Math.Max(years - 5m, 0m)));
            factor = AwardFactor(c.Reason, years);
            lines.Add(new(SettlementSide.Addition, "end_of_service", serviceDays, Math.Round(factor, 4), Money(full * factor)));
            if (c.LeaveDays > 0)
            {
                lines.Add(new(SettlementSide.Addition, "leave_balance", c.LeaveDays, Money(day), Money(c.LeaveDays * day)));
            }

            if (c.Reason == EndReason.EmployerTermination)
            {
                var compensation = c.Term == ContractTerm.Fixed && c.ContractEndsOn is { } ends
                    ? Math.Max(0, ends.DayNumber - c.LastDay.DayNumber) * day
                    : c.Wage / 2m * years;
                lines.Add(new(SettlementSide.Addition, "article_77", 0, 0, Money(Math.Max(compensation, 2 * c.Wage))));
            }
        }

        if (c.OtherAdditions > 0)
        {
            lines.Add(new(SettlementSide.Addition, "other_addition", 0, 0, Money(c.OtherAdditions)));
        }

        foreach (var d in c.Due)
        {
            var (code, amount) = d.Kind switch
            {
                DeductionItemKind.Installment => ("installment", d.Amount),
                DeductionItemKind.PenaltyDays => ("penalty_days", d.Days * day),
                DeductionItemKind.Suspension => ("suspension", d.Days * day),
                DeductionItemKind.PenaltyAmount => ("penalty_amount", d.Amount),
                _ => ("other_due", d.Amount),
            };
            if (amount > 0)
            {
                lines.Add(new(SettlementSide.Deduction, code, d.Days, d.Days > 0 ? Money(day) : 0, Money(amount), d.Id, d.Kind, d.Reference, d.Period));
            }
        }

        if (c.Custody > 0)
        {
            lines.Add(new(SettlementSide.Deduction, "custody", 0, 0, Money(c.Custody)));
        }

        if (c.OtherDeductions > 0)
        {
            lines.Add(new(SettlementSide.Deduction, "other_deduction", 0, 0, Money(c.OtherDeductions)));
        }

        var additions = lines.Where(l => l.Side == SettlementSide.Addition).Sum(l => l.Amount);
        var deductions = lines.Where(l => l.Side == SettlementSide.Deduction).Sum(l => l.Amount);
        return new SettlementResult(unpaidDays, serviceDays, Math.Round(years, 4), full, Math.Round(factor, 4), lines, additions, deductions, additions - deductions);
    }

    /// <summary>The award's share by the reason and the years of service (articles 54, 80, 84, 85 and 87).</summary>
    public static decimal AwardFactor(EndReason? reason, decimal years) => reason switch
    {
        EndReason.Resignation => years < 2 ? 0 : years < 5 ? 1m / 3m : years < 10 ? 2m / 3m : 1,
        EndReason.Probation or EndReason.Article80 or null => 0,
        _ => 1,
    };

    /// <summary>The pay days from one day to another by the payroll's rule: a whole month is 30, part of one its days (30 at most).</summary>
    public static decimal PayDays(DateOnly from, DateOnly to)
    {
        decimal days = 0;
        for (var start = from; start <= to;)
        {
            var monthEnd = new DateOnly(start.Year, start.Month, DateTime.DaysInMonth(start.Year, start.Month));
            var end = monthEnd < to ? monthEnd : to;
            days += start.Day == 1 && end == monthEnd ? 30 : Math.Min(30, end.DayNumber - start.DayNumber + 1);
            start = end.AddDays(1);
        }

        return days;
    }

    /// <summary>Unpaid leave days not counted in the service: what is above 20 in each year of service (article 116).</summary>
    public static decimal ExcludedDays(DateOnly hired, DateOnly lastDay, IReadOnlyList<(DateOnly From, DateOnly To)> unpaidLeaves)
    {
        ArgumentNullException.ThrowIfNull(unpaidLeaves);
        decimal excluded = 0;
        for (var start = hired; start <= lastDay; start = start.AddYears(1))
        {
            var end = start.AddYears(1).AddDays(-1);
            if (end > lastDay)
            {
                end = lastDay;
            }

            var days = unpaidLeaves.Sum(l => Math.Max(0, Math.Min(l.To.DayNumber, end.DayNumber) - Math.Max(l.From.DayNumber, start.DayNumber) + 1));
            excluded += Math.Max(0, days - 20);
        }

        return excluded;
    }

    private static decimal Money(decimal value) => decimal.Round(value, 2, MidpointRounding.AwayFromZero);
}
