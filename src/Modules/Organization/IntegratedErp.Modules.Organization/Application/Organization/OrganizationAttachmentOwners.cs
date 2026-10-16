using IntegratedErp.BuildingBlocks.Attachments;
using IntegratedErp.Modules.Organization.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Organization.Application.Organization;

/// <summary>Records of this module that can carry files; access follows the records' own permissions.</summary>
internal sealed class OrganizationAttachmentOwners(OrganizationDbContext db) : IAttachmentOwnerCheck
{
    public const string LegalEntity = "organization.legal_entity";
    public const string Branch = "organization.branch";

    public static readonly AttachmentOwnerDefinition[] All =
    [
        new(LegalEntity, OrganizationPermissions.LegalEntitiesView, OrganizationPermissions.LegalEntitiesManage, ManageCompanyWide: true),
        new(Branch, OrganizationPermissions.BranchesView, OrganizationPermissions.BranchesManage, ManageCompanyWide: true),
    ];

    public IReadOnlyCollection<string> OwnerTypes { get; } = [LegalEntity, Branch];

    // Both queries are bound to the current company by the tenant filter (and row-level security).
    public async Task<bool> ExistsAsync(string ownerType, Guid ownerId, CancellationToken cancellationToken) => ownerType switch
    {
        LegalEntity => await db.LegalEntities.AnyAsync(e => e.Id == ownerId, cancellationToken).ConfigureAwait(false),
        Branch => await db.Branches.AnyAsync(b => b.Id == ownerId, cancellationToken).ConfigureAwait(false),
        _ => false,
    };
}
