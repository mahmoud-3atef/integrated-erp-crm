namespace IntegratedErp.Modules.CrmSync.Contracts;

/// <summary>
/// Public surface of the CrmSync module: a read-only copy (staging) of the old CRM's records, refreshed by a sync
/// job, and the mapping of CRM lookups (nationalities, professions) to the new system's reference lists.
/// </summary>
public static class CrmSyncContracts
{
    public const string ModuleName = "CrmSync";
}

/// <summary>One CRM record as copied to staging: its columns as a JSON object (lower-case column names).</summary>
public sealed record StagedRecordInfo(Guid CrmId, bool IsDeleted, DateTimeOffset LastSyncedAt, string Payload);

/// <summary>Read access to the CRM copy for the modules that build their records from it (current company).</summary>
public interface ICrmStaging
{
    /// <summary>Records of a CRM entity copied or changed after <paramref name="since"/> (all when null), deleted ones included.</summary>
    Task<IReadOnlyList<StagedRecordInfo>> ChangedSinceAsync(string entity, DateTimeOffset? since, CancellationToken cancellationToken);

    /// <summary>What each CRM lookup record of <paramref name="entity"/> (e.g. new_country) became in the reference lists.</summary>
    Task<IReadOnlyDictionary<Guid, string>> MappedCodesAsync(string entity, CancellationToken cancellationToken);
}

/// <summary>
/// A module that builds its records from the CRM copy. Called after every successful sync, in the context of the
/// CRM's company; it reads what changed through <see cref="ICrmStaging"/> and returns a one-line summary.
/// </summary>
public interface ICrmStagingConsumer
{
    string Name { get; }

    Task<string> ApplyAsync(CancellationToken cancellationToken);
}
