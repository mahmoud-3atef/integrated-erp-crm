using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.CrmSync.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

/// <summary>
/// The old system's open project invoices as opening balances (docs/02-target-architecture/07 §8): for each, what was
/// left to collect (its total with VAT less what it records as collected), with its number and date for the debts'
/// ages. Read again after every sync of the parallel phase: an invoice collected, cancelled or deleted there drops to
/// zero here. Read only — nothing is written back to the old system.
/// </summary>
internal sealed class OpeningBalanceImport(BillingDbContext db, ICrmStaging staging, IProjectDirectory projects, IClock clock) : ICrmStagingConsumer
{
    private static readonly TimeSpan Riyadh = TimeSpan.FromHours(3);
    private const int ProjectInvoice = 100000000;
    private const int Canceled = 279640007;
    private const int FullyCollected = 279640004;

    public string Name => "opening balances";

    public async Task<string> ApplyAsync(CancellationToken cancellationToken)
    {
        var records = await staging.ChangedSinceAsync("new_invoice", null, cancellationToken).ConfigureAwait(false);
        var existing = await db.OpeningBalances.ToDictionaryAsync(o => o.CrmId, cancellationToken).ConfigureAwait(false);
        var rows = new List<(Guid CrmId, string No, Guid ProjectCrmId, string ProjectName, DateOnly Date, decimal Total, decimal Open)>();
        foreach (var record in records)
        {
            using var document = JsonDocument.Parse(record.Payload);
            var row = document.RootElement;
            var total = (Money(row, "new_totalamount") ?? 0) + (Money(row, "new_totalvatamount") ?? 0);
            var open = record.IsDeleted || Int(row, "statecode") is not (null or 0) || Int(row, "statuscode") is Canceled or FullyCollected
                       || Int(row, "new_invoicetype") is not (null or ProjectInvoice)
                ? 0
                : Math.Max(0, total - (Money(row, "new_totalpaidamount") ?? 0));
            if (Id(row, "new_projectid") is not { } projectCrmId || (Date(row, "new_invoicedate") ?? Date(row, "new_todate")) is not { } date)
            {
                continue;
            }

            if (open < 0.05m && !existing.ContainsKey(record.CrmId))
            {
                continue; // closed and never open here: nothing to keep
            }

            rows.Add((record.CrmId, Text(row, "new_invoicenumber") ?? "—", projectCrmId, Text(row, "new_projectidname") ?? "—", date, total, open < 0.05m ? 0 : open));
        }

        var known = (await projects.FindAsync([], rows.Select(r => r.ProjectCrmId).Distinct().ToList(), cancellationToken).ConfigureAwait(false))
            .ToDictionary(p => p.CrmId);
        var now = clock.UtcNow;
        foreach (var r in rows)
        {
            if (!existing.TryGetValue(r.CrmId, out var balance))
            {
                balance = OpeningBalance.Create(r.CrmId);
                db.OpeningBalances.Add(balance);
                existing[r.CrmId] = balance;
            }

            var project = known.GetValueOrDefault(r.ProjectCrmId);
            balance.Set(r.No, r.ProjectCrmId, project?.Id, project?.Name ?? r.ProjectName, r.Date, r.Date, r.Total, r.Open, now);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var stillOpen = existing.Values.Where(o => o.Amount > 0).ToList();
        return string.Create(CultureInfo.InvariantCulture, $"{stillOpen.Count} open invoices of the old system, {stillOpen.Sum(o => o.Amount):N2} left to collect");
    }

    private static string? Text(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()) ? v.GetString()!.Trim() : null;

    private static Guid? Id(JsonElement row, string field) => Guid.TryParse(Text(row, field), out var id) ? id : null;

    private static int? Int(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;

    private static decimal? Money(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) ? v.ValueKind switch
        {
            JsonValueKind.Number when v.TryGetDecimal(out var d) => Math.Round(d, 2),
            JsonValueKind.String when decimal.TryParse(v.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var d) => Math.Round(d, 2),
            _ => null,
        } : null;

    private static DateOnly? Date(JsonElement row, string field) =>
        DateTimeOffset.TryParse(Text(row, field), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var at)
            ? DateOnly.FromDateTime(at.ToOffset(Riyadh).DateTime)
            : null;
}
