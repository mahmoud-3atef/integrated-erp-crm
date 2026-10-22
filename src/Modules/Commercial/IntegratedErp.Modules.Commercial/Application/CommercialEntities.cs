using IntegratedErp.BuildingBlocks.Records;
using IntegratedErp.Modules.Commercial.Domain;
using IntegratedErp.Modules.Commercial.Infrastructure;
using IntegratedErp.Modules.Identity.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;

namespace IntegratedErp.Modules.Commercial.Application;

/// <summary>The commercial tables processes can reach: projects (the manager also as a user), customers, contracts.</summary>
internal sealed class CommercialEntities(CommercialDbContext db, IUserDirectory users) : ModelEntitySource(db, Models)
{
    public const string Project = "commercial.project";
    public const string Customer = "commercial.customer";
    public const string Contract = "commercial.contract";

    private static readonly IEntityModel[] Models =
    [
        new EntityModel<Project>(Project, "المشروع", "Project")
            .Lookup(nameof(Domain.Project.CustomerId), Customer, "العميل", "Customer")
            .Lookup(nameof(Domain.Project.ContractId), Contract, "العقد", "Contract")
            .Hide(nameof(Domain.Project.RemovedInCrm))
            .Computed(new RecordField("manager_user", "مدير المشروع (المستخدم)", "Project manager (user)", RecordFieldType.User, Updatable: false)),
        new EntityModel<Customer>(Customer, "العميل", "Customer").Hide(nameof(Domain.Customer.RemovedInCrm)),
        new EntityModel<Contract>(Contract, "العقد", "Contract").Lookup(nameof(Domain.Contract.CustomerId), Customer, "العميل", "Customer"),
    ];

    /// <summary>The project's manager as a user here: the account signing in with the CRM owner's Windows account.</summary>
    protected override async Task EnrichAsync(string entity, Dictionary<string, string?> values, CancellationToken cancellationToken)
    {
        if (entity == Project && values.GetValueOrDefault("manager_login") is { } login
            && (await users.UsersByLoginsAsync([login], cancellationToken).ConfigureAwait(false)).TryGetValue(login, out var user))
        {
            values["manager_user"] = user.ToString();
        }
    }
}
