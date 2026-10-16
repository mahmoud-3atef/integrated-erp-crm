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

    /// <summary>Whether <paramref name="code"/> is an active item of the list (codes are case-insensitive).</summary>
    Task<bool> IsValidAsync(string listCode, string code, CancellationToken cancellationToken);
}
