using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

/// <summary>
/// GOSI's rules as the payrolls apply them (the Social Insurance Law; docs/03-migration-plan/12): the contributory wage
/// is the basic and housing (or the wage registered with GOSI) within its floor and ceiling, for the days in service,
/// at the rates of the person's category in force at the period's end.
/// </summary>
internal static class GosiRules
{
    public static readonly DateOnly NewSubscribersFrom = new(2024, 7, 3);

    /// <summary>
    /// The new subscribers' annuity rate rises half a point a year for each side from July 2025 to July 2028 (SANED
    /// 0.75% each, occupational hazards 2% on the company, unchanged): the rates finance reviews before using them.
    /// </summary>
    public static readonly (DateOnly From, decimal Employee, decimal Employer)[] NewSubscriberSteps =
    [
        (new DateOnly(2025, 7, 1), 10.25m, 12.25m),
        (new DateOnly(2026, 7, 1), 10.75m, 12.75m),
        (new DateOnly(2027, 7, 1), 11.25m, 13.25m),
        (new DateOnly(2028, 7, 1), 11.75m, 13.75m),
    ];

    public static bool IsSaudi(string? nationalityCode) => nationalityCode is "SAU" or "SA";

    public static GosiCategory CategoryOf(string? nationalityCode, DateOnly? since) =>
        !IsSaudi(nationalityCode) ? GosiCategory.NonSaudi : since is { } s && s >= NewSubscribersFrom ? GosiCategory.SaudiNew : GosiCategory.SaudiLegacy;

    /// <summary>The contributory wage for the days in service and both shares.</summary>
    public static (decimal Base, decimal Employee, decimal Employer) Contribution(StaffGosi rate, decimal wage, decimal serviceDays)
    {
        ArgumentNullException.ThrowIfNull(rate);
        var basis = Money(Math.Clamp(wage, rate.MinBase, rate.MaxBase) * Math.Min(30, serviceDays) / 30m);
        return (basis, Money(basis * rate.EmployeePercent / 100m), Money(basis * rate.EmployerPercent / 100m));
    }

    /// <summary>Each category's rates in force on a day.</summary>
    public static async Task<Dictionary<GosiCategory, StaffGosi>> RatesAsync(PayrollDbContext db, DateOnly on, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(db);
        var rates = await db.GosiRates.AsNoTracking().Where(r => r.EffectiveFrom <= on).ToListAsync(cancellationToken).ConfigureAwait(false);
        return rates.GroupBy(r => r.Category).ToDictionary(g => g.Key, g =>
        {
            var r = g.OrderByDescending(x => x.EffectiveFrom).First();
            return new StaffGosi(r.Category, r.EmployeePercent, r.EmployerPercent, r.MinBase, r.MaxBase);
        });
    }

    private static decimal Money(decimal value) => decimal.Round(value, 2, MidpointRounding.AwayFromZero);
}
