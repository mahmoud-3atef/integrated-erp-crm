using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workforce.Application;

/// <summary>
/// The attendance check (docs/03-migration-plan/04 slice 1.5): the old system's project invoices (new_invoice,
/// new_invoicdetail) against the period ledger, line by line: the days on the project in the invoice's period
/// (the invoice's working days: an absent day is still a day on the project, deducted from the amount) and the monthly
/// price. Workers the ledger has on an invoiced project without a line are listed too. An invoice belongs to the month
/// its period ends in (some projects are invoiced from the 21st to the 20th). From September 2026: before it the
/// invoices were made from spreadsheets without checking the periods. Rebuilt after every sync in which the invoices
/// or the ledger changed.
/// </summary>
internal sealed class InvoiceCheckBuilder(WorkforceDbContext db, ICrmStaging staging, IClock clock) : ICrmStagingConsumer
{
    private static readonly TimeSpan Riyadh = TimeSpan.FromHours(3);

    /// <summary>The first month whose invoices were matched with the periods before being made.</summary>
    public static readonly DateOnly CheckFrom = new(2026, 9, 1);

    private const int ProjectInvoice = 100000000;
    private const int Canceled = 279640007;

    public string Name => "attendance check";

    public async Task<string> ApplyAsync(CancellationToken cancellationToken)
    {
        var state = await db.InvoiceCheckImports.FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (state is null)
        {
            state = new InvoiceCheckImport();
            db.InvoiceCheckImports.Add(state);
        }

        var invoiceChanges = await staging.ChangedSinceAsync("new_invoice", state.InvoicesWatermark, cancellationToken).ConfigureAwait(false);
        var lineChanges = await staging.ChangedSinceAsync("new_invoicdetail", state.LinesWatermark, cancellationToken).ConfigureAwait(false);
        var signature = await LedgerSignatureAsync(cancellationToken).ConfigureAwait(false);
        if (state.BuiltAt is not null && invoiceChanges.Count == 0 && lineChanges.Count == 0 && signature == state.LedgerSignature)
        {
            return "no changes";
        }

        var allInvoices = state.InvoicesWatermark is null ? invoiceChanges : await staging.ChangedSinceAsync("new_invoice", null, cancellationToken).ConfigureAwait(false);
        var allLines = state.LinesWatermark is null ? lineChanges : await staging.ChangedSinceAsync("new_invoicdetail", null, cancellationToken).ConfigureAwait(false);

        // The project invoices of the checked months (not canceled).
        var invoices = new Dictionary<Guid, Invoice>();
        foreach (var record in allInvoices.Where(r => !r.IsDeleted))
        {
            using var document = JsonDocument.Parse(record.Payload);
            var row = document.RootElement;
            if (Int(row, "statecode") is not (null or 0) || Int(row, "statuscode") == Canceled || Int(row, "new_invoicetype") is not (null or ProjectInvoice)
                || Date(row, "new_fromdate") is not { } from || Date(row, "new_todate") is not { } to || to < CheckFrom || to < from)
            {
                continue;
            }

            var days = (to.DayNumber - from.DayNumber) + 1;
            invoices[record.CrmId] = new Invoice(record.CrmId, Text(row, "new_invoicenumber") ?? "—", new DateOnly(to.Year, to.Month, 1), from, to,
                Money(row, "new_monthdays") is { } md and > 0 ? md : days, Id(row, "new_projectid"), Text(row, "new_projectidname"));
        }

        var lines = new List<Line>();
        foreach (var record in allLines.Where(r => !r.IsDeleted))
        {
            using var document = JsonDocument.Parse(record.Payload);
            var row = document.RootElement;
            if (Int(row, "statecode") is not (null or 0) || Id(row, "new_invoiceid") is not { } invoiceId || !invoices.TryGetValue(invoiceId, out var invoice)
                || Id(row, "new_employeeid") is not { } worker)
            {
                continue;
            }

            lines.Add(new Line(invoice, worker, Text(row, "new_empidnumber"), Text(row, "new_employeeidname"),
                Id(row, "new_projectid") ?? invoice.ProjectCrmId, Text(row, "new_projectidname") ?? invoice.ProjectName,
                Money(row, "new_workingdays") ?? 0, Money(row, "new_abscentdays") ?? 0, Money(row, "new_salesprice"), Money(row, "new_totalwithoutvat")));
        }

        var workers = await db.Workers.AsNoTracking().Where(w => w.Kind == WorkerKind.Worker)
            .Join(db.People, w => w.PersonId, p => p.Id, (w, p) => new { w.Id, w.CrmId, w.WorkerNo, p.NameEn })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var byCrm = workers.GroupBy(w => w.CrmId).ToDictionary(g => g.Key, g => g.First());
        var timeline = invoices.Count == 0 ? [] : await WorkPeriodsAsync(invoices.Values.Min(i => i.From), invoices.Values.Max(i => i.To), cancellationToken).ConfigureAwait(false);
        var work = timeline.ToLookup(p => p.WorkerId);

        var checks = new List<InvoiceCheckLine>();
        foreach (var line in lines)
        {
            var known = byCrm.GetValueOrDefault(line.Worker);
            var invoice = line.Invoice;
            var invoicedDays = line.WorkingDays;
            var mine = known is null ? [] : work[known.Id].Where(p => p.Kind == PeriodKind.Work && p.ProjectCrmId == line.ProjectCrmId).ToList();
            var (days, price, sources) = Measure(mine, invoice);
            string result;
            string details;
            if (known is null)
            {
                result = InvoiceCheckResults.NotInLedger;
                details = "العامل غير موجود في هذا النظام.";
            }
            else if (days == 0)
            {
                result = InvoiceCheckResults.NotInLedger;
                details = $"لا يضعه السجل على «{line.ProjectName}» في فترة الفاتورة؛ في السجل: {Where(work[known.Id], invoice)}.";
            }
            else
            {
                var daysDiffer = days != invoicedDays;
                var priceDiffers = price is null || line.Price is null || Math.Abs(price.Value - line.Price.Value) >= 0.01m;
                result = (daysDiffer, priceDiffers) switch
                {
                    (false, false) => InvoiceCheckResults.Match,
                    (true, false) => InvoiceCheckResults.DaysDiff,
                    (false, true) => InvoiceCheckResults.PriceDiff,
                    _ => InvoiceCheckResults.DaysAndPriceDiff,
                };
                var parts = new List<string>();
                if (daysDiffer)
                {
                    parts.Add($"الفاتورة {Num(invoicedDays)} يوم عمل{(line.AbsentDays > 0 ? $" (منها غياب {Num(line.AbsentDays)})" : string.Empty)} والسجل {Num(days)} يومًا ({Spans(mine, invoice)})");
                }

                if (priceDiffers)
                {
                    parts.Add(price is null ? $"سعر الفاتورة {Num(line.Price ?? 0)} ولا سعر في السجل" : $"سعر الفاتورة {Num(line.Price ?? 0)} والسجل {Num(price.Value)}");
                }

                details = parts.Count == 0 ? "مطابق." : string.Join("؛ ", parts) + ".";
            }

            checks.Add(new InvoiceCheckLine(invoice.Month, known?.Id, known?.WorkerNo ?? line.WorkerNo ?? "—", known?.NameEn ?? line.Name ?? "—",
                line.ProjectCrmId, line.ProjectName, invoice.No, invoice.From, invoice.To, invoice.MonthDays, line.WorkingDays, line.AbsentDays, line.Price, line.Amount,
                known is null ? null : days, price, sources, result, details));
        }

        // The ledger's workers on a project in a checked month without a line on its invoice.
        var invoiced = lines.Select(l => (l.Invoice.Month, l.Worker, l.ProjectCrmId)).ToHashSet();
        var projectInvoices = invoices.Values.Where(i => i.ProjectCrmId is not null).ToLookup(i => (i.Month, i.ProjectCrmId!.Value));
        var months = invoices.Values.Select(i => i.Month).Distinct().ToList();
        var crmOf = workers.ToDictionary(w => w.Id);
        foreach (var month in months)
        {
            var end = month.AddMonths(1).AddDays(-1);
            foreach (var group in timeline.Where(p => p.Kind == PeriodKind.Work && p.ProjectCrmId is not null && p.StartsOn <= end && (p.EndsOn is null || p.EndsOn > month))
                         .GroupBy(p => (p.WorkerId, ProjectCrmId: p.ProjectCrmId!.Value)))
            {
                if (!crmOf.TryGetValue(group.Key.WorkerId, out var worker) || invoiced.Contains((month, worker.CrmId, group.Key.ProjectCrmId)))
                {
                    continue;
                }

                var invoice = projectInvoices[(month, group.Key.ProjectCrmId)].FirstOrDefault()
                    ?? new Invoice(Guid.Empty, null, month, month, end, 30, group.Key.ProjectCrmId, group.First().ProjectName);
                var periods = group.ToList();
                var (days, price, sources) = Measure(periods, invoice);
                if (days == 0)
                {
                    continue;
                }

                var hasInvoice = invoice.CrmId != Guid.Empty;
                checks.Add(new InvoiceCheckLine(month, worker.Id, worker.WorkerNo, worker.NameEn, group.Key.ProjectCrmId, periods[0].ProjectName, invoice.No,
                    invoice.From, invoice.To, invoice.MonthDays, null, null, null, null, days, price, sources,
                    hasInvoice ? InvoiceCheckResults.NotInvoiced : InvoiceCheckResults.ProjectNotInvoiced,
                    hasInvoice
                        ? $"في السجل {Num(days)} يومًا على «{periods[0].ProjectName}» ({Spans(periods, invoice)}) وليس في الفاتورة {invoice.No}."
                        : $"في السجل {Num(days)} يومًا على «{periods[0].ProjectName}» ({Spans(periods, invoice)}) ولا فاتورة للمشروع في الشهر."));
            }
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await db.InvoiceCheckLines.ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);
        db.InvoiceCheckLines.AddRange(checks);
        var counted = checks.Where(c => c.Result != InvoiceCheckResults.ProjectNotInvoiced).ToList();
        var rate = counted.Count == 0 ? 0 : 100m * counted.Count(c => c.Result == InvoiceCheckResults.Match) / counted.Count;
        var summary = $"{invoices.Count} invoices, {lines.Count} lines; {rate.ToString("0.0", CultureInfo.InvariantCulture)}% match";
        state.Built(
            invoiceChanges.Count > 0 ? invoiceChanges.Max(r => r.LastSyncedAt) : null,
            lineChanges.Count > 0 ? lineChanges.Max(r => r.LastSyncedAt) : null,
            signature, clock.UtcNow, summary);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return summary;
    }

