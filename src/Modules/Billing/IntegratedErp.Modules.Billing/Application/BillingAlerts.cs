using System.Globalization;
using IntegratedErp.BuildingBlocks.Alerts;
using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

/// <summary>
/// Billing's alerts (docs/02-target-architecture/06 §5, 07 §4.4): last month's work without a timesheet (billing
/// coverage), an approved timesheet not invoiced, a project's invoices past due, and a project's credit not allocated
/// while it owes.
/// </summary>
internal sealed class BillingAlerts(BillingDbContext db, IPeriodLedger ledger, ReceivablesLedger receivables) : IAlertProvider
{
    public const string NoTimesheet = "billing.no_timesheet";
    public const string NotInvoiced = "billing.not_invoiced";
    public const string Overdue = "billing.overdue";
    public const string UnallocatedCredit = "billing.unallocated_credit";

    private const string GroupAr = "الفوترة والتحصيل";
    private const string GroupEn = "Billing and collection";

    public IReadOnlyList<AlertDefinition> Definitions { get; } =
    [
        new(NoTimesheet, GroupAr, GroupEn, "مشروع فيه عمل بلا تحضير", "Project with work and no timesheet",
            "اليوم من الشهر الذي يُطلب فيه تحضير الشهر السابق", "Day of the month by which last month's timesheet is due", 5,
            BillingPermissions.TimesheetsView, BillingPermissions.TimesheetsManage),
        new(NotInvoiced, GroupAr, GroupEn, "تحضير معتمد بلا فاتورة", "Approved timesheet not invoiced",
            "أيام بعد اعتماد التحضير", "Days after the timesheet's approval", 3,
            BillingPermissions.InvoicesView, BillingPermissions.InvoicesManage),
        new(Overdue, GroupAr, GroupEn, "فواتير متأخرة السداد", "Invoices past due",
            "أيام بعد تاريخ الاستحقاق", "Days after the due date", 0,
            BillingPermissions.ReceiptsView, BillingPermissions.ReceiptsManage),
        new(UnallocatedCredit, GroupAr, GroupEn, "رصيد غير موزع والمشروع عليه فواتير", "Credit not allocated while the project owes",
            "—", "—", 0,
            BillingPermissions.ReceiptsView, BillingPermissions.ReceiptsManage),
    ];

