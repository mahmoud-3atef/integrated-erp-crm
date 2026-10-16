using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace IntegratedErp.BuildingBlocks.Approvals;

/// <summary>
/// An approver that only the document knows when it is submitted, e.g. <c>project_manager</c> or
/// <c>direct_manager</c>: the owning module passes the user for this key with each submission.
/// </summary>
public sealed record DynamicApproverKey(string Key, string NameAr, string NameEn);

/// <summary>
/// A kind of document that goes through an approval route (e.g. <c>workflow.internal_request</c>), declared by its
/// module. <see cref="LinkTemplate"/> is the in-app page of one document, with <c>{id}</c> for its id.
/// </summary>
public sealed record ApprovalDocumentDefinition(
    string Code,
    string NameAr,
    string NameEn,
    string LinkTemplate,
    IReadOnlyList<DynamicApproverKey> DynamicApprovers)
{
    public string LinkTo(Guid documentId) => LinkTemplate.Replace("{id}", documentId.ToString(), StringComparison.Ordinal);
}

public sealed class ApprovalDocumentCatalog(IEnumerable<ApprovalDocumentDefinition> definitions)
{
    private readonly Dictionary<string, ApprovalDocumentDefinition> _byCode =
        definitions.GroupBy(d => d.Code, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

    public IReadOnlyCollection<ApprovalDocumentDefinition> All => _byCode.Values;

    public ApprovalDocumentDefinition? Find(string code) => _byCode.GetValueOrDefault(code ?? string.Empty);
}

public static class ApprovalDocumentExtensions
{
    /// <summary>Declares a module's approvable documents (call from <c>IModule.RegisterServices</c>).</summary>
    public static IServiceCollection AddApprovalDocuments(this IServiceCollection services, params ApprovalDocumentDefinition[] definitions)
    {
        ArgumentNullException.ThrowIfNull(definitions);
        foreach (var definition in definitions)
        {
            services.AddSingleton(definition);
        }

        services.TryAddSingleton<ApprovalDocumentCatalog>();
        return services;
    }
}
