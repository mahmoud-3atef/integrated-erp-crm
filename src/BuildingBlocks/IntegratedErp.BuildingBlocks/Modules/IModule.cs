using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.BuildingBlocks.Modules;

/// <summary>
/// Entry point of a business module. Every module implements this exactly once; the host
/// discovers modules through it and nothing else. Modules talk to each other only through
/// their <c>.Contracts</c> assembly or published integration events.
/// </summary>
public interface IModule
{
    /// <summary>Stable module key, used in configuration (<c>Modules:{Name}:Enabled</c>) and routes.</summary>
    string Name { get; }

    void RegisterServices(IServiceCollection services, IConfiguration configuration);

    void MapEndpoints(IEndpointRouteBuilder endpoints);
}
