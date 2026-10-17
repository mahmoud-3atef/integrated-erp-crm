using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.CrmSync.Domain;

/// <summary>
/// A copy of one CRM record (all its columns as JSON), as last read from the CRM. Never edited by people; the sync
/// job keeps it current and marks it deleted when a full sync no longer finds it.
/// </summary>
public sealed class StagedRecord : ITenantOwned, INotAudited
{
    private StagedRecord()
    {
        Entity = string.Empty;
        Payload = string.Empty;
        PayloadHash = string.Empty;
    }

    public StagedRecord(string entity, Guid crmId, DateTime? createdOn, DateTime? modifiedOn, int? stateCode, string payload, string payloadHash, Guid runId, DateTimeOffset now)
    {
        Id = Guid.CreateVersion7();
        Entity = entity;
        CrmId = crmId;
        CreatedOn = createdOn;
        ModifiedOn = modifiedOn;
        StateCode = stateCode;
        Payload = payload;
        PayloadHash = payloadHash;
        LastSeenRunId = runId;
        FirstSyncedAt = now;
        LastSyncedAt = now;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string Entity { get; private set; }

    public Guid CrmId { get; private set; }

    /// <summary>CRM <c>createdon</c> (UTC).</summary>
    public DateTime? CreatedOn { get; private set; }

    /// <summary>CRM <c>modifiedon</c> (UTC).</summary>
    public DateTime? ModifiedOn { get; private set; }

    /// <summary>CRM <c>statecode</c>: 0 active, 1 inactive.</summary>
    public int? StateCode { get; private set; }

    public string Payload { get; private set; }

    public string PayloadHash { get; private set; }

    public Guid LastSeenRunId { get; private set; }

    public DateTimeOffset FirstSyncedAt { get; private set; }

    public DateTimeOffset LastSyncedAt { get; private set; }

    public bool IsDeleted { get; private set; }

    /// <summary>Records the latest copy; returns whether anything changed.</summary>
    public bool Refresh(DateTime? createdOn, DateTime? modifiedOn, int? stateCode, string payload, string payloadHash, Guid runId, DateTimeOffset now)
    {
        LastSeenRunId = runId;
        CreatedOn = createdOn;
        if (PayloadHash == payloadHash && !IsDeleted)
        {
            return false;
        }

        ModifiedOn = modifiedOn;
        StateCode = stateCode;
        Payload = payload;
        PayloadHash = payloadHash;
        LastSyncedAt = now;
        IsDeleted = false;
        return true;
    }
}

/// <summary>Where the sync of one entity stands: the last change already copied (the next incremental run starts after it).</summary>
public sealed class SyncState : ITenantOwned
{
    private SyncState()
    {
        Entity = string.Empty;
    }

    public SyncState(string entity)
    {
        Id = Guid.CreateVersion7();
        Entity = entity;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string Entity { get; private set; }

    /// <summary>The (modifiedon, id) of the last record copied, in the order the CRM was read.</summary>
    public DateTime? WatermarkModifiedOn { get; private set; }

    public Guid? WatermarkId { get; private set; }

    public DateTimeOffset? LastSucceededAt { get; private set; }

    public DateTimeOffset? LastFailedAt { get; private set; }

    public string? LastError { get; private set; }

    public void Advance(DateTime modifiedOn, Guid id)
    {
        WatermarkModifiedOn = modifiedOn;
        WatermarkId = id;
    }

    /// <summary>A full sync reads everything again from the start.</summary>
    public void Restart()
    {
        WatermarkModifiedOn = null;
        WatermarkId = null;
    }

    public void Succeeded(DateTimeOffset at)
    {
        LastSucceededAt = at;
        LastError = null;
    }

    public void Failed(string error, DateTimeOffset at)
    {
        LastFailedAt = at;
        LastError = error.Length > 1000 ? error[..1000] : error;
    }
}

public enum SyncMode
{
    /// <summary>Only records changed since the last run.</summary>
    Incremental,

    /// <summary>Everything again; records no longer in the CRM are marked deleted.</summary>
    Full,
}

public enum SyncRunStatus
{
    Queued,
    Running,
    Succeeded,

