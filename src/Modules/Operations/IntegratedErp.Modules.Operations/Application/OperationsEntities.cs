using IntegratedErp.BuildingBlocks.Records;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;

namespace IntegratedErp.Modules.Operations.Application;

/// <summary>The operations tables processes can reach: delivery, return and transfer orders, and worker movements.</summary>
internal sealed class OperationsEntities(OperationsDbContext db) : ModelEntitySource(db, Models)
{
    private const string Project = "commercial.project";
    private const string Worker = "workforce.worker";

    private static readonly IEntityModel[] Models =
    [
        new EntityModel<DeliveryOrder>(DeliveryOrderAdapter.ScreenCode, "أمر التسليم", "Delivery order")
            .Lookup(nameof(DeliveryOrder.ProjectId), Project, "مشروع الأمر", "Project")
            .User(nameof(DeliveryOrder.CreatedBy)),
        new EntityModel<ReturnOrder>(ReturnOrderAdapter.ScreenCode, "أمر الرجيع", "Return order")
            .Lookup(nameof(ReturnOrder.WorkerId), Worker, "العامل", "Worker")
            .Lookup(nameof(ReturnOrder.ProjectId), Project, "المشروع الذي عاد منه", "Project left")
            .User(nameof(ReturnOrder.CreatedBy)),
        new EntityModel<TransferOrder>(TransferOrderAdapter.ScreenCode, "أمر النقل", "Transfer order")
            .Lookup(nameof(TransferOrder.ProjectId), Project, "المشروع المنقول إليه", "Project moved to")
            .Lookup(nameof(TransferOrder.FromProjectId), Project, "المشروع المنقول منه", "Project moved from")
            .User(nameof(TransferOrder.CreatedBy)),
        new EntityModel<WorkerMovement>(MovementAdapter.ScreenCode, "إجراء العامل", "Worker action")
            .Lookup(nameof(WorkerMovement.WorkerId), Worker, "العامل", "Worker")
            .Lookup(nameof(WorkerMovement.ProjectId), Project, "المشروع", "Project")
            .User(nameof(WorkerMovement.CreatedBy)),
    ];
}
