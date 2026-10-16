using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Organization.Domain.Reference;

/// <summary>
/// One entry of a reference list in one company (e.g. nationality "PHL" — الفلبين / Philippines).
/// Records elsewhere store the <see cref="Code"/>; names are for display only and may be edited.
/// </summary>
public sealed class ReferenceItem : ITenantOwned
{
    public const int CodeMaxLength = 30;
    public const int NameMaxLength = 200;

    private ReferenceItem()
    {
        ListCode = string.Empty;
        Code = string.Empty;
        NameAr = string.Empty;
        NameEn = string.Empty;
    }

    private ReferenceItem(Guid tenantId, string listCode, string code, bool isSystem)
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        ListCode = listCode;
        Code = code;
        NameAr = string.Empty;
        NameEn = string.Empty;
        IsSystem = isSystem;
        IsActive = true;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string ListCode { get; private set; }

    /// <summary>Unique within the list, upper-case. Never changes.</summary>
    public string Code { get; private set; }

    public string NameAr { get; private set; }

    public string NameEn { get; private set; }

    public int SortOrder { get; private set; }

    /// <summary>Declared by a module and relied on by its logic: cannot be switched off.</summary>
    public bool IsSystem { get; private set; }

    public bool IsActive { get; private set; }

    public static string NormalizeCode(string? code) => (code ?? string.Empty).Trim().ToUpperInvariant();

    public static Result<ReferenceItem> Create(string listCode, string code, string nameAr, string nameEn, int sortOrder) =>
        Build(Guid.Empty, listCode, code, nameAr, nameEn, sortOrder, isSystem: false);

    /// <summary>A system item seeded for a company from the list definition.</summary>
    public static ReferenceItem System(Guid tenantId, string listCode, string code, string nameAr, string nameEn, int sortOrder) =>
        Build(tenantId, listCode, code, nameAr, nameEn, sortOrder, isSystem: true).Value;

    public Result Update(string nameAr, string nameEn, int sortOrder)
    {
        nameAr = (nameAr ?? string.Empty).Trim();
        nameEn = (nameEn ?? string.Empty).Trim();
        if (nameAr.Length is 0 or > NameMaxLength || nameEn.Length is 0 or > NameMaxLength)
        {
            return Result.Failure(Error.Validation("reference_name_required", "Arabic and English names are required."));
        }

        NameAr = nameAr;
        NameEn = nameEn;
        SortOrder = sortOrder;
        return Result.Success();
    }

    public Result SetActive(bool active)
    {
        if (!active && IsSystem)
        {
            return Result.Failure(Error.Validation("reference_item_system", "System items cannot be switched off."));
        }

        IsActive = active;
        return Result.Success();
    }

    private static Result<ReferenceItem> Build(Guid tenantId, string listCode, string code, string nameAr, string nameEn, int sortOrder, bool isSystem)
    {
        var normalized = NormalizeCode(code);
        if (normalized.Length is 0 or > CodeMaxLength || !normalized.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_'))
        {
            return Result.Failure<ReferenceItem>(Error.Validation("reference_code_invalid", "Code: 1-30 letters, digits, '-' or '_'."));
        }

        var item = new ReferenceItem(tenantId, listCode, normalized, isSystem);
        var updated = item.Update(nameAr, nameEn, sortOrder);
        return updated.IsFailure ? Result.Failure<ReferenceItem>(updated.Error) : Result.Success(item);
    }
}
