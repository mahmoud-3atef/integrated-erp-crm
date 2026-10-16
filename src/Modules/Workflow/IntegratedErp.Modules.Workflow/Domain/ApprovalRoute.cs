using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workflow.Domain;

/// <summary>Who approves a stage.</summary>
public enum ApproverKind
{
    /// <summary>One named user.</summary>
    User = 0,

    /// <summary>Anyone holding a role (for the document's commercial registration or for all of them).</summary>
    Role = 1,

    /// <summary>A user the document supplies when submitted (e.g. project manager, direct manager).</summary>
    Dynamic = 2,
}

/// <summary>
/// The approval route of one document type in one company. Every change creates a new version; a document
/// in approval keeps the version it started with, so editing a route never changes running approvals.
/// </summary>
public sealed class ApprovalRoute : ITenantOwned
{
    public const int MaxStages = 10;

    private readonly List<ApprovalRouteVersion> _versions = [];

    private ApprovalRoute()
    {
        DocumentType = string.Empty;
    }

    public ApprovalRoute(string documentType)
    {
        Id = Guid.CreateVersion7();
        DocumentType = documentType;
        IsActive = true;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string DocumentType { get; private set; }

    /// <summary>Inactive: documents of this type cannot be submitted.</summary>
    public bool IsActive { get; private set; }

    public int CurrentVersion { get; private set; }

    public IReadOnlyCollection<ApprovalRouteVersion> Versions => _versions;

    public ApprovalRouteVersion? Current => _versions.FirstOrDefault(v => v.Version == CurrentVersion);

    /// <summary>Validates the stages and adds them as the next version.</summary>
    public Result<ApprovalRouteVersion> Publish(IReadOnlyList<StageInput> stages, IReadOnlyCollection<string> dynamicKeys, string publishedBy, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(stages);
        ArgumentNullException.ThrowIfNull(dynamicKeys);
        if (stages.Count is 0 or > MaxStages)
        {
            return Result.Failure<ApprovalRouteVersion>(Error.Validation("route_stage_count", "A route needs 1 to 10 stages."));
        }

        for (var i = 0; i < stages.Count; i++)
        {
            var stage = stages[i];
            var valid = stage.NameAr.Trim().Length is > 0 and <= 200 && stage.NameEn.Trim().Length is > 0 and <= 200 && stage.Kind switch
            {
                ApproverKind.User => stage.UserId is not null,
                ApproverKind.Role => stage.RoleId is not null,
                ApproverKind.Dynamic => stage.DynamicKey is not null && dynamicKeys.Contains(stage.DynamicKey),
                _ => false,
            };
            if (!valid)
            {
                return Result.Failure<ApprovalRouteVersion>(Error.Validation("route_stage_invalid", $"Stage {i + 1} needs names and an approver."));
            }
        }

        var version = new ApprovalRouteVersion(Id, TenantId, CurrentVersion + 1, publishedBy, at, stages);
        _versions.Add(version);
        CurrentVersion = version.Version;
        return Result.Success(version);
    }

    public void SetActive(bool active) => IsActive = active;
}

public sealed record StageInput(string NameAr, string NameEn, ApproverKind Kind, Guid? UserId, Guid? RoleId, string? DynamicKey);

public sealed class ApprovalRouteVersion : ITenantOwned
{
    private readonly List<ApprovalStage> _stages = [];

    private ApprovalRouteVersion()
    {
        PublishedBy = string.Empty;
    }

    internal ApprovalRouteVersion(Guid routeId, Guid tenantId, int version, string publishedBy, DateTimeOffset publishedAt, IReadOnlyList<StageInput> stages)
    {
        Id = Guid.CreateVersion7();
        RouteId = routeId;
        TenantId = tenantId;
        Version = version;
        PublishedBy = publishedBy;
        PublishedAt = publishedAt;
        for (var i = 0; i < stages.Count; i++)
        {
            _stages.Add(new ApprovalStage(Id, tenantId, i + 1, stages[i]));
        }
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid RouteId { get; private set; }

    public int Version { get; private set; }

    public string PublishedBy { get; private set; }

    public DateTimeOffset PublishedAt { get; private set; }

    public IReadOnlyCollection<ApprovalStage> Stages => _stages;
}

public sealed class ApprovalStage : ITenantOwned
{
    private ApprovalStage()
    {
        NameAr = string.Empty;
        NameEn = string.Empty;
    }

    internal ApprovalStage(Guid versionId, Guid tenantId, int order, StageInput input)
    {
        Id = Guid.CreateVersion7();
        VersionId = versionId;
        TenantId = tenantId;
        Order = order;
        NameAr = input.NameAr.Trim();
        NameEn = input.NameEn.Trim();
        Kind = input.Kind;
        UserId = input.Kind == ApproverKind.User ? input.UserId : null;
        RoleId = input.Kind == ApproverKind.Role ? input.RoleId : null;
        DynamicKey = input.Kind == ApproverKind.Dynamic ? input.DynamicKey : null;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid VersionId { get; private set; }

    public int Order { get; private set; }

    public string NameAr { get; private set; }

    public string NameEn { get; private set; }

    public ApproverKind Kind { get; private set; }

    public Guid? UserId { get; private set; }

    public Guid? RoleId { get; private set; }

    public string? DynamicKey { get; private set; }
}
