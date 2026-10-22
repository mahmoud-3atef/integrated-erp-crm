using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workflow.Domain;

/// <summary>
/// A value a company adds to a screen's record status (docs/02-target-architecture/19): always part of «in approval»
/// — a process's update step sets it while the record is in approval, and the record shows it as its status. The
/// statuses the code relies on stay in the code; an added value is never deleted once used, only stopped.
/// </summary>
public sealed class StatusValue : ITenantOwned
{
    private StatusValue()
    {
        Screen = string.Empty;
        Code = string.Empty;
        NameAr = string.Empty;
        NameEn = string.Empty;
        CreatedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string Screen { get; private set; }

    /// <summary>The value's key in processes and on records (never changes).</summary>
    public string Code { get; private set; }

    public string NameAr { get; private set; }

    public string NameEn { get; private set; }

    public int SortOrder { get; private set; }

    public bool IsActive { get; private set; }

    public string CreatedByName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static StatusValue Create(string screen, string code, string nameAr, string nameEn, int sortOrder, string by, DateTimeOffset at) => new()
    {
        Id = Guid.CreateVersion7(),
        Screen = screen,
        Code = code,
        NameAr = nameAr.Trim(),
        NameEn = nameEn.Trim(),
        SortOrder = sortOrder,
        IsActive = true,
        CreatedByName = by,
        CreatedAt = at,
    };

    public void Set(string nameAr, string nameEn, int sortOrder, bool isActive)
    {
        NameAr = nameAr.Trim();
        NameEn = nameEn.Trim();
        SortOrder = sortOrder;
        IsActive = isActive;
    }
}
