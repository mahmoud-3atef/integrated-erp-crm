using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

/// <summary>
/// An item a project owes: an issued invoice (less its issued credit notes), an issued debit note, or a balance read from
/// the old system — with what approved receipts paid of it. A credit note larger than what is left of its invoice leaves
/// the difference to the project as credit (<see cref="Overpaid"/>).
/// </summary>
public sealed record ReceivableItem(
    ReceivableKind Kind,
    Guid Id,
    Guid ProjectCrmId,
    string ProjectName,
    string Number,
    DateOnly Date,
    DateOnly DueDate,
    decimal Total,
    decimal Credited,
    decimal Paid,
    decimal Reserved)
{
    /// <summary>What is left to collect.</summary>
    public decimal Outstanding => Math.Max(0, Total - Credited - Paid);

    /// <summary>What a receipt may still take: less what receipts on their way (in approval) already took.</summary>
    public decimal Available => Math.Max(0, Outstanding - Reserved);

    public decimal Overpaid => Math.Max(0, Credited + Paid - Total);
}

/// <summary>The project accounts (docs/02-target-architecture/07 §4.1): the balance of a project is the sum of its movements.</summary>
internal sealed class ReceivablesLedger(BillingDbContext db)
{
    /// <summary>
    /// The items of one project (or all), with what approved receipts paid of each; receipts in approval (other than
    /// <paramref name="exceptReceiptId"/>) are counted as reserved.
    /// </summary>
    public async Task<List<ReceivableItem>> ItemsAsync(Guid? projectCrmId, Guid? exceptReceiptId, CancellationToken cancellationToken)
    {
        var documents = await db.Invoices.AsNoTracking()
            .Where(i => i.Status == InvoiceStatus.Issued && (projectCrmId == null || i.ProjectCrmId == projectCrmId))
            .Select(i => new { i.Id, i.Kind, i.ProjectCrmId, i.ProjectName, i.InvoiceNo, i.InvoiceDate, i.DueDate, i.Total, i.OriginalInvoiceId })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var openings = await db.OpeningBalances.AsNoTracking()
            .Where(o => o.Amount > 0 && (projectCrmId == null || o.ProjectCrmId == projectCrmId))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var allocations = await db.ReceiptAllocations.AsNoTracking()
            .Join(db.Receipts, a => a.ReceiptId, r => r.Id, (a, r) => new { a.Kind, a.TargetId, a.Amount, r.Id, r.Status, r.AwaitingApproval, r.ProjectCrmId })
            .Where(x => (projectCrmId == null || x.ProjectCrmId == projectCrmId) && x.Id != exceptReceiptId && (x.Status == ReceiptStatus.Approved || x.AwaitingApproval))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        decimal Paid(ReceivableKind kind, Guid id) => allocations.Where(a => a.Kind == kind && a.TargetId == id && a.Status == ReceiptStatus.Approved).Sum(a => a.Amount);
        decimal Reserved(ReceivableKind kind, Guid id) => allocations.Where(a => a.Kind == kind && a.TargetId == id && a.Status != ReceiptStatus.Approved).Sum(a => a.Amount);

        var credits = documents.Where(d => d.Kind == InvoiceKind.CreditNote).GroupBy(d => d.OriginalInvoiceId).ToDictionary(g => g.Key!.Value, g => g.Sum(d => d.Total));
        var items = documents.Where(d => d.Kind != InvoiceKind.CreditNote).Select(d =>
            {
                var kind = d.Kind == InvoiceKind.DebitNote ? ReceivableKind.DebitNote : ReceivableKind.Invoice;
                return new ReceivableItem(kind, d.Id, d.ProjectCrmId, d.ProjectName, d.InvoiceNo ?? "—", d.InvoiceDate, d.DueDate, d.Total,
                    credits.GetValueOrDefault(d.Id), Paid(kind, d.Id), Reserved(kind, d.Id));
            })
            .ToList();
        items.AddRange(openings.Select(o => new ReceivableItem(
            ReceivableKind.OpeningBalance, o.Id, o.ProjectCrmId, o.ProjectName, o.InvoiceNo, o.InvoiceDate, o.DueDate, o.Amount, 0,
            Paid(ReceivableKind.OpeningBalance, o.Id), Reserved(ReceivableKind.OpeningBalance, o.Id))));
        return items.OrderBy(i => i.DueDate).ThenBy(i => i.Number, StringComparer.Ordinal).ToList();
    }

    /// <summary>What each item can still take, keyed for <see cref="Receipt.Set"/>.</summary>
    public static Dictionary<(ReceivableKind, Guid), decimal> Open(IEnumerable<ReceivableItem> items) =>
        items.ToDictionary(i => (i.Kind, i.Id), i => i.Available);

    /// <summary>The oldest due first, until the amount runs out.</summary>
    public static List<AllocationInput> Auto(IEnumerable<ReceivableItem> items, decimal amount)
    {
        var result = new List<AllocationInput>();
        foreach (var item in items.Where(i => i.Available > 0).OrderBy(i => i.DueDate).ThenBy(i => i.Date))
        {
            if (amount <= 0)
            {
                break;
            }

            var take = Math.Min(amount, item.Available);
            result.Add(new AllocationInput(item.Kind, item.Id, take));
            amount -= take;
        }

        return result;
    }

    /// <summary>Each project's credit: approved receipts not yet allocated, and credit notes beyond what was left of their invoice.</summary>
    public async Task<Dictionary<Guid, decimal>> CreditsAsync(IReadOnlyList<ReceivableItem> items, Guid? projectCrmId, CancellationToken cancellationToken)
    {
        var receipts = await db.Receipts.AsNoTracking()
            .Where(r => r.Status == ReceiptStatus.Approved && (projectCrmId == null || r.ProjectCrmId == projectCrmId))
            .Select(r => new { r.ProjectCrmId, r.Amount, Allocated = r.Allocations.Sum(a => (decimal?)a.Amount) ?? 0 })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var credits = receipts.GroupBy(r => r.ProjectCrmId).ToDictionary(g => g.Key, g => g.Sum(r => r.Amount - r.Allocated));
        foreach (var item in items.Where(i => i.Overpaid > 0))
        {
            credits[item.ProjectCrmId] = credits.GetValueOrDefault(item.ProjectCrmId) + item.Overpaid;
        }

        return credits;
    }
}
