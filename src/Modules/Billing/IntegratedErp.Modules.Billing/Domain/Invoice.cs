using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Billing.Domain;

/// <summary>The monthly invoice made from an approved timesheet, or a note correcting an issued invoice.</summary>
public enum InvoiceKind
{
    Invoice,

    /// <summary>Lowers an issued invoice (the replacement for cancelling it).</summary>
    CreditNote,

    /// <summary>Raises an issued invoice (e.g. days not billed, a raise with past effect).</summary>
    DebitNote,
}

/// <summary>
/// Where an invoice stands (docs/02-target-architecture/07 §2.4): a draft, reviewed by the project then by finance
/// (the company's process, changeable), and issued: numbered and never changed or cancelled again.
/// </summary>
public enum InvoiceStatus
{
    Draft,
    ProjectReview,
    FinanceReview,

    /// <summary>Sent back by a reviewer: changed and sent again.</summary>
    Returned,

    Issued,
}

/// <summary>A line of the tax invoice: the month's totals of one part of the price (07 §2.2).</summary>
public enum InvoiceComponent
{
    /// <summary>The workers' salaries after the absence.</summary>
    Salary,
    ServiceFee,

    /// <summary>Housing billed on its own.</summary>
    Housing,

    /// <summary>Transport billed on its own.</summary>
    Transport,
    Overtime,
    ClientAddition,
    OtherCost,

    /// <summary>GOSI (Cost Plus).</summary>
    Gosi,

    /// <summary>The customer's deductions and loans: an allowance on the whole invoice (a negative amount).</summary>
    Discount,
}

/// <summary>Who the invoice is addressed to, as the project's customer has it.</summary>
public sealed record InvoiceBuyer(Guid? CustomerId, string Name, string? NameEn, string? VatNumber, string? CommercialRegistration, string? City);

/// <summary>The company's registration issuing the invoice.</summary>
public sealed record InvoiceSeller(string Name, string? NameEn, string? VatNumber, string? CommercialRegistration);

/// <summary>A note's line as entered: which part of the price, what for, and the amount before VAT.</summary>
public sealed record NoteItemInput(InvoiceComponent Component, string? Description, decimal Amount);

/// <summary>
/// A customer invoice (docs/02-target-architecture/07): the monthly invoice copied from an approved timesheet — the tax
/// invoice by totals, the workers in the detailed attachment — or a credit or debit note on an issued invoice. Issued,
/// it takes its final number and is never changed or cancelled; it is corrected by notes only.
/// </summary>
public sealed class Invoice : ITenantOwned
{
    private readonly List<InvoiceItem> _items = [];
    private readonly List<InvoiceWorkerLine> _workers = [];

