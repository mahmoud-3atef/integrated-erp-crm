using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace IntegratedErp.BuildingBlocks;

public static class PlatformServices
{
    /// <summary>Core services every host needs: execution context (tenant/user), clock, persistence plumbing.</summary>
    public static IServiceCollection AddPlatformCore(this IServiceCollection services)
    {
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<IClock, SystemClock>();

        services.AddScoped<ExecutionContextAccessor>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<ExecutionContextAccessor>());
        services.AddScoped<ICurrentUser>(sp => sp.GetRequiredService<ExecutionContextAccessor>());
        services.AddScoped<ModuleDbContextDependencies>();

        services.AddScoped<TenantSessionContextInterceptor>();
        services.AddTransient<DatabaseMigrator>();
        services.AddScoped<NumberSequenceService>();
        services.TryAddSingleton<NumberingCatalog>();

        return services;
    }
}
