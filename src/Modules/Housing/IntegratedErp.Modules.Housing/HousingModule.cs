using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.Housing.Api;
using IntegratedErp.Modules.Housing.Application;
using IntegratedErp.Modules.Housing.Contracts;
using IntegratedErp.Modules.Housing.Infrastructure;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Housing;

/// <summary>
/// Housing module (docs/02-target-architecture/01 §7): the company's buildings and rooms, each room holding workers up
/// to its capacity, and which worker in housing is in which room. Rooms free themselves when workers leave housing.
/// </summary>
public sealed class HousingModule : IModule
{
    public string Name => HousingContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<HousingDbContext>(configuration, HousingDbContext.SchemaName);
        services.AddScoped<HousingService>();
        services.AddScoped<IHousingRooms>(sp => sp.GetRequiredService<HousingService>());
        services.AddScoped<HousingQueries>();
        services.AddScoped<HousingReleaseService>();
        services.AddScoped<ICrmStagingConsumer>(sp => sp.GetRequiredService<HousingReleaseService>());
        services.AddPermissions(HousingPermissions.All);
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapHousingEndpoints();
}

internal static class HousingPermissions
{
    public const string View = "housing.view";
    public const string Manage = "housing.manage";
    public const string Assign = "housing.assign";

    private const string GroupAr = "السكن";
    private const string GroupEn = "Housing";

    public static readonly PermissionDefinition[] All =
    [
        new(View, GroupAr, GroupEn, "عرض المساكن والغرف وساكنيها", "View buildings, rooms and who lives in them"),
        new(Manage, GroupAr, GroupEn, "إدارة المساكن والغرف", "Manage buildings and rooms"),
        new(Assign, GroupAr, GroupEn, "تسكين العمالة في الغرف ونقلها", "House workers in rooms and move them"),
    ];
}