    private Invoice()
    {
        ProjectCode = string.Empty;
        ProjectName = string.Empty;
        CustomerName = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public InvoiceKind Kind { get; private set; }

    /// <summary>The final number, given on issue (none while a draft: a draft can be deleted without a gap).</summary>
    public string? InvoiceNo { get; private set; }

    public Guid? TimesheetId { get; private set; }

    public string? TimesheetNo { get; private set; }

    /// <summary>The issued invoice a note corrects.</summary>
    public Guid? OriginalInvoiceId { get; private set; }

    public string? OriginalInvoiceNo { get; private set; }

    public Guid ProjectId { get; private set; }

    public Guid ProjectCrmId { get; private set; }

    public string ProjectCode { get; private set; }

    public string ProjectName { get; private set; }

    public string? ContractType { get; private set; }

    public Guid? CustomerId { get; private set; }

    public string CustomerName { get; private set; }

    public string? CustomerNameEn { get; private set; }

    public string? CustomerVatNumber { get; private set; }

    public string? CustomerRegistration { get; private set; }

    public string? CustomerCity { get; private set; }

    /// <summary>The first day of the month the billing cycle ends in.</summary>
    public DateOnly Month { get; private set; }

    public DateOnly PeriodFrom { get; private set; }

    public DateOnly PeriodTo { get; private set; }

    public DateOnly InvoiceDate { get; private set; }

    /// <summary>Days to pay; none: due on the invoice date.</summary>
    public int? PaymentTermDays { get; private set; }

    public DateOnly DueDate { get; private set; }

    public decimal VatRate { get; private set; }

    public decimal Amount { get; private set; }

    public decimal Vat { get; private set; }

    public decimal Total { get; private set; }

    /// <summary>Why a note is issued (required on a note).</summary>
    public string? Reason { get; private set; }

    public string? Remarks { get; private set; }

    public InvoiceStatus Status { get; private set; }

    public bool AwaitingApproval { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset? SubmittedAt { get; private set; }

    public DateTimeOffset? IssuedAt { get; private set; }

    public string? IssuedByName { get; private set; }

    public string? LastComment { get; private set; }

    public string? SellerName { get; private set; }

    public string? SellerNameEn { get; private set; }

    public string? SellerVatNumber { get; private set; }

    public string? SellerRegistration { get; private set; }

    public IReadOnlyList<InvoiceItem> Items => _items;

    public IReadOnlyList<InvoiceWorkerLine> Workers => _workers;

    public bool IsEditable => Status is InvoiceStatus.Draft or InvoiceStatus.Returned && !AwaitingApproval;

    public bool IsInApproval => AwaitingApproval && Status is InvoiceStatus.ProjectReview or InvoiceStatus.FinanceReview;

    /// <summary>
    /// The monthly invoice of an approved timesheet: dated the cycle's last day, its lines the month's totals per part
    /// of the price, its workers the timesheet's lines. Its totals are the timesheet's, to the halala.
    /// </summary>
    /// <param name="duringApproval">Made by the timesheet's own process at one of its stages: its figures are locked while in approval.</param>
    public static Result<Invoice> FromTimesheet(Timesheet timesheet, InvoiceBuyer buyer, decimal vatRate, string by, DateTimeOffset at, bool duringApproval = false)
    {
        ArgumentNullException.ThrowIfNull(timesheet);
        ArgumentNullException.ThrowIfNull(buyer);
        if (timesheet.Status != TimesheetStatus.Approved && !(duringApproval && timesheet.IsInApproval))
        {
            return Result.Failure<Invoice>(InvoiceErrors.TimesheetNotApproved);
        }

        var invoice = new Invoice
        {
            Id = Guid.CreateVersion7(),
            Kind = InvoiceKind.Invoice,
            TimesheetId = timesheet.Id,
            TimesheetNo = timesheet.TimesheetNo,
            ProjectId = timesheet.ProjectId,
            ProjectCrmId = timesheet.ProjectCrmId,
            ProjectCode = timesheet.ProjectCode,
            ProjectName = timesheet.ProjectName,
            ContractType = timesheet.ContractType,
            Month = timesheet.Month,
            PeriodFrom = timesheet.From,
            PeriodTo = timesheet.To,
            InvoiceDate = timesheet.To,
            DueDate = timesheet.To,
            VatRate = vatRate,
            Status = InvoiceStatus.Draft,
            CreatedAt = at,
            CreatedByName = by,
        };
        invoice.SetBuyer(buyer);
        var filled = invoice.Fill(timesheet.Lines);
        return filled.IsSuccess ? Result.Success(invoice) : Result.Failure<Invoice>(filled.Error);
    }

    /// <summary>A draft follows its timesheet (not yet sent for approval, no number); once sent or issued, it locks the timesheet.</summary>
    public bool FollowsTimesheet => TimesheetId is not null && IsEditable && InvoiceNo is null;

    /// <summary>The draft again from its timesheet's figures, after the timesheet changed (the user's request, 2026-10-23).</summary>
    public Result RefreshFrom(Timesheet timesheet)
    {
        ArgumentNullException.ThrowIfNull(timesheet);
        if (!FollowsTimesheet || timesheet.Id != TimesheetId)
        {
            return Result.Failure(InvoiceErrors.NotEditable);
        }

        PeriodFrom = timesheet.From;
        PeriodTo = timesheet.To;
        _items.Clear();
        _workers.Clear();
        return Fill(timesheet.Lines);
    }

    /// <summary>The invoice's items, workers and totals from the timesheet's lines.</summary>
    private Result Fill(IReadOnlyList<TimesheetLine> lines)
    {
        if (lines.Count == 0)
        {
            return Result.Failure(TimesheetErrors.Empty);
        }

        if (lines.Any(l => l.TotalPrice <= 0 || l.WorkDays <= 0))
        {
            return Result.Failure(TimesheetErrors.NoPrice);
        }

        var invoice = this;

        // Housing and transport billed on their own leave the service fee; otherwise they stay in it.
        var housing = lines.Where(l => l.HousingBillable).Sum(l => l.DueHousing);
        var transport = lines.Where(l => l.TransportBillable).Sum(l => l.DueTransport);
        invoice.AddItem(InvoiceComponent.Salary, lines.Sum(l => l.DueSalary - l.AbsenceAmount));
        invoice.AddItem(InvoiceComponent.ServiceFee, lines.Sum(l => l.DueFees) - housing - transport);
        invoice.AddItem(InvoiceComponent.Housing, housing);
        invoice.AddItem(InvoiceComponent.Transport, transport);
        invoice.AddItem(InvoiceComponent.Overtime, lines.Sum(l => l.Overtime));
        invoice.AddItem(InvoiceComponent.ClientAddition, lines.Sum(l => l.ClientAdditions));
        invoice.AddItem(InvoiceComponent.OtherCost, lines.Sum(l => l.OtherCosts));
        invoice.AddItem(InvoiceComponent.Gosi, lines.Sum(l => l.Gosi));
        invoice.AddItem(InvoiceComponent.Discount, -lines.Sum(l => l.ClientDeductions + l.CustomerLoans));
        invoice._workers.AddRange(lines.OrderBy(l => l.WorkerNo, StringComparer.Ordinal).ThenBy(l => l.LineFrom).Select(l => new InvoiceWorkerLine(invoice.Id, l)));

        // The VAT is the timesheet lines' (each rounded as the old template did); the totals must agree with them.
        invoice.Amount = lines.Sum(l => l.InvoiceAmount);
        invoice.Vat = lines.Sum(l => l.Vat);
        invoice.Total = lines.Sum(l => l.InvoiceTotal);
        return invoice._items.Sum(i => i.Amount) == invoice.Amount && invoice.Amount + invoice.Vat == invoice.Total
            ? Result.Success()
            : Result.Failure(InvoiceErrors.Mismatch);
    }

    /// <summary>
    /// A credit or debit note on an issued invoice, with its reason and lines (amounts before VAT, at the invoice's
    /// rate). A credit cannot lower the invoice below zero: <paramref name="creditable"/> is what is left of it.
    /// </summary>
    public static Result<Invoice> Note(Invoice original, InvoiceKind kind, DateOnly date, string? reason, IReadOnlyList<NoteItemInput> items, decimal creditable, string by, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(original);
        ArgumentNullException.ThrowIfNull(items);
        if (kind == InvoiceKind.Invoice || original.Kind != InvoiceKind.Invoice || original.Status != InvoiceStatus.Issued)
        {
            return Result.Failure<Invoice>(InvoiceErrors.NoteOriginal);
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            return Result.Failure<Invoice>(InvoiceErrors.NoteReason);
        }

        if (items.Count == 0 || items.Any(i => i.Amount <= 0 || i.Component == InvoiceComponent.Discount || (i.Description?.Length ?? 0) > 300))
        {
            return Result.Failure<Invoice>(InvoiceErrors.NoteItems);
        }

        var amount = items.Sum(i => Math.Round(i.Amount, 2, MidpointRounding.AwayFromZero));
        if (kind == InvoiceKind.CreditNote && amount > creditable)
        {
            return Result.Failure<Invoice>(InvoiceErrors.NoteOverInvoice);
        }

        if (date < original.InvoiceDate)
        {
            return Result.Failure<Invoice>(InvoiceErrors.NoteDate);
        }

        var note = new Invoice
        {
            Id = Guid.CreateVersion7(),
            Kind = kind,
            OriginalInvoiceId = original.Id,
            OriginalInvoiceNo = original.InvoiceNo,
            ProjectId = original.ProjectId,
            ProjectCrmId = original.ProjectCrmId,
            ProjectCode = original.ProjectCode,
            ProjectName = original.ProjectName,
            ContractType = original.ContractType,
            Month = original.Month,
            PeriodFrom = original.PeriodFrom,
            PeriodTo = original.PeriodTo,
            InvoiceDate = date,
            DueDate = date,
            VatRate = original.VatRate,
            Reason = reason.Trim(),
            Status = InvoiceStatus.Draft,
            CreatedAt = at,
            CreatedByName = by,
        };
        note.SetBuyer(new InvoiceBuyer(original.CustomerId, original.CustomerName, original.CustomerNameEn, original.CustomerVatNumber, original.CustomerRegistration, original.CustomerCity));
        foreach (var item in items)
        {
            note.AddItem(item.Component, Math.Round(item.Amount, 2, MidpointRounding.AwayFromZero), string.IsNullOrWhiteSpace(item.Description) ? null : item.Description.Trim());
        }

        note.Amount = amount;
        note.Vat = Math.Round(amount * note.VatRate, 2, MidpointRounding.AwayFromZero);
        note.Total = note.Amount + note.Vat;
        return Result.Success(note);
    }

    /// <summary>The draft's date, payment term and remarks.</summary>
    public Result Edit(DateOnly date, int? paymentTermDays, string? remarks)
    {
        if (!IsEditable)
        {
            return Result.Failure(InvoiceErrors.NotEditable);
        }

        if (paymentTermDays is < 0 or > 365 || (remarks?.Length ?? 0) > 1000)
        {
            return Result.Failure(InvoiceErrors.Terms);
        }

        if (Kind == InvoiceKind.Invoice && date < PeriodFrom)
        {
            return Result.Failure(InvoiceErrors.Date);
        }

        InvoiceDate = date;
        PaymentTermDays = paymentTermDays;
        DueDate = date.AddDays(paymentTermDays ?? 0);
        Remarks = string.IsNullOrWhiteSpace(remarks) ? null : remarks.Trim();
        return Result.Success();
    }

    public Result MarkSubmitted(DateTimeOffset at)
    {
        if (!IsEditable)
        {
            return Result.Failure(InvoiceErrors.NotEditable);
        }

        Status = InvoiceStatus.ProjectReview;
        AwaitingApproval = true;
        SubmittedAt = at;
        return Result.Success();
    }

    /// <summary>The approval could not start: the invoice stays a draft.</summary>
    public void SubmissionFailed()
    {
        Status = InvoiceStatus.Draft;
        AwaitingApproval = false;
    }

    /// <summary>A process step moves the invoice between its reviews (e.g. "to finance").</summary>
    public Result SetStatusFromProcess(InvoiceStatus status)
    {
        if (!IsInApproval || status is not (InvoiceStatus.ProjectReview or InvoiceStatus.FinanceReview))
        {
            return Result.Failure(InvoiceErrors.StatusNotSettable);
        }

        Status = status;
        return Result.Success();
    }

    /// <summary>Approved: the final number, the issuing registration, and locked for good.</summary>
    public void Issue(string number, InvoiceSeller? seller, string by, string? comment, DateTimeOffset at)
    {
        InvoiceNo = number;
        Status = InvoiceStatus.Issued;
        AwaitingApproval = false;
        IssuedAt = at;
        IssuedByName = by;
        LastComment = comment;
        SellerName = seller?.Name;
        SellerNameEn = seller?.NameEn;
        SellerVatNumber = seller?.VatNumber;
        SellerRegistration = seller?.CommercialRegistration;
    }

    /// <summary>The approval ended without approving: back to be changed (or a draft again when withdrawn).</summary>
    public void ApprovalEnded(bool withdrawn, string? comment)
    {
        Status = withdrawn ? InvoiceStatus.Draft : InvoiceStatus.Returned;
        AwaitingApproval = false;
        LastComment = comment;
    }

    private void SetBuyer(InvoiceBuyer buyer)
    {
        CustomerId = buyer.CustomerId;
        CustomerName = buyer.Name;
        CustomerNameEn = buyer.NameEn;
        CustomerVatNumber = buyer.VatNumber;
        CustomerRegistration = buyer.CommercialRegistration;
        CustomerCity = buyer.City;
    }

    private void AddItem(InvoiceComponent component, decimal amount, string? description = null)
    {
        if (amount != 0)
        {
            _items.Add(new InvoiceItem(Id, _items.Count + 1, component, description, amount));
        }
    }
}

/// <summary>A line of the tax invoice: a part of the price, its description, and the amount before VAT.</summary>
public sealed class InvoiceItem : ITenantOwned
{
    private InvoiceItem()
    {
    }

    internal InvoiceItem(Guid invoiceId, int lineNo, InvoiceComponent component, string? description, decimal amount)
    {
        Id = Guid.CreateVersion7();
        InvoiceId = invoiceId;
        LineNo = lineNo;
        Component = component;
        Description = description;
        Amount = amount;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid InvoiceId { get; private set; }

    public int LineNo { get; private set; }

    public InvoiceComponent Component { get; private set; }

    public string? Description { get; private set; }

    /// <summary>Before VAT; negative for the discount.</summary>
    public decimal Amount { get; private set; }
}

/// <summary>A worker's line in the invoice's detailed attachment, copied from the timesheet line (kept for tracing and reports).</summary>
public sealed class InvoiceWorkerLine : ITenantOwned
{
    private InvoiceWorkerLine()
    {
        WorkerNo = string.Empty;
        Name = string.Empty;
    }

    internal InvoiceWorkerLine(Guid invoiceId, TimesheetLine l)
        : this()
    {
        Id = Guid.CreateVersion7();
        InvoiceId = invoiceId;
        TimesheetLineId = l.Id;
        PeriodKey = l.PeriodKey;
        WorkerId = l.WorkerId;
        WorkerNo = l.WorkerNo;
        Name = l.Name;
        IqamaNo = l.IqamaNo;
        ProfessionCode = l.ProfessionCode;
        NationalityCode = l.NationalityCode;
        LineFrom = l.LineFrom;
        LineTo = l.LineTo;
        WorkDays = l.WorkDays;
        MonthlyPrice = l.TotalPrice;
        DueSalary = l.DueSalary;
        AbsenceDays = l.AbsenceDays;
        AbsenceAmount = l.AbsenceAmount;
        DueFees = l.DueFees;
        DueHousing = l.DueHousing;
        DueTransport = l.DueTransport;
        OvertimeHours = l.OvertimeHours;
        Overtime = l.Overtime;
        ClientAdditions = l.ClientAdditions;
        ClientDeductions = l.ClientDeductions;
        CustomerLoans = l.CustomerLoans;
        OtherCosts = l.OtherCosts;
        Gosi = l.Gosi;
        Amount = l.InvoiceAmount;
        Vat = l.Vat;
        Total = l.InvoiceTotal;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid InvoiceId { get; private set; }

    public Guid TimesheetLineId { get; private set; }

    public string? PeriodKey { get; private set; }

    public Guid WorkerId { get; private set; }

    public string WorkerNo { get; private set; }

    public string Name { get; private set; }

    public string? IqamaNo { get; private set; }

    public string? ProfessionCode { get; private set; }

    public string? NationalityCode { get; private set; }

    public DateOnly LineFrom { get; private set; }

    public DateOnly LineTo { get; private set; }

    public decimal WorkDays { get; private set; }

    public decimal MonthlyPrice { get; private set; }

    public decimal DueSalary { get; private set; }

    public decimal AbsenceDays { get; private set; }

    public decimal AbsenceAmount { get; private set; }

    public decimal DueFees { get; private set; }

    public decimal DueHousing { get; private set; }

    public decimal DueTransport { get; private set; }

    public decimal OvertimeHours { get; private set; }

    public decimal Overtime { get; private set; }

    public decimal ClientAdditions { get; private set; }

    public decimal ClientDeductions { get; private set; }

    public decimal CustomerLoans { get; private set; }

    public decimal OtherCosts { get; private set; }

    public decimal Gosi { get; private set; }

    public decimal Amount { get; private set; }

    public decimal Vat { get; private set; }

    public decimal Total { get; private set; }
}

public static class InvoiceErrors
{
    public static readonly Error NotFound = Error.NotFound("invoice", "Invoice not found.");
    public static readonly Error TimesheetNotApproved = Error.Conflict("invoice_timesheet_not_approved", "Only an approved timesheet makes an invoice.");
    public static readonly Error Exists = Error.Conflict("invoice_exists", "The timesheet already has its invoice.");
    public static readonly Error Mismatch = Error.Conflict("invoice_mismatch", "The invoice's totals do not agree with the timesheet's.");
    public static readonly Error NotEditable = Error.Conflict("invoice_not_editable", "Only a draft or returned invoice can be changed or deleted.");
    public static readonly Error Terms = Error.Validation("invoice_terms", "Check the payment term (0–365 days) and the remarks.");
    public static readonly Error Date = Error.Validation("invoice_date", "The invoice date cannot be before the billing cycle.");
    public static readonly Error StatusNotSettable = Error.Validation("invoice_status_not_settable", "A process can only move the invoice between its reviews.");
    public static readonly Error NoteOriginal = Error.Conflict("invoice_note_original", "A note is made on an issued invoice only.");
    public static readonly Error NoteReason = Error.Validation("invoice_note_reason", "A note needs its reason.");
    public static readonly Error NoteItems = Error.Validation("invoice_note_items", "Enter the note's lines, each with an amount above zero.");
    public static readonly Error NoteOverInvoice = Error.Validation("invoice_note_over", "The credit exceeds what is left of the invoice.");
    public static readonly Error NoteDate = Error.Validation("invoice_note_date", "A note cannot be dated before its invoice.");
}
