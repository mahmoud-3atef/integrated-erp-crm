using IntegratedErp.BuildingBlocks.Records;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;

namespace IntegratedErp.Modules.Workflow.Application;

/// <summary>The workflow tables processes can reach through the entity catalog.</summary>
internal sealed class WorkflowEntities(WorkflowDbContext db) : ModelEntitySource(db, Models)
{
    private static readonly IEntityModel[] Models =
    [
        new EntityModel<InternalRequest>(InternalRequestAdapter.ScreenCode, "الطلب الداخلي", "Internal request")
            .User(nameof(InternalRequest.CreatedBy), nameof(InternalRequest.DirectManagerId)),
    ];
}
