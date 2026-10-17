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
/// The return order as the approval engine sees it. Default process: the creator confirms ⇒ sales record the customer's
/// wish ⇒ the operations manager approves ⇒ completed: the worker's work period closes on the arrival day and a housing
/// period opens in the period ledger.
/// </summary>
internal sealed class ReturnOrderAdapter(OperationsDbContext db, IPeriodLedger ledger, IHousingRooms housing, ICurrentUser user, IClock clock) : IApprovalRecordAdapter
{
    public const string ScreenCode = "operations.return_order";
    public const string SourceType = "return_order";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly RecordFieldOption[] Statuses =
    [
        new(nameof(ReturnStatus.UnderPreparation), "قيد الإعداد", "Under preparation"),
        new(nameof(ReturnStatus.SentToSales), "مرسل للمبيعات", "Sent to sales"),
        new(nameof(ReturnStatus.SentToOperationsManager), "مرسل لمدير العمليات", "Sent to the operations manager"),
        new(nameof(ReturnStatus.InApproval), "قيد الاعتماد", "In approval"),
        new(nameof(ReturnStatus.Returned), "مُعاد للتعديل", "Returned", Settable: false),
        new(nameof(ReturnStatus.Rejected), "مرفوض", "Rejected", Settable: false),
        new(nameof(ReturnStatus.Completed), "تم التسكين", "In housing", Settable: false),
        new(nameof(ReturnStatus.Canceled), "ملغى", "Canceled", Settable: false),
    ];

    private static readonly RecordFieldOption[] Reasons =
    [
        new(ReturnReasons.ClientNoReason, "العميل أرجع العامل بدون سبب", "The customer returned the worker for no reason", Settable: false),
        new(ReturnReasons.WorkerRefuses, "العامل رافض للعمل", "The worker refuses to work", Settable: false),
        new(ReturnReasons.Sick, "مريض", "Sick", Settable: false),
        new(ReturnReasons.WorkerAbused, "إساءة إلى العامل", "Abuse of the worker", Settable: false),
        new(ReturnReasons.ContractCanceled, "إلغاء التعاقد مع العميل", "Contract with the customer canceled", Settable: false),
        new(ReturnReasons.Other, "أخرى", "Other", Settable: false),
    ];

    private static readonly RecordFieldOption[] Wishes =
    [
        new(CustomerWishes.Replace, "استبدال العامل", "Replace the worker"),
        new(CustomerWishes.Cancel, "إلغاء (تخفيض العدد)", "Cancel (fewer workers)"),
        new(CustomerWishes.Nothing, "لا شيء", "Nothing"),
    ];

    private static readonly string DefaultDefinition = JsonSerializer.Serialize(
        new
        {
            startCondition = (object?)null,
            steps = new object[]
            {
                new
                {
                    type = "approval", id = "creator", label = "تأكيد منشئ الأمر",
                    nameAr = "تأكيد منشئ أمر الرجيع", nameEn = "Creator's confirmation",
                    assignees = new[] { new { kind = "Submitter" } }, rule = "Any", allowReturn = false, allowDelegate = false,
                    onApprove = new object[]
                    {
                        new { type = "update", id = "sent-to-sales", changes = new[] { new { fieldKey = "status", value = nameof(ReturnStatus.SentToSales) } } },
                    },
                },
                new
                {
                    type = "approval", id = "sales", label = "رغبة العميل",
                    nameAr = "المبيعات: رغبة العميل", nameEn = "Sales: the customer's wish",
                    assignees = new[] { new { kind = "Permission", permission = OperationsPermissions.ReturnSales } }, rule = "Any",
                    requiredFields = new[] { "customer_wish" },
                    onApprove = new object[]
                    {
                        new { type = "update", id = "sent-to-ops", changes = new[] { new { fieldKey = "status", value = nameof(ReturnStatus.SentToOperationsManager) } } },
                    },
                },
                new
                {
                    type = "approval", id = "operations-manager", label = "اعتماد مدير العمليات",
                    nameAr = "اعتماد مدير العمليات", nameEn = "Operations manager's approval",
                    assignees = new[] { new { kind = "Permission", permission = OperationsPermissions.ReturnApprove } }, rule = "Any",
                },
            },
        },
        JsonOptions);

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "أوامر الرجيع",
        "Return orders",
        "/operations/return-orders/{id}",
        [
            new("worker", "العامل", "Worker", RecordFieldType.Text, Updatable: false),
            new("project", "المشروع", "Project", RecordFieldType.Text, Updatable: false),
            new("arrived_on", "تاريخ الوصول للسكن", "Arrival in housing", RecordFieldType.Date, Updatable: false),
            new("reason", "سبب الرجيع", "Reason for the return", RecordFieldType.Choice, Updatable: false, Reasons),
            new("stop_salary", "إيقاف الراتب أثناء السكن", "Salary stops in housing", RecordFieldType.Boolean, Updatable: false),
            new("late", "مسجل متأخرًا", "Registered late", RecordFieldType.Boolean, Updatable: false),
            new("requested_by", "منشئ الأمر", "Created by", RecordFieldType.User, Updatable: false),
            new("customer_wish", "رغبة العميل", "The customer's wish", RecordFieldType.Choice, Updatable: true, Wishes),
            new("status", "حالة الأمر", "Order status", RecordFieldType.Choice, Updatable: true, Statuses),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد أمر الرجيع", "Return order approval", DefaultDefinition));

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var o = await db.ReturnOrders.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        return o is null ? null : new Dictionary<string, string?>
        {
            ["worker"] = $"{o.Name} ({o.WorkerNo})",
            ["project"] = o.ProjectName,
            ["arrived_on"] = o.ArrivedOn?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["reason"] = o.Reason,
            ["stop_salary"] = o.StopSalary ? "true" : "false",
            ["late"] = o.DelayReason is null ? "false" : "true",
            ["requested_by"] = o.CreatedBy?.ToString(),
            ["customer_wish"] = o.CustomerWish,
            ["status"] = o.Status.ToString(),
        };
    }

