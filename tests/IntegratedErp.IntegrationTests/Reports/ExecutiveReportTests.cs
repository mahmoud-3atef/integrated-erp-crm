using System.Text.Json;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Reports.Application;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.IntegrationTests.Reports;

[Collection(DatabaseTestGroup.Name)]
public sealed class ExecutiveReportTests(TestDatabase database)
{
    [SkippableFact]
    public async Task The_finance_counts_the_old_systems_project_invoices_without_the_cancelled_ones_with_their_debts_ages()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"rp-{Guid.NewGuid():N}"[..16], "شركة التقارير", "Reports Co", default)).Value.Id;
        }

        var project = Guid.NewGuid();
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));
        var month = new DateOnly(today.Year, today.Month, 1);
        var lastMonthEnd = month.AddDays(-1);
        using (var scope = database.Scope(tenantId, user: "sync"))
        {
            var db = scope.ServiceProvider.GetRequiredService<CrmSyncDbContext>();
            var run = Guid.NewGuid();
            // CRM dates are UTC: the Riyadh day 21:00 the evening before.
            string Utc(DateOnly d) => d.AddDays(-1).ToDateTime(new TimeOnly(21, 0)).ToString("yyyy-MM-ddTHH:mm:ssZ", System.Globalization.CultureInfo.InvariantCulture);
            void Invoice(string no, DateOnly to, decimal total, decimal paid, int status, int type = 100000000)
            {
                var payload = JsonSerializer.Serialize(new Dictionary<string, object?>
                {
                    ["new_invoicenumber"] = no,
                    ["new_projectid"] = project.ToString(),
                    ["new_projectidname"] = "مشروع الاختبار",
                    ["new_todate"] = Utc(to),
                    ["createdon"] = Utc(to),
                    ["new_totalamount"] = Math.Round(total / 1.15m, 2),
                    ["new_totalvatamount"] = total - Math.Round(total / 1.15m, 2),
                    ["new_netsalarywithvat"] = total,
                    ["new_totalpaidamount"] = paid,
                    ["new_labornumber"] = 3,
                    ["statuscode"] = status,
                    ["new_invoicetype"] = type,
                });
                db.Records.Add(new StagedRecord("new_invoice", Guid.NewGuid(), null, null, 0, payload, no, run, DateTimeOffset.UtcNow));
            }

            Invoice("INV-1", lastMonthEnd, 11500, 4000, 279640003);
            Invoice("INV-2", lastMonthEnd.AddMonths(-3), 2300, 0, 279640008);
            Invoice("INV-X", lastMonthEnd, 9999, 0, LegacyInvoices.Canceled);
            Invoice("PAY-1", lastMonthEnd, 5000, 0, 1, type: 100000003);
            await db.SaveChangesAsync();
        }

        using (var scope = database.Scope(tenantId, user: "manager"))
        {
            var report = scope.ServiceProvider.GetRequiredService<ExecutiveReport>();
            var finance = await report.FinanceAsync(lastMonthEnd.AddDays(1 - lastMonthEnd.Day), lastMonthEnd, null, default);

            // Only INV-1 is in last month: the cancelled invoice and the payroll invoice are not counted.
            Assert.Equal((11500m, 4000m, 1m), (finance.Invoiced.Value!.Value, finance.Collected.Value!.Value, finance.InvoiceCount.Value!.Value));
            Assert.Equal(34.8m, finance.CollectionRate.Value);

            // Today's debt: INV-1's 7,500 and INV-2's 2,300; INV-2, three months old, is overdue.
            Assert.Equal((9800m, 2), (finance.TotalDebt, finance.OpenInvoices));
            Assert.Equal(2300m, finance.Overdue60);
            Assert.Equal(9800m, finance.Aging.Sum(a => a.Amount));
            var debtor = Assert.Single(finance.Debtors);
            Assert.Equal((9800m, 2), (debtor.Outstanding, debtor.OpenInvoices));

            var open = await report.InvoicesAsync(new ReportFilter(lastMonthEnd, lastMonthEnd, Open: true), default);
            Assert.Equal(["INV-1", "INV-2"], open.Select(i => i.No).ToArray());
        }
    }
}
