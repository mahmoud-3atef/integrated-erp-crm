using IntegratedErp.BuildingBlocks.Alerts;
using IntegratedErp.Modules.Staff.Domain;
using IntegratedErp.Modules.Staff.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Staff.Application;

/// <summary>
/// The staff's alerts (docs/02-target-architecture/08 §4): a contract ending (90/60/30 days in the design; one
/// threshold the company sets) with no renewal decided, and a probation ending with no decision.
/// </summary>
internal sealed class StaffAlerts(StaffDbContext db) : IAlertProvider
{
    public const string ContractEnding = "staff.contract_ending";
    public const string ProbationEnding = "staff.probation_ending";

    private const string GroupAr = "الموارد البشرية";
    private const string GroupEn = "Human resources";

    public IReadOnlyList<AlertDefinition> Definitions { get; } =
    [
        new(ContractEnding, GroupAr, GroupEn, "عقد موظف ينتهي بلا قرار تجديد", "Staff contract ending with no renewal decided",
            "أيام قبل نهاية العقد", "Days before the contract's end", 60, StaffPermissions.View, StaffPermissions.Manage),
        new(ProbationEnding, GroupAr, GroupEn, "تجربة موظف تنتهي بلا قرار", "Staff probation ending with no decision",
            "أيام قبل نهاية التجربة", "Days before the probation's end", 14, StaffPermissions.View, StaffPermissions.Manage),
    ];

    public async Task<IReadOnlyList<AlertItem>> AlertsAsync(AlertQuery query, IReadOnlySet<string> codes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(codes);
        var alerts = new List<AlertItem>();
        var today = query.Today;
        var decided = await db.Actions.AsNoTracking()
            .Where(a => a.Status == StaffActionStatus.InApproval || a.Status == StaffActionStatus.Applied)
            .Select(a => new { a.EmployeeId, a.Kind, a.CreatedAt })
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        if (codes.Contains(ContractEnding))
        {
            var until = today.AddDays(query.DaysOf(Definitions[0]));
            var ending = await db.Employees.AsNoTracking()
                .Where(e => e.Status != StaffStatus.Left && e.ContractEndsOn != null && e.ContractEndsOn >= today && e.ContractEndsOn <= until)
                .Select(e => new { e.Id, e.NameAr, e.NameEn, e.EmployeeNo, e.ContractEndsOn })
                .ToListAsync(cancellationToken).ConfigureAwait(false);
            alerts.AddRange(ending
                .Where(e => !decided.Any(d => d.EmployeeId == e.Id && d.Kind is StaffActionKind.RenewContract or StaffActionKind.NotRenew))
                .Select(e => new AlertItem(
                    ContractEnding, $"{e.Id:N}:{e.ContractEndsOn:yyyyMMdd}", e.ContractEndsOn!.Value.DayNumber - today.DayNumber <= 30 ? AlertSeverity.Critical : AlertSeverity.Warning,
                    $"{e.NameAr ?? e.NameEn}: العقد ينتهي في {e.ContractEndsOn:yyyy/MM/dd}", $"{e.NameEn}: contract ends on {e.ContractEndsOn:yyyy-MM-dd}",
                    $"الرقم {e.EmployeeNo} · لم يُقرر التجديد بعد.", $"No. {e.EmployeeNo} · no renewal decided yet.",
                    $"/hr/employees/{e.Id}", today)));
        }

        if (codes.Contains(ProbationEnding))
        {
            var until = today.AddDays(query.DaysOf(Definitions[1]));
            var ending = await db.Employees.AsNoTracking()
                .Where(e => e.Status == StaffStatus.Probation && e.ProbationEndsOn != null && e.ProbationEndsOn <= until)
                .Select(e => new { e.Id, e.NameAr, e.NameEn, e.EmployeeNo, e.ProbationEndsOn })
                .ToListAsync(cancellationToken).ConfigureAwait(false);
            alerts.AddRange(ending
                .Where(e => !decided.Any(d => d.EmployeeId == e.Id && d.Kind is StaffActionKind.ConfirmProbation or StaffActionKind.ExtendProbation or StaffActionKind.EndProbation))
                .Select(e => new AlertItem(
                    ProbationEnding, $"{e.Id:N}:{e.ProbationEndsOn:yyyyMMdd}", e.ProbationEndsOn < today ? AlertSeverity.Critical : AlertSeverity.Warning,
                    $"{e.NameAr ?? e.NameEn}: التجربة تنتهي في {e.ProbationEndsOn:yyyy/MM/dd}", $"{e.NameEn}: probation ends on {e.ProbationEndsOn:yyyy-MM-dd}",
                    $"الرقم {e.EmployeeNo} · يلزم قرار: تثبيت أو تمديد أو إنهاء.", $"No. {e.EmployeeNo} · a decision is due: confirm, extend or end.",
                    $"/hr/employees/{e.Id}", today)));
        }

        return alerts;
    }
}
