using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Organization.Contracts;

/// <summary>One reference list item of the current company, as other modules may see it.</summary>
public sealed record ReferenceItemInfo(string ListCode, string Code, string NameAr, string NameEn, bool IsActive);

/// <summary>
/// Reference lists of the current company for other modules: validate a stored code, or show its name.
/// Lists are declared with <c>AddReferenceLists</c>; logic may depend only on system item codes.
/// </summary>
public interface IReferenceData
{
    /// <summary>Active items of a list, in display order.</summary>
    Task<IReadOnlyList<ReferenceItemInfo>> ListAsync(string listCode, CancellationToken cancellationToken);

    /// <summary>All items of a list, switched-off ones included (to show the name of a code stored earlier).</summary>
    Task<IReadOnlyList<ReferenceItemInfo>> ListAllAsync(string listCode, CancellationToken cancellationToken);

    /// <summary>Whether <paramref name="code"/> is an active item of the list (codes are case-insensitive).</summary>
    Task<bool> IsValidAsync(string listCode, string code, CancellationToken cancellationToken);
}

/// <summary>Codes of the reference lists other modules fill or read.</summary>
public static class ReferenceListCodes
{
    public const string Nationalities = "nationalities";
    public const string Professions = "professions";
}

/// <summary>An item brought from another system; its code must be 1-30 letters, digits, '-' or '_'.</summary>
public sealed record ImportedReferenceItem(string Code, string NameAr, string NameEn, int SortOrder);

public sealed record ReferenceImportResult(int Created, int AlreadyPresent);

/// <summary>
/// Adds items to a reference list of the current company (e.g. nationalities and professions from the old CRM).
/// Items whose code already exists are left as they are, so names edited in the system are never overwritten and
/// importing again creates no duplicates.
/// </summary>
public interface IReferenceDataImport
{
    Task<Result<ReferenceImportResult>> ImportAsync(string listCode, IReadOnlyList<ImportedReferenceItem> items, CancellationToken cancellationToken);

    /// <summary>Switches off items that were merged into others (system items are never switched off).</summary>
    Task<Result> DeactivateAsync(string listCode, IReadOnlyList<string> codes, CancellationToken cancellationToken);
}
