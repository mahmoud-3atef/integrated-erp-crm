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
    }
}

internal static class OperationsPermissions
{
    public const string DeliveryView = "operations.delivery.view";
    public const string DeliveryCreate = "operations.delivery.create";
    public const string DeliveryApprove = "operations.delivery.approve";
    public const string ReturnView = "operations.return.view";
    public const string ReturnCreate = "operations.return.create";
    public const string ReturnSales = "operations.return.sales";
    public const string ReturnApprove = "operations.return.approve";
    public const string TransferView = "operations.transfer.view";
    public const string TransferCreate = "operations.transfer.create";
    public const string TransferApprove = "operations.transfer.approve";
    public const string MovementsView = "operations.movements.view";
    public const string MovementsManage = "operations.movements.manage";
    public const string MovementsApprove = "operations.movements.approve";

    private const string GroupAr = "العمليات";
    private const string GroupEn = "Operations";

    public static readonly PermissionDefinition[] All =
    [
        new(DeliveryView, GroupAr, GroupEn, "عرض أوامر التسليم", "View delivery orders"),
        new(DeliveryCreate, GroupAr, GroupEn, "إنشاء أوامر التسليم وتعديلها وإرسالها للاعتماد", "Create, edit and submit delivery orders"),
        new(DeliveryApprove, GroupAr, GroupEn, "اعتماد أوامر التسليم (مدير العمليات)", "Approve delivery orders (operations manager)"),
        new(ReturnView, GroupAr, GroupEn, "عرض أوامر الرجيع", "View return orders"),
        new(ReturnCreate, GroupAr, GroupEn, "إنشاء أوامر الرجيع وتعديلها", "Create and edit return orders"),
        new(ReturnSales, GroupAr, GroupEn, "تسجيل رغبة العميل في أوامر الرجيع (المبيعات)", "Record the customer's wish on return orders (sales)"),
        new(ReturnApprove, GroupAr, GroupEn, "اعتماد أوامر الرجيع (مدير العمليات)", "Approve return orders (operations manager)"),
        new(TransferView, GroupAr, GroupEn, "عرض أوامر النقل بين المشاريع", "View project transfer orders"),
        new(TransferCreate, GroupAr, GroupEn, "إنشاء أوامر النقل وتعديلها", "Create and edit project transfer orders"),
        new(TransferApprove, GroupAr, GroupEn, "اعتماد أوامر النقل (مدير العمليات)", "Approve project transfer orders (operations manager)"),
        new(MovementsView, GroupAr, GroupEn, "عرض حركات العمال (الوصول والإجازات والانقطاع والإيقاف والخروج)", "View worker movements (arrival, vacation, absconding, suspension, exit)"),
        new(MovementsManage, GroupAr, GroupEn, "إنشاء حركات العمال وتعديلها وإلغاؤها", "Create, edit and cancel worker movements"),
        new(MovementsApprove, GroupAr, GroupEn, "اعتماد حركات العمال (مدير العمليات)", "Approve worker movements (operations manager)"),
    ];
}
