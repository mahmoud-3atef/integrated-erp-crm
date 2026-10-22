using IntegratedErp.Modules.Identity.Contracts;
using IntegratedErp.Modules.Commercial.Contracts;
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
internal sealed class TransferOrderAdapter(OperationsDbContext db, IPeriodLedger ledger, IProjectDirectory projects, IUserDirectory users, ICurrentUser user, IClock clock) : IApprovalRecordAdapter
{
    public const string ScreenCode = "operations.transfer_order";
    public const string SourceType = "transfer_order";

    /// <summary>The related tables: the project the workers go to, and the one they leave (fields for conditions).</summary>
    public const string ToProject = "to_project";
    public const string FromProject = "from_project";



    /// <summary>The order's code: the workers' periods move to the new project (the order means nothing without it).</summary>
    public const string MoveWorkers = "move_workers";

    private static readonly RecordFieldOption[] Statuses =
    [
        new(nameof(TransferStatus.UnderPreparation), "قيد الإعداد", "Under preparation"),
        new(nameof(TransferStatus.SentToOperationsManager), "مرسل لمدير العمليات", "Sent to the operations manager"),
        new(nameof(TransferStatus.InApproval), "قيد الاعتماد", "In approval"),
        new(nameof(TransferStatus.Returned), "مُعاد للتعديل", "Returned", Settable: false),
        new(nameof(TransferStatus.Rejected), "مرفوض", "Rejected", Settable: false),
        new(nameof(TransferStatus.Transferred), "تم النقل", "Transferred", Settable: false),
        new(nameof(TransferStatus.Canceled), "ملغى", "Canceled", Settable: false),
        new(nameof(TransferStatus.CanceledAfterApproval), "ملغى بعد الاعتماد", "Canceled after approval", Settable: false),
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
                    onApprove = new object[]
                    {
                        new { type = "action", id = "move-workers", label = "نقل العمالة وإتمام الأمر", action = MoveWorkers },
                    },
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
            new("from_project", "المشروع المنقول منه", "Project left", RecordFieldType.Text, Updatable: false),
            new("order_no", "رقم الأمر", "Order number", RecordFieldType.Text, Updatable: false),
            new("receiver", "المستلم في المشروع الجديد", "Receiver on the new project", RecordFieldType.Text, Updatable: false),
            new("created_on", "تاريخ إنشاء الأمر", "Order created on", RecordFieldType.Date, Updatable: false),
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
        Relations:
        [
            new(ToProject, "المشروع المنقول إليه", "Project moved to", ProjectRecord.Fields),
            new(FromProject, "المشروع المنقول منه", "Project moved from", ProjectRecord.Fields),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد أمر النقل", "Transfer order approval", DefaultDefinition),
        Actions:
        [
            new(
                MoveWorkers,
                "نقل العمالة وإتمام الأمر",
                "Move the workers and complete the order",
                "تنتهي فترة عمل كل عامل في الأمر على مشروعه السابق، وتبدأ فترة عمله على المشروع الجديد من تاريخ النقل وبسعره، وتصبح حالة الأمر «تم النقل». إن تداخل التاريخ مع فترة أخرى لأحدهم يعود الأمر لمنشئه للتعديل.",
                "Each worker's work period on their former project ends, and one on the new project opens from the transfer date at their price; the order is «transferred». A date overlapping another period sends the order back to its creator.",
                Required: true),
        ]);

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
            ["from_project"] = o.FromProjectName ?? o.Lines.Select(l => l.FromProjectName).FirstOrDefault(n => n is not null),
            ["order_no"] = o.OrderNo,
            ["receiver"] = o.ReceiverName,
            ["created_on"] = DateOnly.FromDateTime(o.CreatedAt.UtcDateTime.AddHours(3)).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
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

    /// <summary>The project the order moves its workers to, or the one they leave, as the condition fields say.</summary>
    public async Task<IReadOnlyDictionary<string, string?>?> ReadRelatedAsync(Guid recordId, string relation, CancellationToken cancellationToken)
    {
        var o = await db.TransferOrders.AsNoTracking().Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        Guid? id = relation switch
        {
            ToProject => o?.ProjectId,
            FromProject => o?.FromProjectId ?? o?.Lines.Select(l => l.FromProjectId).FirstOrDefault(x => x is not null),
            _ => null,
        };
        if (id is not { } projectId)
        {
            return null;
        }

        return await ProjectRecord.ReadAsync(projects, users, projectId, cancellationToken).ConfigureAwait(false);
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

    /// <summary>
    /// «Move the workers» (the process runs it, by default after the operations manager's approval): each worker's work
    /// period moves to the new project from the transfer date (all or none), and the order is transferred. Run again on a
    /// transferred order, it does nothing; a date overlapping a worker's timeline sends the order back to its creator.
    /// </summary>
    public async Task<RecordActionResult> RunAsync(Guid recordId, string action, CancellationToken cancellationToken)
    {
        if (action != MoveWorkers)
        {
            return RecordActionResult.Failed($"A transfer order has no action \"{action}\".");
        }

        var order = await db.TransferOrders.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return RecordActionResult.Failed("The transfer order no longer exists.");
        }

        if (order.Status == TransferStatus.Transferred)
        {
            return RecordActionResult.Done;
        }

        if (!order.IsInApproval)
        {
            return RecordActionResult.Failed("The transfer order is not in approval.");
        }

        var starts = order.Lines.Select(l => new WorkStartRequest(
                l.WorkerId, order.ProjectId, order.ProjectCrmId, order.ProjectName, order.TransferOn,
                SourceType, order.Id, l.Id, order.OrderNo, l.PackageId, l.PackageNo, l.Salary, l.ServiceFee, l.Housing, l.HousingBillable,
                l.Transport, l.TransportBillable, l.TotalPrice, l.IsSpecialPrice))
            .ToList();
        var moved = await ledger.StartWorkAsync(starts, cancellationToken).ConfigureAwait(false);
        if (moved.IsFailure)
        {
            return RecordActionResult.SendBack(moved.Error.Code == "conflict.period_overlap"
                ? "لم يكتمل النقل: تاريخ النقل يتداخل مع فترة أخرى في سجل فترات أحد العمال. عدّل التاريخ وأعد الإرسال."
                : $"لم يكتمل النقل: {moved.Error.Message}");
        }

        order.Complete(user.DisplayName, null, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return RecordActionResult.Done;
    }

    /// <summary>
    /// The approval ended: a rejection, return or cancel sets the order's state. Approved, the order was already
    /// transferred by its «move the workers» code (the engine runs a required code an older process version lacks).
    /// </summary>
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
                // Not transferred (its code did not complete it): back to its creator rather than approved without a move.
                order.ApprovalEnded(TransferStatus.Returned, "انتهى الاعتماد دون نقل العمالة؛ أعد إرسال الأمر.");
                break;
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
}
