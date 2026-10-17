using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.CrmSync.Application;

/// <summary>The CRM copy as other modules read it (current company only, by the tenant filter and RLS).</summary>
internal sealed class CrmStaging(CrmSyncDbContext db) : ICrmStaging
{
    public async Task<IReadOnlyList<StagedRecordInfo>> ChangedSinceAsync(string entity, DateTimeOffset? since, CancellationToken cancellationToken) =>
        await db.Records.AsNoTracking()
            .Where(r => r.Entity == entity && (since == null || r.LastSyncedAt > since))
            .Select(r => new StagedRecordInfo(r.CrmId, r.IsDeleted, r.LastSyncedAt, r.Payload))
            .ToListAsync(cancellationToken).ConfigureAwait(false);

    public async Task<IReadOnlyDictionary<Guid, string>> MappedCodesAsync(string entity, CancellationToken cancellationToken) =>
        await db.Mappings.AsNoTracking()
            .Where(m => m.Entity == entity && m.ItemCode != null)
            .ToDictionaryAsync(m => m.CrmId, m => m.ItemCode!, cancellationToken).ConfigureAwait(false);
}
