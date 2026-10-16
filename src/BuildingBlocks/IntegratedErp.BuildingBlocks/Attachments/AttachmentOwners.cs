using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace IntegratedErp.BuildingBlocks.Attachments;

/// <summary>
/// A kind of record that can carry attachments, declared by the module that owns it (e.g. <c>organization.legal_entity</c>).
/// Seeing the files needs <see cref="ViewPermission"/>; adding or removing them needs <see cref="ManagePermission"/>
/// (for all commercial registrations when <see cref="ManageCompanyWide"/>), exactly like the record itself.
/// </summary>
public sealed record AttachmentOwnerDefinition(string OwnerType, string ViewPermission, string ManagePermission, bool ManageCompanyWide);

/// <summary>Confirms that a record exists in the current company before files are attached to it.</summary>
public interface IAttachmentOwnerCheck
{
    IReadOnlyCollection<string> OwnerTypes { get; }

    Task<bool> ExistsAsync(string ownerType, Guid ownerId, CancellationToken cancellationToken);
}

public sealed class AttachmentOwnerCatalog(IEnumerable<AttachmentOwnerDefinition> definitions)
{
    private readonly Dictionary<string, AttachmentOwnerDefinition> _byType =
        definitions.GroupBy(d => d.OwnerType, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

    public AttachmentOwnerDefinition? Find(string ownerType) => _byType.GetValueOrDefault(ownerType ?? string.Empty);
}

public static class AttachmentOwnerExtensions
{
    /// <summary>Declares a module's attachment owners and the check that their records exist.</summary>
    public static IServiceCollection AddAttachmentOwners<TCheck>(this IServiceCollection services, params AttachmentOwnerDefinition[] definitions)
        where TCheck : class, IAttachmentOwnerCheck
    {
        ArgumentNullException.ThrowIfNull(definitions);
        foreach (var definition in definitions)
        {
            services.AddSingleton(definition);
        }

        services.TryAddSingleton<AttachmentOwnerCatalog>();
        services.AddScoped<IAttachmentOwnerCheck, TCheck>();
        return services;
    }
}
