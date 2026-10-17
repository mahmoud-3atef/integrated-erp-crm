using System.Globalization;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

/// <summary>
/// The delivery order as the approval engine sees it: the fields a process can test (e.g. a stage only when there is
/// a special price), and the end of the approval, which sets the order's status.
/// </summary>
internal sealed class DeliveryOrderAdapter(OperationsDbContext db) : IApprovalRecordAdapter
{
    public const string ScreenCode = "operations.delivery_order";

    private static readonly RecordFieldOption[] Statuses =
    [
        new(nameof(DeliveryStatus.Draft), "مسودة", "Draft", Settable: false),
        new(nameof(DeliveryStatus.InApproval), "قيد الاعتماد", "In approval", Settable: false),
        new(nameof(DeliveryStatus.Returned), "مُعاد للتعديل", "Returned", Settable: false),
        new(nameof(DeliveryStatus.Approved), "معتمد بانتظار التسليم", "Approved, awaiting delivery", Settable: false),
        new(nameof(DeliveryStatus.Rejected), "مرفوض", "Rejected", Settable: false),
        new(nameof(DeliveryStatus.Delivered), "تم التسليم", "Delivered", Settable: false),
        new(nameof(DeliveryStatus.Canceled), "ملغى", "Canceled", Settable: false),
    ];

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
            new("status", "حالة الأمر", "Order status", RecordFieldType.Choice, Updatable: false, Statuses),
        ]);

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

    public Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("delivery_field_not_settable", "A process cannot change a delivery order's fields.")));

    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        var order = await db.DeliveryOrders.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return;
        }

        order.ApprovalEnded(
            end switch
            {
                ApprovalEnd.Approved => DeliveryStatus.Approved,
                ApprovalEnd.Rejected => DeliveryStatus.Rejected,
                ApprovalEnd.Returned => DeliveryStatus.Returned,
                _ => DeliveryStatus.Canceled,
            },
            comment);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
