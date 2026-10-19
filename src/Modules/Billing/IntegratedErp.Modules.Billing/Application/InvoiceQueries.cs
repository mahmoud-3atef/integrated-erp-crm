using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

public sealed record InvoiceRowDto(
    Guid Id,
    string Kind,
    string? InvoiceNo,
    string Status,
    bool AwaitingApproval,
    string ProjectName,
    string CustomerName,
    DateOnly Month,
    DateOnly InvoiceDate,
    DateOnly DueDate,
    decimal Amount,
    decimal Vat,
    decimal Total,
    string? TimesheetNo,
    string? OriginalInvoiceNo,
    string CreatedByName);

public sealed record InvoiceTotalsDto(int Drafts, int InReview, int Issued, decimal IssuedTotal, decimal Credits, decimal Debits);

public sealed record InvoiceListDto(InvoiceTotalsDto Totals, IReadOnlyList<InvoiceRowDto> Rows);

public sealed record InvoiceItemDto(int LineNo, string Component, string? Description, decimal Amount);

public sealed record InvoiceWorkerDto(
    Guid WorkerId, string WorkerNo, string Name, string? IqamaNo, string? ProfessionAr, string? ProfessionEn, string? NationalityAr, string? NationalityEn,
    DateOnly LineFrom, DateOnly LineTo, decimal WorkDays, decimal MonthlyPrice, decimal DueSalary, decimal AbsenceDays, decimal AbsenceAmount, decimal DueFees,
    decimal OvertimeHours, decimal Overtime, decimal ClientAdditions, decimal ClientDeductions, decimal CustomerLoans, decimal OtherCosts, decimal Gosi,
    decimal Amount, decimal Vat, decimal Total);

public sealed record PartyDto(string Name, string? NameEn, string? VatNumber, string? CommercialRegistration, string? City);

public sealed record InvoiceDetailDto(
    Guid Id,
    string Kind,
    string? InvoiceNo,
    string Status,
    bool AwaitingApproval,
    Guid? TimesheetId,
    string? TimesheetNo,
    Guid? OriginalInvoiceId,
    string? OriginalInvoiceNo,
    Guid ProjectId,
    string ProjectCode,
    string ProjectName,
    string? ContractType,
    PartyDto Customer,
    PartyDto? Seller,
    DateOnly Month,
    DateOnly PeriodFrom,
    DateOnly PeriodTo,
    DateOnly InvoiceDate,
    int? PaymentTermDays,
    DateOnly DueDate,
    decimal VatRate,
    decimal Amount,
    decimal Vat,
    decimal Total,
    string? Reason,
    string? Remarks,
    DateTimeOffset CreatedAt,
    string CreatedByName,
    DateTimeOffset? IssuedAt,
    string? IssuedByName,
    string? LastComment,
    IReadOnlyList<InvoiceItemDto> Items,
    IReadOnlyList<InvoiceWorkerDto> Workers,
    IReadOnlyList<InvoiceRowDto> Notes,
    decimal NetAmount,
    decimal Creditable,
    decimal Paid,
    decimal Outstanding,
    IReadOnlyList<string> Warnings,
    ApprovalStatusInfo? Approval,
    bool CanEdit,
    bool CanSubmit,
    bool CanDelete,
    bool CanNote,
    IReadOnlyList<InvoicePaymentDto>? Payments = null);

/// <summary>A receipt that pays (or, in review, will pay) part of an invoice: its number, date and the amount here.</summary>
public sealed record InvoicePaymentDto(Guid ReceiptId, string? ReceiptNo, DateOnly ReceiptDate, decimal Amount, string Status, DateTimeOffset? ApprovedAt);

/// <summary>A timesheet's invoice, as the timesheet screens show it.</summary>
public sealed record InvoiceRefDto(Guid Id, string? InvoiceNo, string Status);

