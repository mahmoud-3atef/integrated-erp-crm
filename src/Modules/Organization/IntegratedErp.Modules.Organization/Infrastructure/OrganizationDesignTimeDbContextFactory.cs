using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace IntegratedErp.Modules.Organization.Infrastructure;

/// <summary>Used only by <c>dotnet ef migrations add</c>; no database connection is opened.</summary>
internal sealed class OrganizationDesignTimeDbContextFactory : IDesignTimeDbContextFactory<OrganizationDbContext>
{
    public OrganizationDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";

        var options = new DbContextOptionsBuilder<OrganizationDbContext>();
        PersistenceExtensions.Configure(options, connectionString, OrganizationDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        var dependencies = new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System));

        return new OrganizationDbContext(options.Options, dependencies);
    }
}
