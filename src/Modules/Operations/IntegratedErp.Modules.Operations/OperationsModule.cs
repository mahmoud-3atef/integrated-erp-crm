using IntegratedErp.BuildingBlocks.Modules;
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
        services.AddScoped<TransferOrderQueries>();
        services.AddScoped<IApprovalRecordAdapter, TransferOrderAdapter>();
        services.AddPermissions(OperationsPermissions.All);
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapOperationsEndpoints();
        endpoints.MapReturnOrderEndpoints();
        endpoints.MapTransferOrderEndpoints();
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
    ];
}
