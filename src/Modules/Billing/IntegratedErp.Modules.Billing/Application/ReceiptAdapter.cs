using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

/// <summary>
/// Receipt vouchers as the approval engine sees them: the accountant's review, then finance's approval (changeable), and
/// the end: approved ⇒ numbered from the numbering screen, its allocations paying the project's invoices. When the
/// allocations no longer fit (another receipt took the same invoices), it goes back to be fixed.
/// </summary>
internal sealed class ReceiptAdapter(BillingDbContext db, ReceivablesLedger ledger, NumberSequenceService numbering, ICurrentUser user, IClock clock)
    : IApprovalRecordAdapter
{
    public const string ScreenCode = "billing.receipt";

    private static readonly RecordFieldOption[] Statuses =
    [
        new(nameof(ReceiptStatus.AccountantReview), "مراجعة المحاسب", "Accountant review"),
        new(nameof(ReceiptStatus.FinanceReview), "مراجعة المالية", "Finance review"),
        new(nameof(ReceiptStatus.Draft), "مسودة", "Draft", Settable: false),
        new(nameof(ReceiptStatus.Returned), "مُعاد للتعديل", "Returned", Settable: false),
        new(nameof(ReceiptStatus.Approved), "معتمد", "Approved", Settable: false),
    ];

    private static readonly RecordFieldOption[] Methods =
    [
        new(nameof(PaymentMethod.BankTransfer), "تحويل بنكي", "Bank transfer", Settable: false),
        new(nameof(PaymentMethod.Cash), "نقدي", "Cash", Settable: false),
        new(nameof(PaymentMethod.Card), "شبكة", "Card", Settable: false),
    ];

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly string DefaultDefinition = JsonSerializer.Serialize(
        new
        {
            startCondition = (object?)null,
            steps = new object[]
            {
                new
                {
                    type = "approval", id = "accountant", label = "مراجعة المحاسب",
                    nameAr = "مراجعة المحاسب", nameEn = "Accountant's review",
                    assignees = new[] { new { kind = "Permission", permission = BillingPermissions.ReceiptsReview } }, rule = "Any",
                    onApprove = new object[]
                    {
                        new { type = "update", id = "to-finance", changes = new[] { new { fieldKey = "status", value = nameof(ReceiptStatus.FinanceReview) } } },
                    },
                },
                new
                {
                    type = "approval", id = "finance", label = "اعتماد المالية",
                    nameAr = "اعتماد المالية", nameEn = "Finance approval",
                    assignees = new[] { new { kind = "Permission", permission = BillingPermissions.ReceiptsApprove } }, rule = "Any",
                },
            },
        },
        JsonOptions);

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "سندات القبض",
        "Receipt vouchers",
        "/billing/receipts/{id}",
        [
            new("project", "المشروع", "Project", RecordFieldType.Text, Updatable: false),
            new("customer", "العميل", "Customer", RecordFieldType.Text, Updatable: false),
            new("receipt_date", "تاريخ القبض", "Receipt date", RecordFieldType.Date, Updatable: false),
            new("amount", "المبلغ", "Amount", RecordFieldType.Money, Updatable: false),
            new("method", "طريقة الدفع", "Payment method", RecordFieldType.Choice, Updatable: false, Methods),
            new("unallocated", "غير الموزع على الفواتير", "Not allocated to invoices", RecordFieldType.Money, Updatable: false),
            new("status", "حالة السند", "Receipt status", RecordFieldType.Choice, Updatable: true, Statuses),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد سندات القبض", "Receipt voucher approval", DefaultDefinition));

    public static string Title(Receipt r) => $"سند قبض — {r.ProjectName} — {r.Amount.ToString("#,##0.##", CultureInfo.InvariantCulture)}";

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var r = await db.Receipts.AsNoTracking().Include(x => x.Allocations).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        return r is null
            ? null
            : new Dictionary<string, string?>
            {
                ["project"] = r.ProjectName,
                ["customer"] = r.CustomerName,
                ["receipt_date"] = r.ReceiptDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                ["amount"] = r.Amount.ToString(CultureInfo.InvariantCulture),
                ["method"] = r.Method.ToString(),
                ["unallocated"] = r.Unallocated.ToString(CultureInfo.InvariantCulture),
                ["status"] = r.Status.ToString(),
            };
    }

    public async Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(changes);
        if (relation is not null || changes.Keys.Any(k => k != "status") || !Enum.TryParse<ReceiptStatus>(changes["status"], out var status))
        {
            return Result.Failure(ReceiptErrors.StatusNotSettable);
        }

        var receipt = await db.Receipts.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (receipt is null)
        {
            return Result.Failure(ReceiptErrors.NotFound);
        }

        if (receipt.Status == status)
        {
            return Result.Success();
        }

        var set = receipt.SetStatusFromProcess(status);
        if (set.IsFailure)
        {
            return set;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var receipt = await db.Receipts.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (receipt is null)
        {
            return Result.Failure(ReceiptErrors.NotFound);
        }

        if (receipt.AwaitingApproval)
        {
            return Result.Success();
        }

        var marked = receipt.MarkSubmitted(clock.UtcNow);
        if (marked.IsFailure)
        {
            return marked;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        var receipt = await db.Receipts.Include(x => x.Allocations).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (receipt is null || !receipt.IsInApproval)
        {
            return;
        }

        if (end != ApprovalEnd.Approved)
        {
            receipt.ApprovalEnded(withdrawn: end == ApprovalEnd.Canceled, comment);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return;
        }

        var items = await ledger.ItemsAsync(receipt.ProjectCrmId, receipt.Id, cancellationToken).ConfigureAwait(false);
        if (receipt.Recheck(ReceivablesLedger.Open(items)).IsFailure)
        {
            receipt.ApprovalEnded(withdrawn: false, "لم يُعتمد السند: توزيعه على الفواتير أكبر من المتبقي عليها الآن (سُدد جزء منها بسند آخر). عدّل التوزيع وأعد الإرسال.");
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return;
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, "receipt", receipt.ReceiptDate, cancellationToken).ConfigureAwait(false);
        receipt.Approve(number, user.DisplayName, comment, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
    }
}
