using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Commercial.Api;
using IntegratedErp.Modules.Commercial.Application;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Commercial.Infrastructure;
using IntegratedErp.Modules.CrmSync.Contracts;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Commercial;

/// <summary>
/// Commercial module: customers, their contracts and the projects workers are placed on. In the parallel phase they
/// are built from the old CRM's copy after every sync (customers and projects created from 2025 only), and the price
/// packages are created by the user (with suggestions from the prices on the old system's open work starts).
/// </summary>
public sealed class CommercialModule : IModule
{
    public string Name => CommercialContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<CommercialDbContext>(configuration, CommercialDbContext.SchemaName);
        services.AddScoped<CommercialQueries>();
        services.AddScoped<PricingQueries>();
        services.AddScoped<PricingService>();
        services.AddScoped<IProjectDirectory, ProjectDirectory>();
        services.AddScoped<IPriceCatalog>(sp => sp.GetRequiredService<PricingService>());
        services.AddScoped<CommercialImportService>();
        services.AddScoped<ICrmStagingConsumer>(sp => sp.GetRequiredService<CommercialImportService>());
        services.AddScoped<PricingImportService>();
        services.AddScoped<ICrmStagingConsumer>(sp => sp.GetRequiredService<PricingImportService>());
        services.AddPermissions(CommercialPermissions.All);
        services.AddNumberSequences(
            new NumberSequenceDefinition("price_package", CommercialDbContext.SchemaName, "المبيعات والعقود", "Sales and contracts", "الباقات السعرية", "Price packages", "PKG-{N:5}", NumberReset.Never),
            new NumberSequenceDefinition("invoice", CommercialDbContext.SchemaName, "المبيعات والعقود", "Sales and contracts", "فواتير المشاريع", "Project invoices", "INV{N:5}", NumberReset.Never, InUse: false));
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapCommercialEndpoints();
}

internal static class CommercialPermissions
{
    public const string CustomersView = "commercial.customers.view";
    public const string ProjectsView = "commercial.projects.view";
    public const string PricesView = "commercial.prices.view";
    public const string PricesManage = "commercial.prices.manage";

    private const string GroupAr = "العملاء والعقود";
    private const string GroupEn = "Customers and contracts";

    public static readonly PermissionDefinition[] All =
    [
        new(CustomersView, GroupAr, GroupEn, "عرض العملاء", "View customers"),
        new(ProjectsView, GroupAr, GroupEn, "عرض المشاريع والعقود", "View projects and contracts"),
        new(PricesView, GroupAr, GroupEn, "عرض الباقات السعرية وأسعار العمالة", "View price packages and worker prices"),
        new(PricesManage, GroupAr, GroupEn, "إضافة الباقات السعرية وتعديلها وإيقافها", "Add, edit and stop price packages"),
    ];
}
