using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.BuildingBlocks.Modules;

/// <summary>A module and whether it is switched on in this deployment.</summary>
public sealed record ModuleDescriptor(string Name, bool Enabled);

/// <summary>
/// Holds the modules known to the host and which of them are enabled.
/// Enablement comes from configuration for now (<c>Modules:{Name}:Enabled</c>, default true);
/// per-tenant / per-legal-entity enablement is added with the Organization module.
/// </summary>
public sealed class ModuleRegistry
{
    private readonly IReadOnlyList<(IModule Module, bool Enabled)> _modules;

    public ModuleRegistry(IEnumerable<IModule> modules, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(modules);
        ArgumentNullException.ThrowIfNull(configuration);

        var list = modules.ToList();
        var duplicate = list.GroupBy(m => m.Name, StringComparer.OrdinalIgnoreCase).FirstOrDefault(g => g.Count() > 1);
        if (duplicate is not null)
        {
            throw new InvalidOperationException($"Module name '{duplicate.Key}' is registered more than once.");
        }

        _modules = list
            .Select(m => (m, configuration.GetValue($"Modules:{m.Name}:Enabled", defaultValue: true)))
            .ToList();
    }

    public IEnumerable<IModule> EnabledModules => _modules.Where(m => m.Enabled).Select(m => m.Module);

    public IReadOnlyList<ModuleDescriptor> Describe() =>
        _modules.Select(m => new ModuleDescriptor(m.Module.Name, m.Enabled)).ToList();
}

public static class ModuleRegistrationExtensions
{
    /// <summary>Registers the given modules; only enabled modules get their services registered.</summary>
    public static IServiceCollection AddModules(
        this IServiceCollection services,
        IConfiguration configuration,
        params IModule[] modules)
    {
        ArgumentNullException.ThrowIfNull(services);

        var registry = new ModuleRegistry(modules, configuration);
        services.AddSingleton(registry);

        foreach (var module in registry.EnabledModules)
        {
            module.RegisterServices(services, configuration);
        }

        return services;
    }

    /// <summary>Maps the endpoints of every enabled module.</summary>
    public static IEndpointRouteBuilder MapModules(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var registry = app.Services.GetRequiredService<ModuleRegistry>();
        foreach (var module in registry.EnabledModules)
        {
            module.MapEndpoints(app);
        }

        return app;
    }
}