    /// <summary>The ledger as last built and recorded: a new history build or any recorded period change alters it.</summary>
    private async Task<string> LedgerSignatureAsync(CancellationToken cancellationToken)
    {
        var built = await db.HistoryImports.AsNoTracking().Select(i => i.BuiltAt).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        var recorded = await db.Periods.AsNoTracking().CountAsync(cancellationToken).ConfigureAwait(false);
        var closed = await db.Periods.AsNoTracking().CountAsync(p => p.EndsOn != null, cancellationToken).ConfigureAwait(false);
        return FormattableString.Invariant($"{built:O}|{recorded}|{closed}");
    }

    /// <summary>
    /// Every worker's periods overlapping the range, as the timeline shows them: the old system's history up to the
    /// worker's first period recorded here, then the recorded periods.
    /// </summary>
    private async Task<List<WorkSpan>> WorkPeriodsAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var after = to.AddDays(1);
        var firstRecorded = await db.Periods.AsNoTracking().GroupBy(p => p.WorkerId).Select(g => new { g.Key, First = g.Min(p => p.StartsOn) })
            .ToDictionaryAsync(x => x.Key, x => x.First, cancellationToken).ConfigureAwait(false);
        var recorded = await db.Periods.AsNoTracking()
            .Where(p => p.StartsOn < after && (p.EndsOn == null || p.EndsOn > from))
            .Select(p => new WorkSpan(p.WorkerId, p.Kind, p.ProjectCrmId, p.ProjectName, p.StartsOn, p.EndsOn, p.Rate.TotalPrice, p.SourceNo))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var history = await db.HistoryPeriods.AsNoTracking()
            .Where(p => p.StartsOn < after && (p.EndsOn == null || p.EndsOn > from))
            .Select(p => new WorkSpan(p.WorkerId, p.Kind, p.ProjectCrmId, p.Place, p.StartsOn, p.EndsOn, p.Rate.TotalPrice, p.SourceNo))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var trimmed = history
            .Select(p => firstRecorded.TryGetValue(p.WorkerId, out var over)
                ? p.StartsOn >= over ? null : p with { EndsOn = p.EndsOn is null || p.EndsOn > over ? over : p.EndsOn }
                : p)
            .OfType<WorkSpan>()
            .Where(p => p.EndsOn is null || p.EndsOn > from);
        return recorded.Concat(trimmed).ToList();
    }

    /// <summary>
    /// The days the periods give in the invoice's period (a fully covered period counts as the invoice's month days),
    /// the price of the longest of them, and their documents.
    /// </summary>
    private static (decimal Days, decimal? Price, string? Sources) Measure(IReadOnlyList<WorkSpan> periods, Invoice invoice)
    {
        var length = invoice.To.DayNumber - invoice.From.DayNumber + 1;
        var parts = periods
            .Select(p => (Period: p, Days: Overlap(p, invoice)))
            .Where(x => x.Days > 0)
            .ToList();
        if (parts.Count == 0)
        {
            return (0, null, null);
        }

        var total = parts.Sum(x => x.Days);
        var days = total >= length ? invoice.MonthDays : Math.Min(total, invoice.MonthDays);
        var longest = parts.MaxBy(x => x.Days).Period;
        return (days, longest.Price > 0 ? longest.Price : null, string.Join("، ", parts.Select(x => x.Period.SourceNo).Distinct()));
    }

    private static int Overlap(WorkSpan period, Invoice invoice)
    {
        var start = period.StartsOn > invoice.From ? period.StartsOn : invoice.From;
        var after = invoice.To.AddDays(1);
        var end = period.EndsOn is { } e && e < after ? e : after;
        return Math.Max(0, end.DayNumber - start.DayNumber);
    }

    private static string Spans(IEnumerable<WorkSpan> periods, Invoice invoice) =>
        string.Join("، ", periods.Where(p => Overlap(p, invoice) > 0).OrderBy(p => p.StartsOn).Select(p =>
        {
            var start = p.StartsOn > invoice.From ? p.StartsOn : invoice.From;
            var last = p.EndsOn is { } e && e <= invoice.To ? e.AddDays(-1) : invoice.To;
            return $"{p.SourceNo} من {start:MM-dd} إلى {last:MM-dd}";
        }));

    /// <summary>Where the ledger has the worker during the invoice's period, for the details.</summary>
    private static string Where(IEnumerable<WorkSpan> periods, Invoice invoice)
    {
        var inside = periods.Where(p => Overlap(p, invoice) > 0).OrderBy(p => p.StartsOn).ToList();
        return inside.Count == 0
            ? "لا فترة له"
            : string.Join("، ", inside.Select(p => p.Kind switch
            {
                PeriodKind.Work => $"عمل على «{p.ProjectName}»",
                PeriodKind.Housing => "سكن",
                PeriodKind.Vacation => "إجازة",
                PeriodKind.Out => "خروج",
                _ => p.Kind.ToString(),
            } + $" من {(p.StartsOn > invoice.From ? p.StartsOn : invoice.From):MM-dd} ({p.SourceNo})"));
    }

    private static string Num(decimal value) => value.ToString("0.##", CultureInfo.InvariantCulture);

    private sealed record Invoice(Guid CrmId, string? No, DateOnly Month, DateOnly From, DateOnly To, decimal MonthDays, Guid? ProjectCrmId, string? ProjectName);

    private sealed record Line(Invoice Invoice, Guid Worker, string? WorkerNo, string? Name, Guid? ProjectCrmId, string? ProjectName,
        decimal WorkingDays, decimal AbsentDays, decimal? Price, decimal? Amount);

    private sealed record WorkSpan(Guid WorkerId, PeriodKind Kind, Guid? ProjectCrmId, string? ProjectName, DateOnly StartsOn, DateOnly? EndsOn, decimal Price, string SourceNo);

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
