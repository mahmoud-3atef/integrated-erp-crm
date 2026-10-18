using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

public sealed record ReceiptRowDto(
    Guid Id, string? ReceiptNo, string Status, Guid ProjectId, string ProjectName, string? CustomerName, DateOnly ReceiptDate, decimal Amount,
    string Method, string? BankAccountName, decimal Allocated, string CreatedByName);

public sealed record ReceiptTotalsDto(int Drafts, int InReview, int Approved, decimal ApprovedAmount, decimal Unallocated);

public sealed record ReceiptListDto(ReceiptTotalsDto Totals, IReadOnlyList<ReceiptRowDto> Rows);

public sealed record OpenItemDto(
    string Kind, Guid Id, string Number, DateOnly Date, DateOnly DueDate, decimal Total, decimal Credited, decimal Paid, decimal Outstanding, decimal Available, int DaysOverdue);

public sealed record ProjectOpenDto(Guid ProjectId, string ProjectName, decimal Outstanding, decimal Credit, IReadOnlyList<OpenItemDto> Items);

/// <summary>
/// One line of a receipt: what it paid of an item, and the item's total and what is left to collect on it now (after
/// every approved receipt).
/// </summary>
public sealed record ReceiptAllocationDto(string Kind, Guid TargetId, string Number, DateOnly? DueDate, decimal Amount, decimal? ItemTotal = null, decimal? ItemOutstanding = null);

public sealed record ReceiptDetailDto(
    Guid Id,
    string? ReceiptNo,
    string Status,
    bool AwaitingApproval,
    Guid ProjectId,
    string ProjectCode,
    string ProjectName,
    string? CustomerName,
    DateOnly ReceiptDate,
    decimal Amount,
    string Method,
    Guid? BankAccountId,
    string? BankAccountName,
    string? Reference,
    string? Notes,
    decimal Allocated,
    decimal Unallocated,
    DateTimeOffset CreatedAt,
    string CreatedByName,
    DateTimeOffset? ApprovedAt,
    string? ApprovedByName,
    string? LastComment,
    IReadOnlyList<ReceiptAllocationDto> Allocations,
    ApprovalStatusInfo? Approval,
    bool CanEdit,
    bool CanAllocate);

public sealed record AgingRowDto(
    Guid ProjectCrmId, Guid? ProjectId, string ProjectName, string? CustomerName, string? Manager,
    decimal Current, decimal Days30, decimal Days60, decimal Days90, decimal Days180, decimal Over180, decimal Total, decimal Credit, decimal Net, int Items);

public sealed record AgingDto(DateOnly AsOf, AgingRowDto Totals, IReadOnlyList<AgingRowDto> Rows);

public sealed record StatementEntryDto(DateOnly Date, string Kind, Guid? DocumentId, string Number, string Description, decimal Debit, decimal Credit, decimal Balance);

public sealed record StatementDto(
    Guid ProjectCrmId, Guid? ProjectId, string ProjectName, string? CustomerName, DateOnly From, DateOnly To, decimal Opening, decimal Debits, decimal Credits, decimal Closing,
    IReadOnlyList<StatementEntryDto> Entries);

public sealed record ReceiptProjectDto(Guid Id, Guid CrmId, string Code, string Name, string? CustomerName, string? Manager, bool IsActive, decimal Outstanding);

public sealed record BankAccountDto(Guid Id, string BankName, string AccountNo, string? Iban, string? Label, string Display, bool IsActive);

