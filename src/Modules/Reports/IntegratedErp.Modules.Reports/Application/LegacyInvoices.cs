using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.CrmSync.Contracts;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace IntegratedErp.Modules.Reports.Application;

/// <summary>An old-system project invoice as the executive report counts it (dates in Riyadh time).</summary>
internal sealed record LegacyInvoice(
    Guid CrmId,
    string No,
    Guid? ProjectCrmId,
    string ProjectName,
    string? Manager,
    DateOnly To,
    DateOnly? From,
    DateOnly? InvoiceDate,
    DateOnly CreatedOn,
    int Workers,
    decimal BeforeVat,
    decimal Vat,
    decimal Total,
    decimal Paid,
    int Status)
{
    /// <summary>What was collected of it (never more than its total).</summary>
    public decimal Collected => Math.Min(Math.Max(0, Paid), Total);

    public decimal Remaining => Math.Max(0, Total - Paid);
}

/// <summary>
/// A worker's line on a counted invoice: what was billed for them before VAT and for how many days, the salary due, the
/// absence deducted from it, the net salary the worker was paid, and the advance installment taken from it.
/// </summary>
internal sealed record LegacyLine(Guid InvoiceCrmId, Guid WorkerCrmId, decimal BeforeVat, decimal WorkingDays, decimal DueSalary, decimal AbsentDays, decimal AbsenceDeduction, decimal NetSalary, decimal Advance, decimal SalesPrice);

/// <summary>The old system's invoices and the workers on each (invoice lines), read from the CRM copy.</summary>
internal sealed record LegacyFinance(IReadOnlyList<LegacyInvoice> Invoices, IReadOnlyDictionary<Guid, HashSet<Guid>> WorkersByInvoice)
{
    public IReadOnlyList<LegacyLine> Lines { get; init; } = [];
}

public sealed class ReportsOptions
{
    public const string Section = "Reports";

    /// <summary>The first day the finance figures count (the old report's financial start).</summary>
    public DateOnly FinanceFrom { get; set; } = new(2026, 6, 1);

    /// <summary>
    /// Projects never counted, by code: the old report's «InActive Employee» and «HeadOffice», and the head office of the
    /// company's staff («Head Office (Care-Pro)»), which is never invoiced.
    /// </summary>
    public string[] ExcludedProjectCodes { get; set; } = ["PRO00137", "HeadOffice", "PRO00148"];

    internal bool IsExcluded(string? code) =>
        code is not null && ExcludedProjectCodes.Any(c => string.Equals(Normalize(c), Normalize(code), StringComparison.Ordinal));

    private static string Normalize(string code) => code.Replace(" ", string.Empty, StringComparison.Ordinal).Trim().ToLowerInvariant();
}

/// <summary>
/// The old system's project invoices during the parallel phase (docs/03-migration-plan/14 §7.1): read from the CRM copy
/// the sync keeps (never from the CRM itself, never written), without the cancelled ones, the non-project types, the
/// excluded projects, and those before the financial start. Kept a few minutes per company.
/// </summary>
internal sealed class LegacyInvoices(ICrmStaging staging, IProjectDirectory projects, ITenantContext tenant, IMemoryCache cache, IOptions<ReportsOptions> options)
{
    internal const int Canceled = 279640007;
    private const int ProjectInvoice = 100000000;
    private static readonly TimeSpan Riyadh = TimeSpan.FromHours(3);

    /// <summary>The CRM's invoice statuses (StringMap of new_invoice.statuscode).</summary>
    internal static readonly IReadOnlyDictionary<int, (string Ar, string En)> Statuses = new Dictionary<int, (string, string)>
    {
        [1] = ("قيد الإعداد", "Under preparation"),
        [2] = ("غير نشطة", "Inactive"),
        [279640000] = ("أُرسلت إلى المالية", "Sent to finance"),
        [279640001] = ("قيد مراجعة المالية", "Under finance review"),
        [279640002] = ("أُرسلت إلى العميل", "Sent to the customer"),
        [279640003] = ("تحصيل جزئي", "Partially collected"),
        [279640004] = ("تم التحصيل بالكامل", "Fully collected"),
        [279640005] = ("روجعت من المالية", "Reviewed by finance"),
        [279640006] = ("أُرسلت إلى مشرف المشروع", "Sent to the project supervisor"),
        [279640007] = ("ملغاة", "Cancelled"),
        [279640008] = ("بانتظار التحصيل", "Awaiting payment"),
    };

