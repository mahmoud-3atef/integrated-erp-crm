using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.Modules.Organization.Domain.Settings;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Organization.Infrastructure;

internal sealed class OrganizationDbContext(DbContextOptions<OrganizationDbContext> options) : ModuleDbContext(options)
{
    public const string SchemaName = "organization";

    public override string Schema => SchemaName;

    public DbSet<Setting> Settings => Set<Setting>();
}