    public async Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(changes);
        if (relation is not null || changes.Keys.Any(k => k is not ("status" or "customer_wish")))
        {
            return Result.Failure(ReturnErrors.StatusNotSettable);
        }

        var order = await db.ReturnOrders.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure(ReturnErrors.NotFound);
        }

        if (changes.TryGetValue("customer_wish", out var wish) && wish != order.CustomerWish)
        {
            var set = order.SetCustomerWish(wish);
            if (set.IsFailure)
            {
                return set;
            }
        }

        if (changes.TryGetValue("status", out var value) && value != order.Status.ToString())
        {
            if (!Enum.TryParse<ReturnStatus>(value, out var status) || !Statuses.Any(s => s.Value == value && s.Settable))
            {
                return Result.Failure(ReturnErrors.StatusNotSettable);
            }

            var set = order.SetStatusFromProcess(status);
            if (set.IsFailure)
            {
                return set;
            }
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var order = await db.ReturnOrders.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure(ReturnErrors.NotFound);
        }

        if (order.AwaitingApproval)
        {
            return Result.Success();
        }

        if (order.MarkSubmitted(clock.UtcNow).IsFailure)
        {
            return Result.Failure(Error.Conflict("return_not_startable", "An approval can run only on an order under preparation or returned."));
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        var order = await db.ReturnOrders.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (order is null || !order.IsInApproval)
        {
            return;
        }

        switch (end)
        {
            case ApprovalEnd.Approved:
                if (order.Complete(user.DisplayName, comment, clock.UtcNow).IsSuccess)
                {
                    var opened = await ledger.StartHousingAsync(
                        new HousingStartRequest(order.WorkerId!.Value, order.ArrivedOn!.Value, !order.StopSalary, order.HousingName, SourceType, order.Id, order.OrderNo),
                        cancellationToken).ConfigureAwait(false);
                    if (opened.IsFailure)
                    {
                        order.ReturnForFix(opened.Error.Code == "conflict.period_overlap"
                            ? "لم يكتمل التسكين: تاريخ الوصول يتداخل مع فترة أخرى في سجل فترات العامل. عدّل التاريخ وأعد الحفظ."
                            : $"لم يكتمل التسكين: {opened.Error.Message}");
                    }
                    else if (order.RoomId is { } roomId)
                    {
                        // The worker is in housing now: into the chosen room from the arrival day.
                        var housed = await housing.AssignAsync(
                            new RoomAssignRequest(order.WorkerId.Value, roomId, order.ArrivedOn.Value, SourceType, order.OrderNo), cancellationToken).ConfigureAwait(false);
                        if (housed.IsFailure)
                        {
                            order.RoomNotAssigned(housed.Error.Code == "conflict.housing_room_full"
                                ? "لم يُسكَّن في الغرفة المختارة لامتلائها؛ سكّنه من شاشة المساكن."
                                : "لم يُسكَّن في الغرفة المختارة؛ سكّنه من شاشة المساكن.");
                        }
                    }
                }

                break;
            case ApprovalEnd.Rejected:
                order.ApprovalEnded(ReturnStatus.Rejected, comment);
                break;
            case ApprovalEnd.Returned:
                order.ApprovalEnded(ReturnStatus.Returned, comment);
                break;
            default:
                order.ApprovalEnded(ReturnStatus.UnderPreparation, comment);
                break;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
