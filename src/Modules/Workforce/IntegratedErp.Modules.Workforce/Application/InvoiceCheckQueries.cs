using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workforce.Application;

public sealed record InvoiceCheckDto(
    Guid Id, Guid? WorkerId, string WorkerNo, string Name, string? ProjectName, string? InvoiceNo, DateOnly From, DateOnly To, decimal MonthDays,
    decimal? WorkingDays, decimal? AbsentDays, decimal? InvoicedPrice, decimal? Amount, decimal? LedgerDays, decimal? LedgerPrice, string? LedgerSources,
    string Result, string Details);

/// <summary>The check of one month: the months there are, counts by result (the cards), the match rate and the lines.</summary>
public sealed record InvoiceCheckListDto(
    IReadOnlyList<DateOnly> Months, DateOnly? Month, IReadOnlyDictionary<string, int> Counts, decimal MatchRate, int Invoices, DateTimeOffset? BuiltAt,
    int Total, IReadOnlyList<InvoiceCheckDto> Items);

/// <summary>The old invoices against the period ledger, month by month.</summary>
internal sealed class InvoiceCheckQueries(WorkforceDbContext db)
{
    public async Task<InvoiceCheckListDto> ListAsync(DateOnly? month, string? result, string? search, int page, int pageSize, CancellationToken cancellationToken)
    {
        var months = await db.InvoiceCheckLines.AsNoTracking().Select(l => l.Month).Distinct().OrderByDescending(m => m)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var state = await db.InvoiceCheckImports.AsNoTracking().FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        var chosen = month is { } m0 ? new DateOnly(m0.Year, m0.Month, 1) : months.Count > 0 ? months[^1] : (DateOnly?)null;
        if (chosen is not { } selected)
        {
            return new InvoiceCheckListDto(months, null, new Dictionary<string, int>(), 0, 0, state?.BuiltAt, 0, []);
        }

        var all = db.InvoiceCheckLines.AsNoTracking().Where(l => l.Month == selected);
        var counts = await all.GroupBy(l => l.Result).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken).ConfigureAwait(false);
        var counted = counts.Where(c => c.Key != InvoiceCheckResults.ProjectNotInvoiced).Sum(c => c.Value);
        var rate = counted == 0 ? 0 : Math.Round(100m * counts.GetValueOrDefault(InvoiceCheckResults.Match) / counted, 1);
        var invoices = await all.Where(l => l.InvoiceNo != null && l.Result != InvoiceCheckResults.ProjectNotInvoiced).Select(l => l.InvoiceNo).Distinct()
            .CountAsync(cancellationToken).ConfigureAwait(false);

        var query = all.Where(l => result == null || l.Result == result);
        if (search?.Trim() is { Length: > 0 } text)
        {
            var upper = text.ToUpperInvariant();
            query = query.Where(l => l.WorkerNo.Contains(upper) || l.Name.Contains(text) || (l.ProjectName != null && l.ProjectName.Contains(text))
                || (l.InvoiceNo != null && l.InvoiceNo.Contains(text)));
        }

        var total = await query.CountAsync(cancellationToken).ConfigureAwait(false);
        var size = Math.Clamp(pageSize, 10, 200);
        // What needs review first, then the projects without an invoice, then the matches.
        var items = await query
            .OrderBy(l => l.Result == InvoiceCheckResults.Match ? 2 : l.Result == InvoiceCheckResults.ProjectNotInvoiced ? 1 : 0)
            .ThenBy(l => l.ProjectName).ThenBy(l => l.WorkerNo)
            .Skip(Math.Max(0, page - 1) * size).Take(size)
            .Select(l => new InvoiceCheckDto(l.Id, l.WorkerId, l.WorkerNo, l.Name, l.ProjectName, l.InvoiceNo, l.From, l.To, l.MonthDays, l.WorkingDays,
                l.AbsentDays, l.InvoicedPrice, l.Amount, l.LedgerDays, l.LedgerPrice, l.LedgerSources, l.Result, l.Details))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return new InvoiceCheckListDto(months, selected, counts, rate, invoices, state?.BuiltAt, total, items);
    }
}
