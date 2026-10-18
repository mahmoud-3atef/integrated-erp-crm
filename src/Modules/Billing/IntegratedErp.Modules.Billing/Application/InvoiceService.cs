using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

public sealed record InvoiceEditInput(DateOnly InvoiceDate, int? PaymentTermDays, string? Remarks);

public sealed record NoteItemDto(string Component, string? Description, decimal Amount);

public sealed record NoteInput(string Kind, DateOnly Date, string Reason, IReadOnlyList<NoteItemDto> Items);

/// <summary>
/// Customer invoices (docs/02-target-architecture/07): the monthly invoice made from an approved timesheet, credit and
/// debit notes on an issued invoice, the draft's terms, and sending them through the company's review process. The
/// number is given on issue (<see cref="InvoiceAdapter"/>).
/// </summary>
internal sealed class InvoiceService(
    BillingDbContext db,
    IProjectDirectory projects,
    IApprovalService approvals,
    ICurrentUser user,
    IClock clock)
{
    /// <summary>The approved timesheet's invoice, as a draft (one per timesheet).</summary>
    public async Task<Result<Guid>> CreateFromTimesheetAsync(Guid timesheetId, CancellationToken cancellationToken)
    {
        var timesheet = await db.Timesheets.AsNoTracking().Include(t => t.Lines).FirstOrDefaultAsync(t => t.Id == timesheetId, cancellationToken).ConfigureAwait(false);
        if (timesheet is null)
        {
            return Result.Failure<Guid>(TimesheetErrors.NotFound);
        }

        if (await db.Invoices.AnyAsync(i => i.TimesheetId == timesheetId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(InvoiceErrors.Exists);
        }

        var billTo = await projects.BillToAsync(timesheet.ProjectId, cancellationToken).ConfigureAwait(false);
        var buyer = billTo is null
            ? new InvoiceBuyer(null, timesheet.CustomerName ?? timesheet.ProjectName, null, null, null, null)
            : new InvoiceBuyer(billTo.CustomerId, billTo.Name, billTo.NameEn, billTo.VatNumber, billTo.CommercialRegistration, billTo.City);
        var setting = await db.ProjectSettings.AsNoTracking().FirstOrDefaultAsync(s => s.ProjectId == timesheet.ProjectId, cancellationToken).ConfigureAwait(false)
            ?? ProjectBillingSetting.Default(timesheet.ProjectId);
        var made = Invoice.FromTimesheet(timesheet, buyer, setting.VatRate, user.DisplayName, clock.UtcNow);
        if (made.IsFailure)
        {
            return Result.Failure<Guid>(made.Error);
        }

        db.Invoices.Add(made.Value);
        try
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (DbUpdateException)
        {
            return Result.Failure<Guid>(InvoiceErrors.Exists); // made at the same moment by someone else
        }

        return Result.Success(made.Value.Id);
    }

    public async Task<Result> EditAsync(Guid id, InvoiceEditInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var invoice = await db.Invoices.FirstOrDefaultAsync(i => i.Id == id, cancellationToken).ConfigureAwait(false);
        if (invoice is null)
        {
            return Result.Failure(InvoiceErrors.NotFound);
        }

        var edited = invoice.Edit(input.InvoiceDate, input.PaymentTermDays, input.Remarks);
        if (edited.IsFailure)
        {
            return edited;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>A draft has no number yet, so it is simply deleted (e.g. to make it again).</summary>
    public async Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.Include(i => i.Items).Include(i => i.Workers).FirstOrDefaultAsync(i => i.Id == id, cancellationToken).ConfigureAwait(false);
        if (invoice is null)
        {
            return Result.Failure(InvoiceErrors.NotFound);
        }

        if (!invoice.IsEditable || invoice.InvoiceNo is not null)
        {
            return Result.Failure(InvoiceErrors.NotEditable);
        }

        db.Invoices.Remove(invoice);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>A credit or debit note on an issued invoice; a credit cannot exceed what is left of it.</summary>
    public async Task<Result<Guid>> CreateNoteAsync(Guid invoiceId, NoteInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!Enum.TryParse<InvoiceKind>(input.Kind, out var kind) || kind == InvoiceKind.Invoice)
        {
            return Result.Failure<Guid>(InvoiceErrors.NoteOriginal);
        }

        var items = new List<NoteItemInput>();
        foreach (var item in input.Items ?? [])
        {
            if (!Enum.TryParse<InvoiceComponent>(item.Component, out var component))
            {
                return Result.Failure<Guid>(InvoiceErrors.NoteItems);
            }

            items.Add(new NoteItemInput(component, item.Description, item.Amount));
        }

        var original = await db.Invoices.AsNoTracking().FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken).ConfigureAwait(false);
        if (original is null)
        {
            return Result.Failure<Guid>(InvoiceErrors.NotFound);
        }

        var creditable = await CreditableAsync(original, cancellationToken).ConfigureAwait(false);
        var made = Invoice.Note(original, kind, input.Date, input.Reason, items, creditable, user.DisplayName, clock.UtcNow);
        if (made.IsFailure)
        {
            return Result.Failure<Guid>(made.Error);
        }

        db.Invoices.Add(made.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(made.Value.Id);
    }

    public async Task<Result> SubmitAsync(Guid id, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.FirstOrDefaultAsync(i => i.Id == id, cancellationToken).ConfigureAwait(false);
        if (invoice is null)
        {
            return Result.Failure(InvoiceErrors.NotFound);
        }

        // A credit note's room may have shrunk since it was made (another credit issued meanwhile).
        if (invoice.Kind == InvoiceKind.CreditNote)
        {
            var original = await db.Invoices.AsNoTracking().FirstAsync(i => i.Id == invoice.OriginalInvoiceId, cancellationToken).ConfigureAwait(false);
            if (invoice.Amount > await CreditableAsync(original, cancellationToken, except: invoice.Id).ConfigureAwait(false))
            {
                return Result.Failure(InvoiceErrors.NoteOverInvoice);
            }
        }

        var marked = invoice.MarkSubmitted(clock.UtcNow);
        if (marked.IsFailure)
        {
            return marked;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var started = await approvals.SubmitAsync(new ApprovalSubmission(InvoiceAdapter.ScreenCode, invoice.Id, InvoiceAdapter.Title(invoice)), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            invoice.SubmissionFailed();
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure(started.Error);
        }

        return Result.Success();
    }

    /// <summary>The detailed attachment: the invoice's workers, their days and amounts (Excel).</summary>
    public async Task<(byte[] Content, string FileName)?> AttachmentAsync(Guid id, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.AsNoTracking().Include(i => i.Workers).FirstOrDefaultAsync(i => i.Id == id, cancellationToken).ConfigureAwait(false);
        return invoice is null ? null : (InvoiceWorkbook.Build(invoice), InvoiceWorkbook.FileName(invoice));
    }

    /// <summary>What a credit may still take off an invoice: its amount plus its debits, less its credits (issued or on the way).</summary>
    internal async Task<decimal> CreditableAsync(Invoice original, CancellationToken cancellationToken, Guid? except = null)
    {
        var notes = await db.Invoices.AsNoTracking()
            .Where(n => n.OriginalInvoiceId == original.Id && n.Id != except && (n.Status == InvoiceStatus.Issued || n.Kind == InvoiceKind.CreditNote && n.AwaitingApproval))
            .Select(n => new { n.Kind, n.Amount })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return original.Amount
            + notes.Where(n => n.Kind == InvoiceKind.DebitNote).Sum(n => n.Amount)
            - notes.Where(n => n.Kind == InvoiceKind.CreditNote).Sum(n => n.Amount);
    }
}
