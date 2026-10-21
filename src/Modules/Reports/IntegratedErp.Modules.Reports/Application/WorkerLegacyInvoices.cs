using IntegratedErp.Modules.Workforce.Contracts;

namespace IntegratedErp.Modules.Reports.Application;

/// <summary>A worker's line on an old-system invoice (read-only: the invoice lives in the old system).</summary>
public sealed record LegacyInvoiceLineDto(
    string InvoiceNo, string ProjectName, DateOnly? From, DateOnly To, DateOnly? InvoiceDate, string StatusAr, string StatusEn, decimal WorkDays, decimal MonthlyPrice, decimal Amount);

/// <summary>One worker's lines on the old system's project invoices (those the reports count), the latest period first.</summary>
internal sealed class WorkerLegacyInvoices(LegacyInvoices legacy, IWorkforceDirectory workforce)
{
    public async Task<IReadOnlyList<LegacyInvoiceLineDto>> ForAsync(Guid workerId, CancellationToken cancellationToken)
    {
        if (await workforce.CardsAsync([workerId], cancellationToken).ConfigureAwait(false) is not [var card, ..])
        {
            return [];
        }

        var finance = await legacy.LoadAsync(cancellationToken).ConfigureAwait(false);
        var invoices = finance.Invoices.ToDictionary(i => i.CrmId);
        return finance.Lines.Where(l => l.WorkerCrmId == card.CrmId && invoices.ContainsKey(l.InvoiceCrmId))
            .Select(l => (Line: l, Invoice: invoices[l.InvoiceCrmId]))
            .OrderByDescending(x => x.Invoice.To)
            .Select(x =>
            {
                var status = LegacyInvoices.Statuses.TryGetValue(x.Invoice.Status, out var s) ? s : ("—", "—");
                return new LegacyInvoiceLineDto(
                    x.Invoice.No, x.Invoice.ProjectName, x.Invoice.From, x.Invoice.To, x.Invoice.InvoiceDate, status.Item1, status.Item2,
                    x.Line.WorkingDays, x.Line.SalesPrice, x.Line.BeforeVat);
            })
            .ToList();
    }
}
