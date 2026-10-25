using IntegratedErp.BuildingBlocks.Records;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;

namespace IntegratedErp.Modules.Workforce.Application;

/// <summary>The workforce tables processes can reach: the workers and their salary changes.</summary>
internal sealed class WorkforceEntities(WorkforceDbContext db) : ModelEntitySource(db, Models)
{
    public const string Worker = "workforce.worker";
    public const string SalaryChange = WorkerSalaryChangeAdapter.ScreenCode;

    private static readonly IEntityModel[] Models =
    [
        new EntityModel<Worker>(Worker, "العامل", "Worker"),
        new EntityModel<WorkerSalaryChange>(SalaryChange, "تعديل راتب عامل", "Worker salary change"),
    ];
}
