using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Housing.Contracts;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

/// <summary>
/// The delivery order as the approval engine sees it: the fields a process can test and the status it can set, the
/// default process (the creator confirms ⇒ sent to the operations manager ⇒ delivered), and the end of the approval.
/// When the last stage approves, the order is delivered and every worker's work period opens in the period ledger.
/// </summary>
internal sealed class DeliveryOrderAdapter(OperationsDbContext db, IPeriodLedger ledger, IHousingRooms housing, ICurrentUser user, IClock clock) : IApprovalRecordAdapter
{
    public const string ScreenCode = "operations.delivery_order";
    public const string SourceType = "delivery_order";

    private static readonly RecordFieldOption[] Statuses =
    [
        new(nameof(DeliveryStatus.UnderPreparation), "قيد الإعداد", "Under preparation"),
        new(nameof(DeliveryStatus.SentToOperationsManager), "مرسل لمدير العمليات", "Sent to the operations manager"),
        new(nameof(DeliveryStatus.InApproval), "قيد الاعتماد", "In approval"),
        new(nameof(DeliveryStatus.Returned), "مُعاد للتعديل", "Returned", Settable: false),
        new(nameof(DeliveryStatus.Rejected), "مرفوض", "Rejected", Settable: false),
        new(nameof(DeliveryStatus.Delivered), "تم التسليم", "Delivered", Settable: false),
        new(nameof(DeliveryStatus.Canceled), "ملغى", "Canceled", Settable: false),
        new(nameof(DeliveryStatus.CanceledAfterApproval), "ملغى بعد الاعتماد", "Canceled after approval", Settable: false),
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
                    nameAr = "تأكيد منشئ أمر التسليم", nameEn = "Creator's confirmation",
                    assignees = new[] { new { kind = "Submitter" } }, rule = "Any", allowReturn = false, allowDelegate = false,
                    onApprove = new object[]
                    {
                        new { type = "update", id = "sent-to-ops", changes = new[] { new { fieldKey = "status", value = nameof(DeliveryStatus.SentToOperationsManager) } } },
                    },
                },
                new
                {
                    type = "approval", id = "operations-manager", label = "اعتماد مدير العمليات",
                    nameAr = "اعتماد مدير العمليات", nameEn = "Operations manager's approval",
                    assignees = new[] { new { kind = "Permission", permission = OperationsPermissions.DeliveryApprove } }, rule = "Any",
                    onApprove = new object[]
                    {
                        new { type = "action", id = "start-work", label = "مباشرة العمل وإتمام التسليم", action = StartWork },
                    },
                },
            },
        },
        JsonOptions);

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "أوامر التسليم",
        "Delivery orders",
        "/operations/delivery-orders/{id}",
        [
            new("project", "المشروع", "Project", RecordFieldType.Text, Updatable: false),
            new("customer", "العميل", "Customer", RecordFieldType.Text, Updatable: false),
            new("contract_type", "نوع العقد", "Contract type", RecordFieldType.Text, Updatable: false),
            new("deliver_on", "تاريخ التسليم", "Delivery date", RecordFieldType.Date, Updatable: false),
            new("workers", "عدد العمالة", "Number of workers", RecordFieldType.Number, Updatable: false),
            new("total_price", "إجمالي سعر الخدمة الشهري", "Monthly service price, total", RecordFieldType.Money, Updatable: false),
            new("has_special_price", "فيه سعر خاص", "Has a special price", RecordFieldType.Boolean, Updatable: false),
            new("special_prices", "عدد الأسعار الخاصة", "Number of special prices", RecordFieldType.Number, Updatable: false),
            new("late", "مسجل متأخرًا", "Registered late", RecordFieldType.Boolean, Updatable: false),
            new("requested_by", "منشئ الأمر", "Created by", RecordFieldType.User, Updatable: false),
            new("status", "حالة الأمر", "Order status", RecordFieldType.Choice, Updatable: true, Statuses),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد أمر التسليم", "Delivery order approval", DefaultDefinition),
        Actions:
        [
            new(
                StartWork,
                "مباشرة العمل وإتمام التسليم",
                "Start the work and complete the delivery",
                "يفتح لكل عامل في الأمر فترة عمل على المشروع من تاريخ مباشرته وبسعره، ويخرجه من غرفته في السكن من ذلك اليوم، وتصبح حالة الأمر «تم التسليم». إن تداخل تاريخ مباشرة أحدهم مع فترة أخرى يعود الأمر لمنشئه للتعديل.",
                "Opens each worker's work period on the project from their start day at their price, takes them out of their housing room that day, and the order is «delivered». A start overlapping another period sends the order back to its creator.",
                Required: true),
        ]);

    /// <summary>The order's code: the workers' work starts (the order means nothing without it).</summary>
    public const string StartWork = "start_work";

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var o = await db.DeliveryOrders.AsNoTracking().Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
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
            ["deliver_on"] = o.DeliverOn?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
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
            return Result.Failure(Error.Validation("delivery_field_not_settable", "A process can set only the delivery order's status."));
        }

        var order = await db.DeliveryOrders.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure(DeliveryErrors.NotFound);
        }

        if (!Enum.TryParse<DeliveryStatus>(changes["status"], out var status) || !Statuses.Any(s => s.Value == changes["status"] && s.Settable))
        {
            return Result.Failure(DeliveryErrors.StatusNotSettable);
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
        var order = await db.DeliveryOrders.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure(DeliveryErrors.NotFound);
        }

        if (order.AwaitingApproval)
        {
            return Result.Success(); // submitted by the order itself
        }

        var marked = order.MarkSubmitted(clock.UtcNow);
        if (marked.IsFailure)
        {
            return Result.Failure(Error.Conflict("delivery_not_startable", "An approval can run only on an order under preparation or returned."));
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>
    /// «Start the work» (the process runs it, by default after the operations manager's approval): each worker's work
    /// period opens from their start day at their line's price (all or none), then the order is delivered and the workers
    /// leave their rooms. Run again on a delivered order, it does nothing; a start overlapping a worker's timeline sends
    /// the order back to its creator.
    /// </summary>
    public async Task<RecordActionResult> RunAsync(Guid recordId, string action, CancellationToken cancellationToken)
    {
        if (action != StartWork)
        {
            return RecordActionResult.Failed($"A delivery order has no action \"{action}\".");
        }

        var order = await db.DeliveryOrders.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return RecordActionResult.Failed("The delivery order no longer exists.");
        }

        if (order.Status == DeliveryStatus.Delivered)
        {
            return RecordActionResult.Done;
        }

        if (!order.IsInApproval || order.ProjectId is null || order.ProjectCrmId is null)
        {
            return RecordActionResult.Failed("The delivery order is not in approval (or has no project).");
        }

        var starts = order.Lines.Where(l => l.WorkerId is not null).Select(l => new WorkStartRequest(
                l.WorkerId!.Value, order.ProjectId.Value, order.ProjectCrmId.Value, order.ProjectName, l.StartOn ?? order.StartOn ?? order.DeliverOn!.Value,
                SourceType, order.Id, l.Id, order.OrderNo, l.PackageId, l.PackageNo, l.Salary, l.ServiceFee, l.Housing, l.HousingBillable,
                l.Transport, l.TransportBillable, l.TotalPrice, l.IsSpecialPrice))
            .ToList();
        var opened = await ledger.StartWorkAsync(starts, cancellationToken).ConfigureAwait(false);
        if (opened.IsFailure)
        {
            return RecordActionResult.SendBack(opened.Error.Code == "conflict.period_overlap"
                ? "لم يكتمل التسليم: تاريخ مباشرة أحد العمال يتداخل مع فترة أخرى في سجل فتراته. عدّل التاريخ وأعد الإرسال."
                : $"لم يكتمل التسليم: {opened.Error.Message}");
        }

        order.Deliver(user.DisplayName, null, clock.UtcNow);

        // Out of housing: their rooms are free from their start of work.
        foreach (var day in starts.GroupBy(x => x.StartsOn))
        {
            await housing.ReleaseAsync(day.Select(x => x.WorkerId).ToList(), day.Key, cancellationToken).ConfigureAwait(false);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return RecordActionResult.Done;
    }

    /// <summary>
    /// The approval ended: a rejection, return or cancel sets the order's state. Approved, the order was already delivered
    /// by its «start the work» code (the engine runs a required code an older process version lacks before it ends).
    /// </summary>
    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        var order = await db.DeliveryOrders.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (order is null || !order.IsInApproval)
        {
            return;
        }

        switch (end)
        {
            case ApprovalEnd.Approved:
                // Not delivered (its code did not complete it): back to its creator rather than approved without work.
                order.ApprovalEnded(DeliveryStatus.Returned, "انتهى الاعتماد دون مباشرة العمل؛ أعد إرسال الأمر.");
                break;
            case ApprovalEnd.Rejected:
                order.ApprovalEnded(DeliveryStatus.Rejected, comment);
                break;
            case ApprovalEnd.Returned:
                order.ApprovalEnded(DeliveryStatus.Returned, comment);
                break;
            default:
                // Withdrawn by its creator or canceled by an administrator: back under preparation, to send again or cancel.
                order.ApprovalEnded(DeliveryStatus.UnderPreparation, comment);
                break;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
