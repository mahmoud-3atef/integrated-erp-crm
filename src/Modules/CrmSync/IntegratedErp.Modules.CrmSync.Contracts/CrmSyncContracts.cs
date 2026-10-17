namespace IntegratedErp.Modules.CrmSync.Contracts;

/// <summary>
/// Public surface of the CrmSync module: a read-only copy (staging) of the old CRM's records, refreshed by a sync
/// job, and the mapping of CRM lookups (nationalities, professions) to the new system's reference lists.
/// </summary>
public static class CrmSyncContracts
{
    public const string ModuleName = "CrmSync";
}
