using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

/// <summary>
/// The transfer order as the approval engine sees it: the fields a process can test and the status it can set, the
/// default process (the creator confirms ⇒ sent to the operations manager ⇒ transferred), and the end of the approval.
/// When the last stage approves, every worker's work period moves to the new project in the period ledger.
/// </summary>
internal sealed class TransferOrderAdapter(OperationsDbContext db, IPeriodLedger ledger, ICurrentUser user, IClock clock) : IApprovalRecordAdapter
{
    public const string ScreenCode = "operations.transfer_order";
    public const string SourceType = "transfer_order";

    private static readonly RecordFieldOption[] Statuses =
    [
        new(nameof(TransferStatus.UnderPreparation), "قيد الإعداد", "Under preparation"),
        new(nameof(TransferStatus.SentToOperationsManager), "مرسل لمدير العمليات", "Sent to the operations manager"),
        new(nameof(TransferStatus.InApproval), "قيد الاعتماد", "In approval"),
        new(nameof(TransferStatus.Returned), "مُعاد للتعديل", "Returned", Settable: false),
        new(nameof(TransferStatus.Rejected), "مرفوض", "Rejected", Settable: false),
        new(nameof(TransferStatus.Transferred), "تم النقل", "Transferred", Settable: false),
        new(nameof(TransferStatus.Canceled), "ملغى", "Canceled", Settable: false),
    ];

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>The process every company starts with: the creator confirms the order, then the operations manager approves it.</summary>
    private static readonly string DefaultDefinition = JsonSerializer.Serialize(
        new
        {
            startCondition = (object?)null,
            steps = new object[]
            {
                new
                {
                    type = "approval", id = "creator", label = "تأكيد منشئ الأمر",
                    nameAr = "تأكيد منشئ أمر النقل", nameEn = "Creator's confirmation",
                    assignees = new[] { new { kind = "Submitter" } }, rule = "Any", allowReturn = false, allowDelegate = false,
                    onApprove = new object[]
                    {
                        new { type = "update", id = "sent-to-ops", changes = new[] { new { fieldKey = "status", value = nameof(TransferStatus.SentToOperationsManager) } } },
                    },
                },
                new
                {
                    type = "approval", id = "operations-manager", label = "اعتماد مدير العمليات",
                    nameAr = "اعتماد مدير العمليات", nameEn = "Operations manager's approval",
                    assignees = new[] { new { kind = "Permission", permission = OperationsPermissions.TransferApprove } }, rule = "Any",
                },
            },
        },
        JsonOptions);

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "أوامر النقل بين المشاريع",
        "Project transfer orders",
        "/operations/transfer-orders/{id}",
        [
            new("project", "المشروع الجديد", "New project", RecordFieldType.Text, Updatable: false),
            new("customer", "العميل", "Customer", RecordFieldType.Text, Updatable: false),
            new("contract_type", "نوع العقد", "Contract type", RecordFieldType.Text, Updatable: false),
            new("transfer_on", "تاريخ النقل", "Transfer date", RecordFieldType.Date, Updatable: false),
            new("workers", "عدد العمالة", "Number of workers", RecordFieldType.Number, Updatable: false),
            new("total_price", "إجمالي سعر الخدمة الشهري", "Monthly service price, total", RecordFieldType.Money, Updatable: false),
            new("has_special_price", "فيه سعر خاص", "Has a special price", RecordFieldType.Boolean, Updatable: false),
            new("special_prices", "عدد الأسعار الخاصة", "Number of special prices", RecordFieldType.Number, Updatable: false),
            new("late", "مسجل متأخرًا", "Registered late", RecordFieldType.Boolean, Updatable: false),
            new("requested_by", "منشئ الأمر", "Created by", RecordFieldType.User, Updatable: false),
            new("status", "حالة الأمر", "Order status", RecordFieldType.Choice, Updatable: true, Statuses),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد أمر النقل", "Transfer order approval", DefaultDefinition));

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var o = await db.TransferOrders.AsNoTracking().Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (o is null)
        {
            return null;
        }

        var specials = o.Lines.Count(l => l.IsSpecialPrice);
        return new Dictionary<string, string?>
        {
            ["project"] = o.ProjectName,
            ["customer"] = o.CustomerName,
            ["contract_type"] = o.ContractType,
            ["transfer_on"] = o.TransferOn.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["workers"] = o.Lines.Count.ToString(CultureInfo.InvariantCulture),
            ["total_price"] = o.Lines.Sum(l => l.TotalPrice).ToString(CultureInfo.InvariantCulture),
            ["has_special_price"] = specials > 0 ? "true" : "false",
            ["special_prices"] = specials.ToString(CultureInfo.InvariantCulture),
            ["late"] = o.DelayReason is null ? "false" : "true",
            ["requested_by"] = o.CreatedBy?.ToString(),
            ["status"] = o.Status.ToString(),
        };
    }

