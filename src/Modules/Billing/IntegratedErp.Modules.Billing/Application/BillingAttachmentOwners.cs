using IntegratedErp.BuildingBlocks.Attachments;
using IntegratedErp.Modules.Billing.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

/// <summary>Billing records that take attachments: a receipt's proof of payment (the transfer's image, the bank's notice).</summary>
internal sealed class BillingAttachmentOwners(BillingDbContext db) : IAttachmentOwnerCheck
{
    public const string Receipt = "billing.receipt";

    public static readonly AttachmentOwnerDefinition[] All =
    [
        new(Receipt, BillingPermissions.ReceiptsView, BillingPermissions.ReceiptsManage, ManageCompanyWide: true),
    ];

    public IReadOnlyCollection<string> OwnerTypes { get; } = [Receipt];

    // Bound to the current company by the tenant filter (and row-level security).
    public async Task<bool> ExistsAsync(string ownerType, Guid ownerId, CancellationToken cancellationToken) =>
        ownerType == Receipt && await db.Receipts.AnyAsync(r => r.Id == ownerId, cancellationToken).ConfigureAwait(false);
}