    public async Task<IReadOnlyList<AlertItem>> AlertsAsync(AlertQuery query, IReadOnlySet<string> codes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(codes);
        var alerts = new List<AlertItem>();
        var today = query.Today;

        if (codes.Contains(NoTimesheet) && today.Day > query.DaysOf(Definitions[0]))
        {
            var month = new DateOnly(today.Year, today.Month, 1).AddMonths(-1);
            var spans = await ledger.WorkAsync(null, month, month.AddMonths(1).AddDays(-1), cancellationToken).ConfigureAwait(false);
            var made = await db.Timesheets.AsNoTracking().Where(t => t.Month == month).Select(t => t.ProjectCrmId).ToListAsync(cancellationToken).ConfigureAwait(false);
            var label = month.ToString("yyyy-MM", CultureInfo.InvariantCulture);
            alerts.AddRange(spans.Where(s => !made.Contains(s.ProjectCrmId)).GroupBy(s => s.ProjectCrmId).Select(g =>
            {
                var workers = g.Select(s => s.WorkerId).Distinct().Count();
                return new AlertItem(
                    NoTimesheet, $"{g.Key:N}:{label}", AlertSeverity.Warning,
                    $"{g.First().ProjectName}: لا تحضير لشهر {label}", $"{g.First().ProjectName}: no timesheet for {label}",
                    $"{ArabicCount.Of(workers, "عامل واحد عمل", "عاملان عملا", "عمال عملوا", "عاملًا عملوا")} على المشروع في الشهر ولم يُولَّد تحضيره، فلم يُفوتر.",
                    $"{workers} workers worked on the project in the month and its timesheet was not made, so it is not billed.",
                    $"/billing/timesheets?month={month:yyyy-MM-dd}", month.AddMonths(1));
            }));
        }

        if (codes.Contains(NotInvoiced))
        {
            var before = new DateTimeOffset(today.AddDays(-query.DaysOf(Definitions[1])).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var invoiced = db.Invoices.Where(i => i.TimesheetId != null).Select(i => i.TimesheetId!.Value);
            var waiting = await db.Timesheets.AsNoTracking()
                .Where(t => t.Status == TimesheetStatus.Approved && t.ApprovedAt != null && t.ApprovedAt < before && !invoiced.Contains(t.Id))
                .Select(t => new { t.Id, t.TimesheetNo, t.ProjectName, t.Month, t.ApprovedAt, Amount = t.Lines.Sum(l => l.InvoiceTotal) })
                .ToListAsync(cancellationToken).ConfigureAwait(false);
            alerts.AddRange(waiting.Select(t => new AlertItem(
                NotInvoiced, t.Id.ToString("N"), AlertSeverity.Warning,
                $"{t.ProjectName}: التحضير {t.TimesheetNo} معتمد بلا فاتورة", $"{t.ProjectName}: timesheet {t.TimesheetNo} approved, not invoiced",
                $"شهر {t.Month:yyyy-MM} — قيمة الفاتورة المتوقعة {t.Amount:N2}.", $"{t.Month:yyyy-MM} — the expected invoice is {t.Amount:N2}.",
                $"/billing/timesheets/{t.Id}", DateOnly.FromDateTime(t.ApprovedAt!.Value.UtcDateTime), t.Amount)));
        }

        if (codes.Contains(Overdue) || codes.Contains(UnallocatedCredit))
        {
            var items = await receivables.ItemsAsync(null, null, cancellationToken).ConfigureAwait(false);
            if (codes.Contains(Overdue))
            {
                var limit = today.AddDays(-query.DaysOf(Definitions[2]));
                alerts.AddRange(items.Where(i => i.Outstanding > 0 && i.DueDate < limit).GroupBy(i => i.ProjectCrmId).Select(g =>
                {
                    var oldest = g.Min(i => i.DueDate);
                    var days = today.DayNumber - oldest.DayNumber;
                    var amount = g.Sum(i => i.Outstanding);
                    return new AlertItem(
                        Overdue, g.Key.ToString("N"), days > 90 ? AlertSeverity.Critical : AlertSeverity.Warning,
                        $"{g.First().ProjectName}: {amount:N2} متأخرة السداد", $"{g.First().ProjectName}: {amount:N2} past due",
                        $"{ArabicCount.Of(g.Count(), "فاتورة واحدة متأخرة", "فاتورتان متأخرتان", "فواتير متأخرة", "فاتورة متأخرة")}، أقدمها منذ {ArabicCount.Days(days)} ({g.OrderBy(i => i.DueDate).First().Number}).",
                        $"{g.Count()} invoices past due, the oldest for {days} days ({g.OrderBy(i => i.DueDate).First().Number}).",
                        $"/billing/statements/{g.Key}", oldest, amount);
                }));
            }

            if (codes.Contains(UnallocatedCredit))
            {
                var credits = await receivables.CreditsAsync(items, null, cancellationToken).ConfigureAwait(false);
                alerts.AddRange(credits.Where(c => c.Value > 0 && items.Any(i => i.ProjectCrmId == c.Key && i.Available > 0)).Select(c =>
                {
                    var name = items.First(i => i.ProjectCrmId == c.Key).ProjectName;
                    var owed = items.Where(i => i.ProjectCrmId == c.Key).Sum(i => i.Available);
                    return new AlertItem(
                        UnallocatedCredit, c.Key.ToString("N"), AlertSeverity.Info,
                        $"{name}: رصيد {c.Value:N2} غير موزع", $"{name}: {c.Value:N2} credit not allocated",
                        $"على المشروع فواتير مفتوحة بـ {owed:N2}: وزّع الرصيد عليها من سند القبض.",
                        $"The project has {owed:N2} of open invoices: allocate the credit from the receipt.",
                        $"/billing/statements/{c.Key}", today, c.Value);
                }));
            }
        }

        return alerts;
    }
}
