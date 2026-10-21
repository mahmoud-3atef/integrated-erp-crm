using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.BuildingBlocks.Alerts;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.Operations.Api;
using IntegratedErp.Modules.Operations.Application;
using IntegratedErp.Modules.Operations.Contracts;
using IntegratedErp.Modules.Operations.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Operations;

/// <summary>
/// Operations module: the movement documents that move workers (docs/02-target-architecture/05), starting with the
/// delivery order. In the parallel phase the old system's orders are copied here read-only, next to the orders written
/// here; the period ledger is built from the documents later (docs/03-migration-plan/04, slice 1.5).
/// </summary>
public sealed class OperationsModule : IModule
{
    public string Name => OperationsContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<OperationsDbContext>(configuration, OperationsDbContext.SchemaName);
        services.AddScoped<IHousingEntries, HousingEntries>();
        services.AddScoped<IWorkerVacations, WorkerVacations>();
        services.AddScoped<Showroom>();
        services.AddScoped<WorkerDocuments>();
        services.AddScoped<DeliveryOrderService>();
        services.AddScoped<DeliveryOrderQueries>();
        services.AddScoped<IApprovalRecordAdapter, DeliveryOrderAdapter>();
        services.AddScoped<DeliveryOrderImportService>();
        services.AddScoped<ICrmStagingConsumer>(sp => sp.GetRequiredService<DeliveryOrderImportService>());
        services.AddScoped<ReturnOrderService>();
        services.AddScoped<ReturnOrderQueries>();
        services.AddScoped<IApprovalRecordAdapter, ReturnOrderAdapter>();
        services.AddScoped<ReturnOrderImportService>();
        services.AddScoped<ICrmStagingConsumer>(sp => sp.GetRequiredService<ReturnOrderImportService>());
        services.AddScoped<TransferOrderService>();
        services.AddScoped<OperationsDashboard>();
        services.AddScoped<TransferOrderQueries>();
        services.AddScoped<IApprovalRecordAdapter, TransferOrderAdapter>();
        services.AddScoped<MovementService>();
        services.AddScoped<MovementQueries>();
        services.AddScoped<IApprovalRecordAdapter, MovementAdapter>();
        services.AddAlertProvider<MovementAlerts>();
        services.AddPermissions(OperationsPermissions.All);
        services.AddNumberSequences(
            new NumberSequenceDefinition("delivery_order", OperationsDbContext.SchemaName, "العمليات", "Operations", "أوامر التسليم", "Delivery orders", "DO-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition("return_order", OperationsDbContext.SchemaName, "العمليات", "Operations", "أوامر الرجيع", "Return orders", "RT-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition("transfer_order", OperationsDbContext.SchemaName, "العمليات", "Operations", "أوامر النقل", "Transfer orders", "TR-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition("movement_arrival", OperationsDbContext.SchemaName, "العمليات", "Operations", "تأكيد الوصول", "Arrivals", "AR-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition("movement_vacation_departure", OperationsDbContext.SchemaName, "العمليات", "Operations", "مغادرة الإجازة", "Vacation departures", "VD-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition("movement_vacation_return", OperationsDbContext.SchemaName, "العمليات", "Operations", "العودة من الإجازة", "Returns from vacation", "VR-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition("movement_absconding", OperationsDbContext.SchemaName, "العمليات", "Operations", "بلاغات الانقطاع", "Absconding reports", "AB-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition("movement_absconding_return", OperationsDbContext.SchemaName, "العمليات", "Operations", "العودة بعد الانقطاع", "Returns after absconding", "ABR-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition("movement_suspension", OperationsDbContext.SchemaName, "العمليات", "Operations", "الإيقاف", "Suspensions", "SU-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition("movement_suspension_lift", OperationsDbContext.SchemaName, "العمليات", "Operations", "رفع الإيقاف", "Suspensions lifted", "SL-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition("movement_exit", OperationsDbContext.SchemaName, "العمليات", "Operations", "الخروج النهائي", "Final exits", "EX-{YYYY}-{N:5}", NumberReset.Yearly));
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapOperationsEndpoints();
        endpoints.MapReturnOrderEndpoints();
        endpoints.MapTransferOrderEndpoints();
        endpoints.MapMovementEndpoints();
        endpoints.MapShowroomEndpoints();
    }
}

internal static class OperationsPermissions
{
    public const string DeliveryView = "operations.delivery.view";
    public const string DeliveryCreate = "operations.delivery.create";
    public const string DeliveryApprove = "operations.delivery.approve";
    public const string DeliveryAmend = "operations.delivery.amend";
    public const string DeliveryCancelApproved = "operations.delivery.cancel_approved";
    public const string ReturnView = "operations.return.view";
    public const string ReturnCreate = "operations.return.create";
    public const string ReturnSales = "operations.return.sales";
    public const string ReturnApprove = "operations.return.approve";
    public const string ReturnAmend = "operations.return.amend";
    public const string ReturnCancelApproved = "operations.return.cancel_approved";
    public const string TransferView = "operations.transfer.view";
    public const string TransferCreate = "operations.transfer.create";
    public const string TransferApprove = "operations.transfer.approve";
    public const string TransferAmend = "operations.transfer.amend";
    public const string TransferCancelApproved = "operations.transfer.cancel_approved";
    public const string MovementsView = "operations.movements.view";
    public const string MovementsManage = "operations.movements.manage";
    public const string MovementsApprove = "operations.movements.approve";

    /// <summary>The types of worker action, each with its own permissions to change or cancel it after its approval.</summary>
    private static readonly (MovementType Type, string Key, string Ar, string En)[] MovementTypes =
    [
        (MovementType.Arrival, "arrival", "دخول جديد (حديث الوصول)", "New arrival"),
        (MovementType.VacationDeparture, "vacation_departure", "مغادرة إجازة", "Vacation departure"),
        (MovementType.VacationReturn, "vacation_return", "العودة من الإجازة", "Return from vacation"),
        (MovementType.Absconding, "absconding", "بلاغ انقطاع", "Absconding report"),
        (MovementType.AbscondingReturn, "absconding_return", "عودة بعد انقطاع", "Return after absconding"),
        (MovementType.Suspension, "suspension", "إيقاف", "Suspension"),
        (MovementType.SuspensionLift, "suspension_lift", "رفع الإيقاف", "Suspension lifted"),
        (MovementType.FinalExit, "final_exit", "خروج نهائي", "Final exit"),
    ];

    public static string MovementAmend(MovementType type) => $"operations.movements.{MovementTypes.First(t => t.Type == type).Key}.amend";

    public static string MovementCancelApproved(MovementType type) => $"operations.movements.{MovementTypes.First(t => t.Type == type).Key}.cancel_approved";

    private static IEnumerable<PermissionDefinition> MovementAmendments() => MovementTypes.SelectMany(t => new PermissionDefinition[]
    {
        new(MovementAmend(t.Type), GroupAr, GroupEn, $"تعديل إجراء «{t.Ar}» المعتمد (تاريخه وملاحظاته…)", $"Change an approved «{t.En}» action (its date, notes…)"),
        new(MovementCancelApproved(t.Type), GroupAr, GroupEn, $"إلغاء إجراء «{t.Ar}» المعتمد", $"Cancel an approved «{t.En}» action"),
    });
    public const string ShowroomView = "operations.showroom.view";

    private const string GroupAr = "العمليات";
    private const string GroupEn = "Operations";

    public static readonly PermissionDefinition[] All =
    [
        new(DeliveryView, GroupAr, GroupEn, "عرض أوامر التسليم", "View delivery orders"),
        new(DeliveryCreate, GroupAr, GroupEn, "إنشاء أوامر التسليم وتعديلها وإرسالها للاعتماد", "Create, edit and submit delivery orders"),
        new(DeliveryApprove, GroupAr, GroupEn, "اعتماد أوامر التسليم (مدير العمليات)", "Approve delivery orders (operations manager)"),
        new(DeliveryAmend, GroupAr, GroupEn, "تعديل أمر تسليم معتمد (تاريخ المباشرة، والسعر، والمستلم…)", "Change a delivered order (start of work, price, receiver…)"),
        new(DeliveryCancelApproved, GroupAr, GroupEn, "إلغاء أمر تسليم معتمد", "Cancel a delivered order"),
        new(ReturnView, GroupAr, GroupEn, "عرض أوامر الرجيع", "View return orders"),
        new(ReturnCreate, GroupAr, GroupEn, "إنشاء أوامر الرجيع وتعديلها", "Create and edit return orders"),
        new(ReturnSales, GroupAr, GroupEn, "تسجيل رغبة العميل في أوامر الرجيع (المبيعات)", "Record the customer's wish on return orders (sales)"),
        new(ReturnApprove, GroupAr, GroupEn, "اعتماد أوامر الرجيع (مدير العمليات)", "Approve return orders (operations manager)"),
        new(ReturnAmend, GroupAr, GroupEn, "تعديل أمر رجيع معتمد (تاريخ الوصول، والراتب، والسكن…)", "Change an approved return order (arrival day, salary, housing…)"),
        new(ReturnCancelApproved, GroupAr, GroupEn, "إلغاء أمر رجيع معتمد", "Cancel an approved return order"),
        new(TransferView, GroupAr, GroupEn, "عرض أوامر النقل بين المشاريع", "View project transfer orders"),
        new(TransferCreate, GroupAr, GroupEn, "إنشاء أوامر النقل وتعديلها", "Create and edit project transfer orders"),
        new(TransferApprove, GroupAr, GroupEn, "اعتماد أوامر النقل (مدير العمليات)", "Approve project transfer orders (operations manager)"),
        new(TransferAmend, GroupAr, GroupEn, "تعديل أمر نقل معتمد (تاريخ النقل، والسعر، والمستلم…)", "Change a transferred order (transfer date, price, receiver…)"),
        new(TransferCancelApproved, GroupAr, GroupEn, "إلغاء أمر نقل معتمد", "Cancel a transferred order"),
        new(ShowroomView, GroupAr, GroupEn, "عرض شاشة السكن (العمالة المتاحة)", "View the housing screen (available workers)"),
        new(MovementsView, GroupAr, GroupEn, "عرض حركات العمال (الوصول والإجازات والانقطاع والإيقاف والخروج)", "View worker movements (arrival, vacation, absconding, suspension, exit)"),
        new(MovementsManage, GroupAr, GroupEn, "إنشاء حركات العمال وتعديلها وإلغاؤها", "Create, edit and cancel worker movements"),
        new(MovementsApprove, GroupAr, GroupEn, "اعتماد حركات العمال (مدير العمليات)", "Approve worker movements (operations manager)"),
        .. MovementAmendments(),
    ];
}
