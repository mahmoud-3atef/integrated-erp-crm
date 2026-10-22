using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

/// <summary>An old invoice the import left out, and why.</summary>
public sealed record LegacySkipDto(string InvoiceNo, string Project, DateOnly Month, string Reason);

/// <summary>An imported invoice whose lines needed a difference to match the old amounts.</summary>
public sealed record LegacyBalancedDto(string InvoiceNo, string TimesheetNo, string Project, int Lines, decimal InvoiceDifference, decimal PayDifference);

/// <summary>What the import did: the drafts made, the invoices left out, and the differences it balanced.</summary>
public sealed record LegacyImportReport(int Imported, int Lines, int Workers, decimal InvoiceAmount, IReadOnlyList<LegacySkipDto> Skipped, IReadOnlyList<LegacyBalancedDto> Balanced, int MissingWorkers);

/// <summary>
/// The old system's project invoices from June 2026 as draft timesheets (the user's decision, 2026-10-22): read from
/// the CRM copy (never from the CRM), one timesheet per invoice with its lines and variables as the old system recorded
/// them, the old number and status on it. A line whose amounts the formulas give differently (a hand edit there) gets
/// a difference variable, so the draft comes to the old invoice's amounts exactly. Cancelled invoices are left out, and
/// a project's month that already has a timesheet here; an invoice already imported is not imported again.
/// </summary>
internal sealed class LegacyTimesheetImport(
    BillingDbContext db,
    ICrmStaging staging,
    IProjectDirectory projects,
    IWorkforceDirectory workforce,
    NumberSequenceService numbering,
    ICurrentUser user,
    IClock clock)
{
    public static readonly DateOnly From = new(2026, 6, 1);
    private const int Canceled = 279640007;
    private const int ProjectInvoice = 100000000;
    private static readonly TimeSpan Riyadh = TimeSpan.FromHours(3);

    public async Task<LegacyImportReport> ImportAsync(CancellationToken cancellationToken)
    {
        var invoices = new List<(Guid CrmId, JsonElement Row)>();
        var documents = new List<JsonDocument>();
        try
        {
            foreach (var record in await staging.ChangedSinceAsync("new_invoice", null, cancellationToken).ConfigureAwait(false))
            {
                if (record.IsDeleted)
                {
                    continue;
                }

                var document = JsonDocument.Parse(record.Payload);
                documents.Add(document);
                var row = document.RootElement;
                if ((Int(row, "statuscode") ?? 1) != Canceled && Int(row, "new_invoicetype") is null or ProjectInvoice && Date(row, "new_todate") is { } to && to >= From)
                {
                    invoices.Add((record.CrmId, row));
                }
            }

            var wanted = invoices.Select(i => i.CrmId).ToHashSet();
            var details = new Dictionary<Guid, List<JsonElement>>();
            foreach (var record in await staging.ChangedSinceAsync("new_invoicdetail", null, cancellationToken).ConfigureAwait(false))
            {
                if (record.IsDeleted)
                {
                    continue;
                }

                var document = JsonDocument.Parse(record.Payload);
                documents.Add(document);
                if (Id(document.RootElement, "new_invoiceid") is { } invoiceId && wanted.Contains(invoiceId))
                {
                    (details.TryGetValue(invoiceId, out var list) ? list : details[invoiceId] = []).Add(document.RootElement);
                }
            }

            return await ImportAsync(invoices, details, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            documents.ForEach(d => d.Dispose());
        }
    }

    private async Task<LegacyImportReport> ImportAsync(List<(Guid CrmId, JsonElement Row)> invoices, Dictionary<Guid, List<JsonElement>> details, CancellationToken cancellationToken)
    {
        var projectIds = invoices.Select(i => Id(i.Row, "new_projectid")).OfType<Guid>().Distinct().ToList();
        var known = (await projects.FindAsync([], projectIds, cancellationToken).ConfigureAwait(false)).ToDictionary(p => p.CrmId);
        var workerIds = details.Values.SelectMany(l => l).Select(d => Id(d, "new_employeeid")).OfType<Guid>().Distinct().ToList();
        var cards = (await workforce.CardsByCrmAsync([], workerIds, cancellationToken).ConfigureAwait(false)).GroupBy(c => c.CrmId).ToDictionary(g => g.Key, g => g.First());
        var imported = (await db.Timesheets.Where(t => t.LegacyInvoiceCrmId != null).Select(t => t.LegacyInvoiceCrmId!.Value).ToListAsync(cancellationToken).ConfigureAwait(false)).ToHashSet();
        var taken = (await db.Timesheets.Select(t => new { t.ProjectId, t.Month }).ToListAsync(cancellationToken).ConfigureAwait(false)).Select(t => (t.ProjectId, t.Month)).ToHashSet();
        var settings = await db.ProjectSettings.AsNoTracking().ToDictionaryAsync(s => s.ProjectId, cancellationToken).ConfigureAwait(false);

        var skipped = new List<LegacySkipDto>();
        var balanced = new List<LegacyBalancedDto>();
        int made = 0, lines = 0, missing = 0;
        var workers = new HashSet<Guid>();
        decimal amount = 0;
        foreach (var (crmId, row) in invoices.OrderBy(i => Date(i.Row, "new_todate")).ThenBy(i => Text(i.Row, "new_invoicenumber"), StringComparer.Ordinal))
        {
            var number = Text(row, "new_invoicenumber") ?? "—";
            var to = Date(row, "new_todate")!.Value;
            var from = Date(row, "new_fromdate") ?? new DateOnly(to.Year, to.Month, 1);
            var month = new DateOnly(to.Year, to.Month, 1);
            var projectName = Text(row, "new_projectidname") ?? "—";
            if (imported.Contains(crmId))
            {
                continue;
            }

            if (Id(row, "new_projectid") is not { } projectCrmId || !known.TryGetValue(projectCrmId, out var project))
            {
                skipped.Add(new(number, projectName, month, "project_unknown"));
                continue;
            }

            if (!taken.Add((project.Id, month)))
            {
                skipped.Add(new(number, project.Name, month, "month_taken"));
                continue;
            }

            var rows = details.GetValueOrDefault(crmId) ?? [];
            if (rows.Count == 0)
            {
                skipped.Add(new(number, project.Name, month, "no_lines"));
                taken.Remove((project.Id, month));
                continue;
            }

            var setting = settings.GetValueOrDefault(project.Id) ?? ProjectBillingSetting.Default(project.Id);
            var rules = TimesheetService.Rules(setting, project.ContractType);
            // One transaction per invoice: its number (gap-free) and its timesheet together.
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
            var sheetNo = await numbering.NextNumberAsync(db, "timesheet", to, cancellationToken).ConfigureAwait(false);
            var timesheet = Timesheet.Create(sheetNo, new TimesheetProject(project.Id, project.CrmId, project.Code, project.Name, project.CustomerName, project.ContractType), month, from, to, setting.DayBasis);
            timesheet.MarkLegacy(crmId, number, Int(row, "statuscode") ?? 1);

            // The lines as the old invoice has them, and each worker's variables from it.
            var built = new List<TimesheetLine>();
            var variables = new List<(Guid Worker, AdjustmentType Type, decimal Value)>();
            var expected = new List<(Guid Worker, decimal Invoice, decimal Net)>();
            foreach (var (d, n) in rows.Select((d, n) => (d, n)))
            {
                if (Id(d, "new_employeeid") is not { } workerCrm || !cards.TryGetValue(workerCrm, out var card))
                {
                    missing++;
                    continue;
                }

                var days = Money(d, "new_workingdays");
                var divisor = Money(d, "new_monthdays") is > 0 and var q ? q : 30;
                var billSalary = Money(d, "new_custsalary") is > 0 and var c ? c : Money(d, "new_totalsalary");
                built.Add(new TimesheetLine(timesheet.Id, new TimesheetLineValues(
                    $"L:{Id(d, "new_invoicdetailid")?.ToString("N") ?? n.ToString(CultureInfo.InvariantCulture)}", card.Id, card.WorkerNo, card.Name, card.IqamaNo, card.ProfessionCode, card.NationalityCode,
                    TimesheetService.SourceOf(card.Sponsor), TimesheetService.SourceOf(card.Sponsor) == WorkerSource.Supplier ? card.Sponsor : null,
                    from, to, days, divisor, null, billSalary, Money(d, "new_salesprice"), Money(d, "new_cust_housing"), false, Money(d, "new_custtransport"), false, false,
                    Money(d, "new_totalsalary") is > 0 and var pay ? pay : billSalary, card.BasicSalary, "LegacyInvoice", number, true)));
                void Var(AdjustmentType type, decimal value)
                {
                    if (value != 0)
                    {
                        variables.Add((card.Id, type, value));
                    }
                }

                Var(AdjustmentType.Absence, Math.Min(Money(d, "new_abscentdays"), days));
                Var(AdjustmentType.FeeDays, Money(d, "new_mawariddays") - days);
                Var(AdjustmentType.OvertimeAmount, Money(d, "new_overtime"));
                Var(AdjustmentType.ClientAddition, Money(d, "new_othermawaridearning"));
                Var(AdjustmentType.ClientDeduction, Money(d, "new_otherdeduction"));
                Var(AdjustmentType.CustomerLoan, Money(d, "new_customerloan"));
                Var(AdjustmentType.OtherCost, Money(d, "new_othercommission"));
                Var(AdjustmentType.InternalAddition, Money(d, "new_internaladdition"));
                Var(AdjustmentType.InternalDeduction, Money(d, "new_internaldeduction") + Money(d, "new_loanamount"));
                expected.Add((card.Id, Money(d, "new_totalwithoutvat"), Money(d, "new_nettoemployee")));
            }

            if (built.Count == 0)
            {
                skipped.Add(new(number, project.Name, month, "workers_unknown"));
                taken.Remove((project.Id, month));
                await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                continue;
            }

            var reason = $"من فاتورة النظام القديم {number}";
            timesheet.ImportLegacy(built, variables.GroupBy(v => (v.Worker, v.Type)).Select(g => (g.Key.Worker, g.Key.Type, g.Sum(v => v.Value), reason)).ToList(), rules, user.DisplayName, clock.UtcNow);

            // Each worker's difference from the old amounts, as variables that say so.
            var differences = new List<(Guid, AdjustmentType, decimal, string)>();
            var balance = $"فرق عن فاتورة النظام القديم {number}";
            int diffLines = 0;
            decimal invoiceDiff = 0, payDiff = 0;
            foreach (var g in expected.GroupBy(e => e.Worker))
            {
                var mine = timesheet.Lines.Where(l => l.WorkerId == g.Key).ToList();
                var di = Math.Round(g.Sum(e => e.Invoice) - mine.Sum(l => l.InvoiceAmount), 2);
                var dp = Math.Round(g.Sum(e => e.Net) - mine.Sum(l => l.WorkerNet), 2);
                if (di != 0)
                {
                    differences.Add((g.Key, di > 0 ? AdjustmentType.OtherCost : AdjustmentType.OtherDeduction, Math.Abs(di), balance));
                }

                // The pay differs by what the invoice difference already moved (other costs and deductions never touch the pay).
                if (dp != 0)
                {
                    differences.Add((g.Key, dp > 0 ? AdjustmentType.InternalAddition : AdjustmentType.InternalDeduction, Math.Abs(dp), balance));
                }

                if (di != 0 || dp != 0)
                {
                    diffLines++;
                    invoiceDiff += di;
                    payDiff += dp;
                }
            }

            if (differences.Count > 0)
            {
                timesheet.AddLegacyAdjustments(differences, rules, user.DisplayName, clock.UtcNow);
                balanced.Add(new(number, sheetNo, project.Name, diffLines, invoiceDiff, payDiff));
            }

            db.Timesheets.Add(timesheet);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            db.ChangeTracker.Clear();
            made++;
            lines += timesheet.Lines.Count;
            workers.UnionWith(timesheet.Lines.Select(l => l.WorkerId));
            amount += timesheet.Lines.Sum(l => l.InvoiceAmount);
        }

        return new LegacyImportReport(made, lines, workers.Count, amount, skipped, balanced, missing);
    }

    private static string? Text(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()) ? v.GetString()!.Trim() : null;

    private static Guid? Id(JsonElement row, string field) => Guid.TryParse(Text(row, field), out var id) ? id : null;

    private static int? Int(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;

    private static decimal Money(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d) ? Math.Round(d, 2) : 0;

    /// <summary>A CRM date (UTC) as the Riyadh day it means.</summary>
    private static DateOnly? Date(JsonElement row, string field) =>
        DateTimeOffset.TryParse(Text(row, field), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var at) ? DateOnly.FromDateTime(at.ToOffset(Riyadh).DateTime) : null;
}
