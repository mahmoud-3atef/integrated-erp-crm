using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace IntegratedErp.BuildingBlocks.Security;

/// <summary>
/// One permission a module declares (docs/02-target-architecture/14 §4.2): <c>{module}.{resource}.{action}</c>,
/// e.g. <c>organization.legal_entities.manage</c>. Names are shown in the roles screen in both languages.
/// </summary>
public sealed record PermissionDefinition(string Code, string GroupAr, string GroupEn, string NameAr, string NameEn)
{
    public const string ViewSuffix = ".view";

    /// <summary>Read-only permissions (granted by the built-in read-only role).</summary>
    public bool IsView => Code.EndsWith(ViewSuffix, StringComparison.Ordinal);
}

/// <summary>All permissions of the enabled modules. A disabled module contributes none.</summary>
public sealed class PermissionCatalog(IEnumerable<PermissionDefinition> definitions)
{
    private readonly Dictionary<string, PermissionDefinition> _byCode =
        definitions.GroupBy(d => d.Code, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

    /// <summary>In declaration order (modules list view before manage).</summary>
    public IReadOnlyCollection<PermissionDefinition> All => _byCode.Values;

    public bool Contains(string code) => _byCode.ContainsKey(code);
}

/// <summary>
/// What the current user may do in the current company. <c>null</c> legal entities = every commercial
/// registration of the company; otherwise only the listed ones.
/// </summary>
public sealed class UserPermissions
{
    public static readonly UserPermissions None = new(new Dictionary<string, IReadOnlySet<Guid>?>());

    private readonly IReadOnlyDictionary<string, IReadOnlySet<Guid>?> _grants;

    public UserPermissions(IReadOnlyDictionary<string, IReadOnlySet<Guid>?> grants) => _grants = grants;

    public IEnumerable<string> Codes => _grants.Keys;

    /// <summary>Granted at all (for any registration when <paramref name="legalEntityId"/> is null).</summary>
    public bool Has(string code, Guid? legalEntityId = null) =>
        _grants.TryGetValue(code, out var entities)
        && (entities is null || legalEntityId is null || entities.Contains(legalEntityId.Value));

    /// <summary>The registrations a permission covers: null = all, empty = none.</summary>
    public IReadOnlySet<Guid>? LegalEntitiesFor(string code) =>
        _grants.TryGetValue(code, out var entities) ? entities : new HashSet<Guid>();
}

/// <summary>Loads the current user's permissions for the current company (implemented by the Identity module).</summary>
public interface IPermissionService
{
    Task<UserPermissions> GetCurrentAsync(CancellationToken cancellationToken);
}

/// <param name="CompanyWide">
/// The resource belongs to the whole company (users, roles, company settings), so a grant limited to some
/// commercial registrations is not enough.
/// </param>
public sealed record PermissionRequirement(string Code, bool CompanyWide) : IAuthorizationRequirement;

/// <summary>Checks the permission on the server for every call — hiding a button in the UI is never the protection.</summary>
internal sealed class PermissionHandler(IPermissionService permissions) : AuthorizationHandler<PermissionRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        var mine = await permissions.GetCurrentAsync(CancellationToken.None).ConfigureAwait(false);
        if (requirement.CompanyWide ? mine.LegalEntitiesFor(requirement.Code) is null : mine.Has(requirement.Code))
        {
            context.Succeed(requirement);
        }
    }
}

public static class PermissionExtensions
{
    /// <summary>Declares a module's permissions (call from <c>IModule.RegisterServices</c>).</summary>
    public static IServiceCollection AddPermissions(this IServiceCollection services, params PermissionDefinition[] definitions)
    {
        ArgumentNullException.ThrowIfNull(definitions);
        foreach (var definition in definitions)
        {
            services.AddSingleton(definition);
        }

        services.TryAddSingleton<PermissionCatalog>();
        // Enumerable: the framework already registers its own IAuthorizationHandler.
        services.TryAddEnumerable(ServiceDescriptor.Scoped<IAuthorizationHandler, PermissionHandler>());
        return services;
    }

    /// <summary>
    /// Signed in to a company and holding <paramref name="code"/> there — for at least one commercial registration,
    /// or for all of them when <paramref name="companyWide"/>.
    /// </summary>
    public static TBuilder RequirePermission<TBuilder>(this TBuilder builder, string code, bool companyWide = false)
        where TBuilder : IEndpointConventionBuilder
    {
        var policy = new AuthorizationPolicyBuilder(PlatformAuthentication.SessionScheme)
            .RequireAuthenticatedUser()
            .RequireClaim(ErpClaims.TenantId)
            .AddRequirements(new PermissionRequirement(code, companyWide))
            .Build();
        return builder.RequireAuthorization(policy);
    }
}