    public Task<LegacyFinance> LoadAsync(CancellationToken cancellationToken) =>
        cache.GetOrCreateAsync($"reports.legacy.{tenant.TenantId}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            return await ReadAsync(cancellationToken).ConfigureAwait(false);
        })!;

    private async Task<LegacyFinance> ReadAsync(CancellationToken cancellationToken)
    {
        var from = options.Value.FinanceFrom;
        var raw = new List<(Guid CrmId, JsonElement Row)>();
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
                raw.Add((record.CrmId, document.RootElement));
            }

            var projectIds = raw.Select(r => Id(r.Row, "new_projectid")).OfType<Guid>().Distinct().ToList();
            var known = (await projects.FindAsync([], projectIds, cancellationToken).ConfigureAwait(false)).ToDictionary(p => p.CrmId);
            var invoices = new List<LegacyInvoice>();
            foreach (var (crmId, row) in raw)
            {
                var status = Int(row, "statuscode") ?? 1;
                var type = Int(row, "new_invoicetype");
                if (status == Canceled || type is not (null or ProjectInvoice) || Date(row, "new_todate") is not { } to || to < from)
                {
                    continue;
                }

                var projectId = Id(row, "new_projectid");
                var project = projectId is { } pid ? known.GetValueOrDefault(pid) : null;
                if (options.Value.IsExcluded(project?.Code))
                {
                    continue;
                }

                var beforeVat = Money(row, "new_totalamount") ?? 0;
                var vat = Money(row, "new_totalvatamount") ?? 0;
                invoices.Add(new LegacyInvoice(
                    crmId, Text(row, "new_invoicenumber") ?? "—", projectId, project?.Name ?? Text(row, "new_projectidname") ?? "—",
                    string.IsNullOrWhiteSpace(project?.Manager) ? null : project.Manager.Trim(),
                    to, Date(row, "new_fromdate"), Date(row, "new_invoicedate"), Date(row, "createdon") ?? to, (int)(Money(row, "new_labornumber") ?? 0),
                    beforeVat, vat, Money(row, "new_netsalarywithvat") ?? (beforeVat + vat), Money(row, "new_totalpaidamount") ?? 0, status));
            }

            // The workers on each counted invoice (its lines), for the billing coverage.
            var counted = invoices.Select(i => i.CrmId).ToHashSet();
            var workers = new Dictionary<Guid, HashSet<Guid>>();
            var lines = new List<LegacyLine>();
            foreach (var line in await staging.ChangedSinceAsync("new_invoicdetail", null, cancellationToken).ConfigureAwait(false))
            {
                if (line.IsDeleted)
                {
                    continue;
                }

                using var document = JsonDocument.Parse(line.Payload);
                if (Id(document.RootElement, "new_invoiceid") is { } invoice && counted.Contains(invoice) && Id(document.RootElement, "new_employeeid") is { } employee)
                {
                    (workers.TryGetValue(invoice, out var set) ? set : workers[invoice] = []).Add(employee);
                    var r = document.RootElement;
                    var due = Money(r, "new_duesalary") ?? 0;
                    lines.Add(new LegacyLine(invoice, employee, Money(r, "new_totalwithoutvat") ?? 0, Money(r, "new_workingdays") ?? 0, due,
                        Money(r, "new_abscentdays") ?? 0, Money(r, "new_absencedeductions") ?? 0, Money(r, "new_nettoemployee") ?? due, Money(r, "new_loanamount") ?? 0, Money(r, "new_salesprice") ?? 0));
                }
            }

            return new LegacyFinance(invoices, workers) { Lines = lines };
        }
        finally
        {
            documents.ForEach(d => d.Dispose());
        }
    }

    private static string? Text(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()) ? v.GetString()!.Trim() : null;

    private static Guid? Id(JsonElement row, string field) => Guid.TryParse(Text(row, field), out var id) ? id : null;

    private static int? Int(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;

    private static decimal? Money(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d) ? d : null;

    /// <summary>A CRM date (UTC) as the Riyadh day it means.</summary>
    private static DateOnly? Date(JsonElement row, string field) =>
        DateTimeOffset.TryParse(Text(row, field), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var at) ? DateOnly.FromDateTime(at.ToOffset(Riyadh).DateTime) : null;
}