internal sealed class InvoiceQueries(
    BillingDbContext db,
    InvoiceService service,
    ReceivablesLedger ledger,
    IReferenceData reference,
    ILegalEntityDirectory legalEntities,
    IApprovalService approvals,
    IPermissionService permissions)
{
    /// <summary>Invoices and notes, newest first: of a month (the cycle's month), a status, a kind, or matching a search.</summary>
    public async Task<InvoiceListDto> ListAsync(DateOnly? month, string? status, string? kind, string? search, CancellationToken cancellationToken)
    {
        var query = db.Invoices.AsNoTracking();
        if (month is { } m)
        {
            var first = new DateOnly(m.Year, m.Month, 1);
            query = query.Where(i => i.Month == first);
        }

        if (Enum.TryParse<InvoiceKind>(kind, out var k))
        {
            query = query.Where(i => i.Kind == k);
        }

        var totals = await query.GroupBy(_ => 1).Select(g => new InvoiceTotalsDto(
                g.Count(i => i.Status == InvoiceStatus.Draft || i.Status == InvoiceStatus.Returned),
                g.Count(i => i.Status == InvoiceStatus.ProjectReview || i.Status == InvoiceStatus.FinanceReview),
                g.Count(i => i.Status == InvoiceStatus.Issued && i.Kind == InvoiceKind.Invoice),
                g.Where(i => i.Status == InvoiceStatus.Issued && i.Kind == InvoiceKind.Invoice).Sum(i => (decimal?)i.Total) ?? 0,
                g.Where(i => i.Status == InvoiceStatus.Issued && i.Kind == InvoiceKind.CreditNote).Sum(i => (decimal?)i.Total) ?? 0,
                g.Where(i => i.Status == InvoiceStatus.Issued && i.Kind == InvoiceKind.DebitNote).Sum(i => (decimal?)i.Total) ?? 0))
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false) ?? new InvoiceTotalsDto(0, 0, 0, 0, 0, 0);

        query = status switch
        {
            "Open" => query.Where(i => i.Status == InvoiceStatus.Draft || i.Status == InvoiceStatus.Returned),
            "InReview" => query.Where(i => i.Status == InvoiceStatus.ProjectReview || i.Status == InvoiceStatus.FinanceReview),
            "Issued" => query.Where(i => i.Status == InvoiceStatus.Issued),
            _ => query,
        };
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(i => (i.InvoiceNo != null && i.InvoiceNo.Contains(s)) || i.ProjectName.Contains(s) || i.CustomerName.Contains(s) || i.ProjectCode.Contains(s)
                                     || (i.TimesheetNo != null && i.TimesheetNo.Contains(s)));
        }

        var rows = await query.OrderByDescending(i => i.CreatedAt).Take(500).Select(Row()).ToListAsync(cancellationToken).ConfigureAwait(false);
        return new InvoiceListDto(totals, rows);
    }

    public async Task<InvoiceDetailDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var i = await db.Invoices.AsNoTracking().Include(x => x.Items).Include(x => x.Workers).FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);
        if (i is null)
        {
            return null;
        }

        var professions = (await reference.ListAllAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false)).ToDictionary(r => r.Code, StringComparer.Ordinal);
        var nationalities = (await reference.ListAllAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false)).ToDictionary(r => r.Code, StringComparer.Ordinal);
        var workers = i.Workers.OrderBy(l => l.WorkerNo, StringComparer.Ordinal).ThenBy(l => l.LineFrom).Select(l =>
            {
                var p = l.ProfessionCode is { } pc ? professions.GetValueOrDefault(pc) : null;
                var n = l.NationalityCode is { } nc ? nationalities.GetValueOrDefault(nc) : null;
                return new InvoiceWorkerDto(
                    l.WorkerId, l.WorkerNo, l.Name, l.IqamaNo, p?.NameAr, p?.NameEn, n?.NameAr, n?.NameEn, l.LineFrom, l.LineTo, l.WorkDays, l.MonthlyPrice,
                    l.DueSalary, l.AbsenceDays, l.AbsenceAmount, l.DueFees, l.OvertimeHours, l.Overtime, l.ClientAdditions, l.ClientDeductions, l.CustomerLoans,
                    l.OtherCosts, l.Gosi, l.Amount, l.Vat, l.Total);
            })
            .ToList();

        var notes = i.Kind == InvoiceKind.Invoice
            ? await db.Invoices.AsNoTracking().Where(n => n.OriginalInvoiceId == i.Id).OrderBy(n => n.CreatedAt).Select(Row()).ToListAsync(cancellationToken).ConfigureAwait(false)
            : [];
        var issuedNotes = notes.Where(n => n.Status == nameof(InvoiceStatus.Issued)).ToList();
        var net = i.Amount + issuedNotes.Where(n => n.Kind == nameof(InvoiceKind.DebitNote)).Sum(n => n.Amount) - issuedNotes.Where(n => n.Kind == nameof(InvoiceKind.CreditNote)).Sum(n => n.Amount);
        var creditable = i.Kind == InvoiceKind.Invoice && i.Status == InvoiceStatus.Issued ? await service.CreditableAsync(i, cancellationToken).ConfigureAwait(false) : 0;

        // The issuing registration is fixed on issue; a draft shows the one it would take.
        PartyDto? seller;
        if (i.SellerName is not null)
        {
            seller = new PartyDto(i.SellerName, i.SellerNameEn, i.SellerVatNumber, i.SellerRegistration, null);
        }
        else
        {
            var entity = (await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).FirstOrDefault(e => e.IsActive);
            seller = entity is null ? null : new PartyDto(entity.NameAr, entity.NameEn, entity.VatNumber, entity.CommercialRegistrationNo, null);
        }

        var item = i.Status == InvoiceStatus.Issued && i.Kind != InvoiceKind.CreditNote
            ? (await ledger.ItemsAsync(i.ProjectCrmId, null, cancellationToken).ConfigureAwait(false)).FirstOrDefault(x => x.Id == i.Id)
            : null;

        var warnings = new List<string>();
        if (string.IsNullOrWhiteSpace(i.CustomerVatNumber))
        {
            warnings.Add("no_customer_vat");
        }

        if (seller?.VatNumber is null)
        {
            warnings.Add("no_seller_vat");
        }

        // The receipts on this invoice (drafts are not counted yet), oldest first.
        var payments = await (from a in db.ReceiptAllocations.AsNoTracking()
                              join r in db.Receipts.AsNoTracking() on a.ReceiptId equals r.Id
                              where a.TargetId == id && r.Status != ReceiptStatus.Draft
                              orderby r.ReceiptDate, r.CreatedAt
                              select new InvoicePaymentDto(r.Id, r.ReceiptNo, r.ReceiptDate, a.Amount, r.Status.ToString(), r.ApprovedAt))
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        var approval = await approvals.StatusAsync(InvoiceAdapter.ScreenCode, id, cancellationToken).ConfigureAwait(false);
        var canManage = (await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(BillingPermissions.InvoicesManage);
        return new InvoiceDetailDto(
            i.Id, i.Kind.ToString(), i.InvoiceNo, i.Status.ToString(), i.AwaitingApproval, i.TimesheetId, i.TimesheetNo, i.OriginalInvoiceId, i.OriginalInvoiceNo,
            i.ProjectId, i.ProjectCode, i.ProjectName, i.ContractType,
            new PartyDto(i.CustomerName, i.CustomerNameEn, i.CustomerVatNumber, i.CustomerRegistration, i.CustomerCity), seller,
            i.Month, i.PeriodFrom, i.PeriodTo, i.InvoiceDate, i.PaymentTermDays, i.DueDate, i.VatRate, i.Amount, i.Vat, i.Total, i.Reason, i.Remarks,
            i.CreatedAt, i.CreatedByName, i.IssuedAt, i.IssuedByName, i.LastComment,
            i.Items.OrderBy(x => x.LineNo).Select(x => new InvoiceItemDto(x.LineNo, x.Component.ToString(), x.Description, x.Amount)).ToList(),
            workers, notes, net, creditable, item?.Paid ?? 0, item?.Outstanding ?? 0, warnings, approval,
            CanEdit: canManage && i.IsEditable,
            CanSubmit: canManage && i.IsEditable,
            CanDelete: canManage && i.IsEditable,
            CanNote: canManage && i.Kind == InvoiceKind.Invoice && i.Status == InvoiceStatus.Issued,
            Payments: payments);
    }

    private static System.Linq.Expressions.Expression<Func<Invoice, InvoiceRowDto>> Row() => i => new InvoiceRowDto(
        i.Id, i.Kind.ToString(), i.InvoiceNo, i.Status.ToString(), i.AwaitingApproval, i.ProjectName, i.CustomerName, i.Month, i.InvoiceDate, i.DueDate,
        i.Amount, i.Vat, i.Total, i.TimesheetNo, i.OriginalInvoiceNo, i.CreatedByName);
}