    /// <summary>A process may set the order's status while it is in approval (e.g. "sent to the operations manager").</summary>
    public async Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(changes);
        if (relation is not null || changes.Keys.Any(k => k != "status"))
        {
            return Result.Failure(Error.Validation("transfer_field_not_settable", "A process can set only the transfer order's status."));
        }

        var order = await db.TransferOrders.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure(TransferErrors.NotFound);
        }

        if (!Enum.TryParse<TransferStatus>(changes["status"], out var status) || !Statuses.Any(s => s.Value == changes["status"] && s.Settable))
        {
            return Result.Failure(TransferErrors.StatusNotSettable);
        }

        if (order.Status == status)
        {
            return Result.Success(); // idempotent
        }

        var set = order.SetStatusFromProcess(status);
        if (set.IsFailure)
        {
            return set;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var order = await db.TransferOrders.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure(TransferErrors.NotFound);
        }

        if (order.AwaitingApproval)
        {
            return Result.Success(); // submitted by the order itself
        }

        if (order.MarkSubmitted(clock.UtcNow).IsFailure)
        {
            return Result.Failure(Error.Conflict("transfer_not_startable", "An approval can run only on an order under preparation or returned."));
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        var order = await db.TransferOrders.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (order is null || !order.IsInApproval)
        {
            return;
        }

        switch (end)
        {
            case ApprovalEnd.Approved:
                await TransferAsync(order, comment, cancellationToken).ConfigureAwait(false);
                return;
            case ApprovalEnd.Rejected:
                order.ApprovalEnded(TransferStatus.Rejected, comment);
                break;
            case ApprovalEnd.Returned:
                order.ApprovalEnded(TransferStatus.Returned, comment);
                break;
            default:
                // Withdrawn by its creator or canceled by an administrator: back under preparation, to send again or cancel.
                order.ApprovalEnded(TransferStatus.UnderPreparation, comment);
                break;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Transferred: each worker's work period on the old project closes and one on the new project opens on the transfer date.</summary>
    private async Task TransferAsync(TransferOrder order, string? comment, CancellationToken cancellationToken)
    {
        // The engine ends the approval in the scope of the person who took the last decision.
        if (order.Complete(user.DisplayName, comment, clock.UtcNow).IsFailure)
        {
            return;
        }

        var starts = order.Lines.Select(l => new WorkStartRequest(
                l.WorkerId, order.ProjectId, order.ProjectCrmId, order.ProjectName, order.TransferOn,
                SourceType, order.Id, l.Id, order.OrderNo, l.PackageId, l.PackageNo, l.Salary, l.ServiceFee, l.Housing, l.HousingBillable,
                l.Transport, l.TransportBillable, l.TotalPrice, l.IsSpecialPrice))
            .ToList();
        var moved = await ledger.StartWorkAsync(starts, cancellationToken).ConfigureAwait(false);
        if (moved.IsFailure)
        {
            order.ReturnForFix(moved.Error.Code == "conflict.period_overlap"
                ? "لم يكتمل النقل: تاريخ النقل يتداخل مع فترة أخرى في سجل فترات أحد العمال. عدّل التاريخ وأعد الحفظ."
                : $"لم يكتمل النقل: {moved.Error.Message}");
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
