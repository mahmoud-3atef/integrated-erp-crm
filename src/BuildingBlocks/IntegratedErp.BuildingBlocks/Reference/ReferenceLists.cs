using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace IntegratedErp.BuildingBlocks.Reference;

/// <summary>
/// An item every company has and the code relies on (docs/02-target-architecture/14: "a status or type is a fixed
/// code; labels are for display only"). Its code never changes and it cannot be switched off; names can be edited.
/// </summary>
public sealed record SystemReferenceItem(string Code, string NameAr, string NameEn);

/// <summary>
/// A reference list declared by a module (e.g. nationalities, professions, return reasons). Companies add their own
/// items; logic may only depend on <see cref="SystemItems"/> codes, never on names.
/// </summary>
public sealed record ReferenceListDefinition(
    string Code,
    string NameAr,
    string NameEn,
    string DescriptionAr,
    string DescriptionEn,
    IReadOnlyList<SystemReferenceItem> SystemItems)
{
    public ReferenceListDefinition(string code, string nameAr, string nameEn, string descriptionAr, string descriptionEn)
        : this(code, nameAr, nameEn, descriptionAr, descriptionEn, [])
    {
    }
}

/// <summary>All reference lists of the enabled modules, in declaration order.</summary>
public sealed class ReferenceListCatalog(IEnumerable<ReferenceListDefinition> definitions)
{
    private readonly Dictionary<string, ReferenceListDefinition> _byCode =
        definitions.GroupBy(d => d.Code, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

    public IReadOnlyCollection<ReferenceListDefinition> All => _byCode.Values;

    public ReferenceListDefinition? Find(string code) => _byCode.GetValueOrDefault(code ?? string.Empty);
}

public static class ReferenceListExtensions
{
    /// <summary>Declares a module's reference lists (call from <c>IModule.RegisterServices</c>).</summary>
    public static IServiceCollection AddReferenceLists(this IServiceCollection services, params ReferenceListDefinition[] definitions)
    {
        ArgumentNullException.ThrowIfNull(definitions);
        foreach (var definition in definitions)
        {
            services.AddSingleton(definition);
        }

        services.TryAddSingleton<ReferenceListCatalog>();
        return services;
    }
}
