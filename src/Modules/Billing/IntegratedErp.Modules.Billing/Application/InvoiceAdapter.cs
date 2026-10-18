using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

/// <summary>
/// Invoices and notes as the approval engine sees them: the fields a process can test and the review it can move the
/// invoice to, the default process (the project's review, then finance's approval — changeable like any process), and
/// the end: approved ⇒ issued with its final number from the numbering screen, never changed again.
/// </summary>
internal sealed class InvoiceAdapter(BillingDbContext db, NumberSequenceService numbering, ILegalEntityDirectory legalEntities, ICurrentUser user, IClock clock)
    : IApprovalRecordAdapter
{
    public const string ScreenCode = "billing.invoice";

    private static readonly RecordFieldOption[] Statuses =
    [
        new(nameof(InvoiceStatus.ProjectReview), "مراجعة المشروع", "Project review"),
        new(nameof(InvoiceStatus.FinanceReview), "مراجعة المالية", "Finance review"),
        new(nameof(InvoiceStatus.Draft), "مسودة", "Draft", Settable: false),
        new(nameof(InvoiceStatus.Returned), "مُعادة للتعديل", "Returned", Settable: false),
        new(nameof(InvoiceStatus.Issued), "صادرة", "Issued", Settable: false),
    ];

    private static readonly RecordFieldOption[] Kinds =
    [
        new(nameof(InvoiceKind.Invoice), "فاتورة", "Invoice", Settable: false),
        new(nameof(InvoiceKind.CreditNote), "إشعار دائن", "Credit note", Settable: false),
        new(nameof(InvoiceKind.DebitNote), "إشعار مدين", "Debit note", Settable: false),
    ];

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>The project's supervisor or manager reviews, then finance approves (the old system's two reviews).</summary>
    private static readonly string DefaultDefinition = JsonSerializer.Serialize(
        new
        {
            startCondition = (object?)null,
            steps = new object[]
            {
                new
                {
                    type = "approval", id = "project-review", label = "مراجعة المشروع",
                    nameAr = "مراجعة مشرف أو مدير المشروع", nameEn = "Project supervisor's or manager's review",
                    assignees = new[] { new { kind = "Permission", permission = BillingPermissions.InvoicesReview } }, rule = "Any",
                    onApprove = new object[]
                    {
                        new { type = "update", id = "to-finance", changes = new[] { new { fieldKey = "status", value = nameof(InvoiceStatus.FinanceReview) } } },
                    },
                },
                new
                {
                    type = "approval", id = "finance", label = "اعتماد المالية",
                    nameAr = "مراجعة المالية واعتماد الإصدار", nameEn = "Finance review and issue",
                    assignees = new[] { new { kind = "Permission", permission = BillingPermissions.InvoicesApprove } }, rule = "Any",
                },
            },
        },
        JsonOptions);

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "فواتير العملاء والإشعارات",
        "Customer invoices and notes",
        "/billing/invoices/{id}",
        [
            new("kind", "نوع المستند", "Document type", RecordFieldType.Choice, Updatable: false, Kinds),
            new("project", "المشروع", "Project", RecordFieldType.Text, Updatable: false),
            new("customer", "العميل", "Customer", RecordFieldType.Text, Updatable: false),
            new("contract_type", "نوع العقد", "Contract type", RecordFieldType.Text, Updatable: false),
            new("month", "الشهر", "Month", RecordFieldType.Date, Updatable: false),
            new("invoice_date", "تاريخ الفاتورة", "Invoice date", RecordFieldType.Date, Updatable: false),
            new("workers", "عدد العمالة", "Number of workers", RecordFieldType.Number, Updatable: false),
            new("amount", "الإجمالي قبل الضريبة", "Amount before VAT", RecordFieldType.Money, Updatable: false),
            new("total", "الإجمالي شامل الضريبة", "Total with VAT", RecordFieldType.Money, Updatable: false),
            new("has_vat_number", "للعميل رقم ضريبي", "Customer has a VAT number", RecordFieldType.Boolean, Updatable: false),
            new("status", "حالة الفاتورة", "Invoice status", RecordFieldType.Choice, Updatable: true, Statuses),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد فواتير العملاء", "Customer invoice approval", DefaultDefinition));

    /// <summary>The approval's title: the document, the project and the month.</summary>
    public static string Title(Invoice i) =>
        $"{(i.Kind switch { InvoiceKind.CreditNote => "إشعار دائن", InvoiceKind.DebitNote => "إشعار مدين", _ => "فاتورة" })} — {i.ProjectName} — {i.Month:yyyy-MM}"
        + (i.OriginalInvoiceNo is { } original ? $" ({original})" : string.Empty);

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var i = await db.Invoices.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (i is null)
        {
            return null;
        }

        var workers = await db.InvoiceWorkers.Where(w => w.InvoiceId == recordId).Select(w => w.WorkerId).Distinct().CountAsync(cancellationToken).ConfigureAwait(false);
        return new Dictionary<string, string?>
        {
            ["kind"] = i.Kind.ToString(),
            ["project"] = i.ProjectName,
            ["customer"] = i.CustomerName,
            ["contract_type"] = i.ContractType,
            ["month"] = i.Month.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["invoice_date"] = i.InvoiceDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["workers"] = workers.ToString(CultureInfo.InvariantCulture),
            ["amount"] = i.Amount.ToString(CultureInfo.InvariantCulture),
            ["total"] = i.Total.ToString(CultureInfo.InvariantCulture),
            ["has_vat_number"] = string.IsNullOrWhiteSpace(i.CustomerVatNumber) ? "false" : "true",
            ["status"] = i.Status.ToString(),
        };
    }

    /// <summary>A process may move the invoice between its reviews while it is in approval.</summary>
    public async Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(changes);
        if (relation is not null || changes.Keys.Any(k => k != "status") || !Enum.TryParse<InvoiceStatus>(changes["status"], out var status))
        {
            return Result.Failure(InvoiceErrors.StatusNotSettable);
        }

        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (invoice is null)
        {
            return Result.Failure(InvoiceErrors.NotFound);
        }

        if (invoice.Status == status)
        {
            return Result.Success(); // idempotent
        }

        var set = invoice.SetStatusFromProcess(status);
        if (set.IsFailure)
        {
            return set;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (invoice is null)
        {
            return Result.Failure(InvoiceErrors.NotFound);
        }

        if (invoice.AwaitingApproval)
        {
            return Result.Success(); // submitted by the invoice itself
        }

        var marked = invoice.MarkSubmitted(clock.UtcNow);
        if (marked.IsFailure)
        {
            return marked;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (invoice is null || !invoice.IsInApproval)
        {
            return;
        }

        if (end != ApprovalEnd.Approved)
        {
            invoice.ApprovalEnded(withdrawn: end == ApprovalEnd.Canceled, comment);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return;
        }

        // Issued: the next number of its series (gap-free: drawn in the transaction that saves it).
        var entities = await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false);
        var seller = entities.FirstOrDefault(e => e.IsActive) is { } e ? new InvoiceSeller(e.NameAr, e.NameEn, e.VatNumber, e.CommercialRegistrationNo) : null;
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, SequenceOf(invoice.Kind), invoice.InvoiceDate, cancellationToken).ConfigureAwait(false);
        invoice.Issue(number, seller, user.DisplayName, comment, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
    }

    internal static string SequenceOf(InvoiceKind kind) => kind switch
    {
        InvoiceKind.CreditNote => "credit_note",
        InvoiceKind.DebitNote => "debit_note",
        _ => "invoice",
    };
}