internal sealed class ReceivableQueries(
    BillingDbContext db,
    ReceivablesLedger ledger,
    IProjectDirectory projects,
    IApprovalService approvals,
    IPermissionService permissions,
    IClock clock)
{
    public async Task<ReceiptListDto> ReceiptsAsync(DateOnly? from, DateOnly? to, string? status, string? search, CancellationToken cancellationToken)
    {
        var query = db.Receipts.AsNoTracking();
        if (from is { } f)
        {
            query = query.Where(r => r.ReceiptDate >= f);
        }

        if (to is { } t)
        {
            query = query.Where(r => r.ReceiptDate <= t);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(r => (r.ReceiptNo != null && r.ReceiptNo.Contains(s)) || r.ProjectName.Contains(s) || (r.CustomerName != null && r.CustomerName.Contains(s))
                                     || (r.Reference != null && r.Reference.Contains(s)));
        }

        var all = await query.OrderByDescending(r => r.ReceiptDate).ThenByDescending(r => r.CreatedAt).Take(1000)
            .Select(r => new ReceiptRowDto(
                r.Id, r.ReceiptNo, r.Status.ToString(), r.ProjectId, r.ProjectName, r.CustomerName, r.ReceiptDate, r.Amount, r.Method.ToString(), r.BankAccountName,
                r.Allocations.Sum(a => (decimal?)a.Amount) ?? 0, r.CreatedByName))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var approved = all.Where(r => r.Status == nameof(ReceiptStatus.Approved)).ToList();
        var totals = new ReceiptTotalsDto(
            all.Count(r => r.Status is nameof(ReceiptStatus.Draft) or nameof(ReceiptStatus.Returned)),
            all.Count(r => r.Status is nameof(ReceiptStatus.AccountantReview) or nameof(ReceiptStatus.FinanceReview)),
            approved.Count, approved.Sum(r => r.Amount), approved.Sum(r => r.Amount - r.Allocated));
        var rows = status switch
        {
            "Open" => all.Where(r => r.Status is nameof(ReceiptStatus.Draft) or nameof(ReceiptStatus.Returned)),
            "InReview" => all.Where(r => r.Status is nameof(ReceiptStatus.AccountantReview) or nameof(ReceiptStatus.FinanceReview)),
            "Approved" => approved,
            "Unallocated" => approved.Where(r => r.Amount > r.Allocated),
            _ => all,
        };
        return new ReceiptListDto(totals, rows.ToList());
    }

    /// <summary>A project's open items (what a receipt can take; a receipt being edited leaves its own allocations out) and its credit.</summary>
    public async Task<ProjectOpenDto?> OpenAsync(Guid projectId, Guid? exceptReceiptId, CancellationToken cancellationToken)
    {
        var project = await projects.FindAsync([projectId], [], cancellationToken).ConfigureAwait(false) is [var p, ..] ? p : null;
        if (project is null)
        {
            return null;
        }

        var items = await ledger.ItemsAsync(project.CrmId, exceptReceiptId, cancellationToken).ConfigureAwait(false);
        var credits = await ledger.CreditsAsync(items, project.CrmId, cancellationToken).ConfigureAwait(false);
        var today = clock.Today;
        return new ProjectOpenDto(
            project.Id, project.Name, items.Sum(i => i.Outstanding), credits.GetValueOrDefault(project.CrmId),
            items.Where(i => i.Outstanding > 0).Select(i => Open(i, today)).ToList());
    }

    public async Task<ReceiptDetailDto?> ReceiptAsync(Guid id, CancellationToken cancellationToken)
    {
        var r = await db.Receipts.AsNoTracking().Include(x => x.Allocations).FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);
        if (r is null)
        {
            return null;
        }

        var items = (await ledger.ItemsAsync(r.ProjectCrmId, null, cancellationToken).ConfigureAwait(false)).ToDictionary(i => (i.Kind, i.Id));
        var allocations = r.Allocations.Select(a =>
            {
                var item = items.GetValueOrDefault((a.Kind, a.TargetId));
                return new ReceiptAllocationDto(a.Kind.ToString(), a.TargetId, item?.Number ?? "—", item?.DueDate, a.Amount, item?.Total - item?.Credited, item?.Outstanding);
            })
            .OrderBy(a => a.DueDate)
            .ToList();
        var approval = await approvals.StatusAsync(ReceiptAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false);
        var canManage = (await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(BillingPermissions.ReceiptsManage);
        return new ReceiptDetailDto(
            r.Id, r.ReceiptNo, r.Status.ToString(), r.AwaitingApproval, r.ProjectId, r.ProjectCode, r.ProjectName, r.CustomerName, r.ReceiptDate, r.Amount,
            r.Method.ToString(), r.BankAccountId, r.BankAccountName, r.Reference, r.Notes, r.Allocated, r.Unallocated, r.CreatedAt, r.CreatedByName,
            r.ApprovedAt, r.ApprovedByName, r.LastComment, allocations, approval,
            CanEdit: canManage && r.IsEditable,
            CanAllocate: canManage && r.Status == ReceiptStatus.Approved && r.Unallocated > 0);
    }

    /// <summary>
    /// The debts' ages (docs/02-target-architecture/07 §4.4): every project's open items by days past their due date on
    /// <paramref name="asOf"/> (current, 1–30, 31–60, 61–90, 91–180, over 180), its credit, and what it owes net.
    /// </summary>
    public async Task<AgingDto> AgingAsync(DateOnly? asOf, CancellationToken cancellationToken)
    {
        var day = asOf ?? clock.Today;
        var items = await ledger.ItemsAsync(null, null, cancellationToken).ConfigureAwait(false);
        var credits = await ledger.CreditsAsync(items, null, cancellationToken).ConfigureAwait(false);
        var crmIds = items.Where(i => i.Outstanding > 0).Select(i => i.ProjectCrmId).Union(credits.Where(c => c.Value > 0).Select(c => c.Key)).ToList();
        var known = (await projects.FindAsync([], crmIds, cancellationToken).ConfigureAwait(false)).ToDictionary(p => p.CrmId);
        var rows = crmIds.Select(crm =>
            {
                var mine = items.Where(i => i.ProjectCrmId == crm && i.Outstanding > 0).ToList();
                decimal Bucket(int min, int max) => mine.Where(i => Overdue(i, day) >= min && Overdue(i, day) <= max).Sum(i => i.Outstanding);
                var project = known.GetValueOrDefault(crm);
                var total = mine.Sum(i => i.Outstanding);
                var credit = credits.GetValueOrDefault(crm);
                return new AgingRowDto(
                    crm, project?.Id, project?.Name ?? mine.FirstOrDefault()?.ProjectName ?? "—", project?.CustomerName, project?.Manager,
                    Bucket(int.MinValue, 0), Bucket(1, 30), Bucket(31, 60), Bucket(61, 90), Bucket(91, 180), Bucket(181, int.MaxValue), total, credit, total - credit, mine.Count);
            })
            .OrderByDescending(r => r.Net)
            .ToList();
        var totals = new AgingRowDto(
            Guid.Empty, null, string.Empty, null, null, rows.Sum(r => r.Current), rows.Sum(r => r.Days30), rows.Sum(r => r.Days60), rows.Sum(r => r.Days90),
            rows.Sum(r => r.Days180), rows.Sum(r => r.Over180), rows.Sum(r => r.Total), rows.Sum(r => r.Credit), rows.Sum(r => r.Net), rows.Sum(r => r.Items));
        return new AgingDto(day, totals, rows);
    }

    /// <summary>
    /// A project's statement (docs/02-target-architecture/07 §4.4): the balance before <paramref name="from"/>, then every
    /// movement to <paramref name="to"/> — the old system's open invoices, invoices and debit notes (owed), credit notes and
    /// approved receipts (paid) — with the running balance.
    /// </summary>
    public async Task<StatementDto?> StatementAsync(Guid projectKey, DateOnly? from, DateOnly? to, CancellationToken cancellationToken)
    {
        var end = to ?? clock.Today;
        var start = from ?? new DateOnly(end.Year, 1, 1);

        // The project's id here, or its id in the old system (a balance of a project not copied yet has only that).
        var project = await projects.FindAsync([projectKey], [projectKey], cancellationToken).ConfigureAwait(false) is [var p, ..] ? p : null;
        var projectCrmId = project?.CrmId ?? projectKey;
        var entries = new List<(DateOnly Date, string Kind, Guid? Id, string Number, string Description, decimal Debit, decimal Credit)>();
        foreach (var o in await db.OpeningBalances.AsNoTracking().Where(o => o.ProjectCrmId == projectCrmId && o.Amount > 0).ToListAsync(cancellationToken).ConfigureAwait(false))
        {
            entries.Add((o.InvoiceDate, "OpeningBalance", null, o.InvoiceNo, "رصيد فاتورة من النظام السابق", o.Amount, 0));
        }

        foreach (var i in await db.Invoices.AsNoTracking().Where(i => i.ProjectCrmId == projectCrmId && i.Status == InvoiceStatus.Issued).ToListAsync(cancellationToken).ConfigureAwait(false))
        {
            var (description, debit, credit) = i.Kind switch
            {
                InvoiceKind.CreditNote => ($"إشعار دائن على {i.OriginalInvoiceNo} — {i.Reason}", 0m, i.Total),
                InvoiceKind.DebitNote => ($"إشعار مدين على {i.OriginalInvoiceNo} — {i.Reason}", i.Total, 0m),
                _ => ($"فاتورة شهر {i.Month:yyyy-MM}", i.Total, 0m),
            };
            entries.Add((i.InvoiceDate, i.Kind.ToString(), i.Id, i.InvoiceNo ?? "—", description, debit, credit));
        }

        foreach (var r in await db.Receipts.AsNoTracking().Where(r => r.ProjectCrmId == projectCrmId && r.Status == ReceiptStatus.Approved).ToListAsync(cancellationToken).ConfigureAwait(false))
        {
            entries.Add((r.ReceiptDate, "Receipt", r.Id, r.ReceiptNo ?? "—", $"سند قبض{(r.Reference is null ? string.Empty : $" — {r.Reference}")}", 0, r.Amount));
        }

        if (project is null && entries.Count == 0)
        {
            return null;
        }

        var ordered = entries.OrderBy(e => e.Date).ThenByDescending(e => e.Debit).ToList();
        var opening = ordered.Where(e => e.Date < start).Sum(e => e.Debit - e.Credit);
        var balance = opening;
        var lines = new List<StatementEntryDto>();
        foreach (var e in ordered.Where(e => e.Date >= start && e.Date <= end))
        {
            balance += e.Debit - e.Credit;
            lines.Add(new StatementEntryDto(e.Date, e.Kind, e.Id, e.Number, e.Description, e.Debit, e.Credit, balance));
        }

        var name = project?.Name ?? (await db.OpeningBalances.AsNoTracking().Where(o => o.ProjectCrmId == projectCrmId).Select(o => o.ProjectName).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false)) ?? "—";
        return new StatementDto(projectCrmId, project?.Id, name, project?.CustomerName, start, end, opening, lines.Sum(l => l.Debit), lines.Sum(l => l.Credit), balance, lines);
    }

    /// <summary>The projects a receipt can be for: the active ones and any that still owes, with what each owes.</summary>
    public async Task<IReadOnlyList<ReceiptProjectDto>> ProjectsAsync(CancellationToken cancellationToken)
    {
        var items = await ledger.ItemsAsync(null, null, cancellationToken).ConfigureAwait(false);
        var owed = items.GroupBy(i => i.ProjectCrmId).ToDictionary(g => g.Key, g => g.Sum(i => i.Outstanding));
        var active = await projects.ActiveAsync(cancellationToken).ConfigureAwait(false);
        var owing = await projects.FindAsync([], owed.Where(o => o.Value > 0).Select(o => o.Key).ToList(), cancellationToken).ConfigureAwait(false);
        return active.Concat(owing).DistinctBy(p => p.Id)
            .Select(p => new ReceiptProjectDto(p.Id, p.CrmId, p.Code, p.Name, p.CustomerName, p.Manager, p.IsActive, owed.GetValueOrDefault(p.CrmId)))
            .OrderByDescending(p => p.Outstanding).ThenBy(p => p.Name, StringComparer.Ordinal)
            .ToList();
    }

    public async Task<IReadOnlyList<BankAccountDto>> BankAccountsAsync(CancellationToken cancellationToken) =>
        (await db.BankAccounts.AsNoTracking().OrderByDescending(b => b.IsActive).ThenBy(b => b.BankName).ToListAsync(cancellationToken).ConfigureAwait(false))
        .Select(b => new BankAccountDto(b.Id, b.BankName, b.AccountNo, b.Iban, b.Label, b.Display, b.IsActive)).ToList();

    internal static OpenItemDto Open(ReceivableItem i, DateOnly today) =>
        new(i.Kind.ToString(), i.Id, i.Number, i.Date, i.DueDate, i.Total, i.Credited, i.Paid, i.Outstanding, i.Available, Math.Max(0, Overdue(i, today)));

    private static int Overdue(ReceivableItem i, DateOnly day) => day.DayNumber - i.DueDate.DayNumber;
}