    /// <summary>Some entities failed; the others were copied.</summary>
    PartlyFailed,
    Failed,
}

/// <summary>What one entity's sync did in a run.</summary>
/// <summary>What one entity's sync did in a run (<paramref name="Excluded"/>: staged records older than the entity's start date, removed).</summary>
public sealed record EntitySyncResult(string Entity, int Read, int Inserted, int Updated, int Deleted, string? Error, int Excluded = 0);

/// <summary>One run of the sync job: who or what started it, and what each entity did.</summary>
public sealed class SyncRun : ITenantOwned
{
    private SyncRun()
    {
        RequestedBy = string.Empty;
    }

    public SyncRun(SyncMode mode, string requestedBy, DateTimeOffset at)
    {
        Id = Guid.CreateVersion7();
        Mode = mode;
        RequestedBy = requestedBy;
        RequestedAt = at;
        Status = SyncRunStatus.Queued;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public SyncMode Mode { get; private set; }

    public string RequestedBy { get; private set; }

    public DateTimeOffset RequestedAt { get; private set; }

    public DateTimeOffset? StartedAt { get; private set; }

    public DateTimeOffset? FinishedAt { get; private set; }

    public SyncRunStatus Status { get; private set; }

    /// <summary>JSON list of <see cref="EntitySyncResult"/>.</summary>
    public string? Results { get; private set; }

    public string? Error { get; private set; }

    public bool IsActive => Status is SyncRunStatus.Queued or SyncRunStatus.Running;

    public void Start(DateTimeOffset at)
    {
        Status = SyncRunStatus.Running;
        StartedAt = at;
    }

    public void Finish(SyncRunStatus status, string results, string? error, DateTimeOffset at)
    {
        Status = status;
        Results = results;
        Error = error is { Length: > 1000 } ? error[..1000] : error;
        FinishedAt = at;
    }
}

/// <summary>How a CRM lookup record was matched to a reference list item.</summary>
public enum MatchRule
{
    /// <summary>Its own name (after spelling normalisation) is the item.</summary>
    Name,

    /// <summary>An exact copy of another record (same name); merged into it.</summary>
    Duplicate,

    /// <summary>Merged into another record with the same name in a different spelling (أ/ا, ة/ه, ى/ي, spaces).</summary>
    Spelling,

    /// <summary>Matched by its English name (the record had no Arabic name).</summary>
    EnglishName,

    /// <summary>A known alternative name (e.g. "KSA", "Srilanka").</summary>
    Alias,

    /// <summary>Arabic and English names point to different items; the Arabic one was used. Needs review.</summary>
    Conflict,

    /// <summary>Not a real item (e.g. "Block", "عام"); records using it are left empty. Needs review.</summary>
    Unmapped,

    /// <summary>Chosen by a person (merged into another item, or linked by hand); kept by every later import.</summary>
    Manual,
}

/// <summary>A CRM lookup record (a country or a profession) and the reference item it became.</summary>
public sealed class ReferenceMapping : ITenantOwned, INotAudited
{
    private ReferenceMapping()
    {
        Entity = string.Empty;
        CrmName = string.Empty;
        ListCode = string.Empty;
    }

    public ReferenceMapping(string entity, Guid crmId, string crmName, string? crmCode, string listCode, string? itemCode, MatchRule rule, int usage, DateTimeOffset at)
    {
        Id = Guid.CreateVersion7();
        Entity = entity;
        CrmId = crmId;
        CrmName = crmName;
        CrmCode = crmCode;
        ListCode = listCode;
        ItemCode = itemCode;
        Rule = rule;
        Usage = usage;
        MappedAt = at;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string Entity { get; private set; }

    public Guid CrmId { get; private set; }

    public string CrmName { get; private set; }

    public string? CrmCode { get; private set; }

    public string ListCode { get; private set; }

    /// <summary>Null when <see cref="Rule"/> is <see cref="MatchRule.Unmapped"/>.</summary>
    public string? ItemCode { get; private set; }

    public MatchRule Rule { get; private set; }

    /// <summary>How many CRM employees use the record (to judge what a merge or a gap affects).</summary>
    public int Usage { get; private set; }

    public DateTimeOffset MappedAt { get; private set; }

    public void Update(string crmName, string? crmCode, string? itemCode, MatchRule rule, int usage, DateTimeOffset at)
    {
        CrmName = crmName;
        CrmCode = crmCode;
        ItemCode = itemCode;
        Rule = rule;
        Usage = usage;
        MappedAt = at;
    }
}
