using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.Modules.Organization.Domain.LegalEntities;
using IntegratedErp.Modules.Organization.Domain.Settings;
using IntegratedErp.Modules.Organization.Domain.Tenants;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Organization.Infrastructure;

internal sealed class OrganizationDbContext(DbContextOptions<OrganizationDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "organization";

    public override string Schema => SchemaName;

    public DbSet<Setting> Settings => Set<Setting>();

    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<LegalEntity> LegalEntities => Set<LegalEntity>();
}
