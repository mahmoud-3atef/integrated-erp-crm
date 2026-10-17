using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Housing.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Housing.Infrastructure;

internal sealed class HousingDbContext(DbContextOptions<HousingDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "housing";

    public override string Schema => SchemaName;

    public DbSet<Building> Buildings => Set<Building>();

    public DbSet<Room> Rooms => Set<Room>();

    public DbSet<RoomAssignment> Assignments => Set<RoomAssignment>();
}

internal sealed class BuildingConfiguration : IEntityTypeConfiguration<Building>
{
    public void Configure(EntityTypeBuilder<Building> builder)
    {
        builder.ToTable("building");
        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id).ValueGeneratedNever();
        builder.Property(b => b.Name).HasMaxLength(200).IsRequired();
        builder.Property(b => b.Type).HasConversion<string>().HasMaxLength(20);
        builder.Property(b => b.City).HasMaxLength(100);
        builder.Property(b => b.Address).HasMaxLength(500);
        builder.Property(b => b.ProjectName).HasMaxLength(300);
        builder.Property(b => b.Notes).HasMaxLength(2000);
        builder.HasIndex(b => new { b.TenantId, b.Name }).IsUnique();
    }
}

internal sealed class RoomConfiguration : IEntityTypeConfiguration<Room>
{
    public void Configure(EntityTypeBuilder<Room> builder)
    {
        builder.ToTable("room");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.Number).HasMaxLength(100).IsRequired();
        builder.Property(r => r.Floor).HasMaxLength(50);
        builder.Property(r => r.Notes).HasMaxLength(1000);
        builder.HasOne<Building>().WithMany().HasForeignKey(r => r.BuildingId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(r => new { r.TenantId, r.BuildingId, r.Number }).IsUnique();
    }
}

internal sealed class RoomAssignmentConfiguration : IEntityTypeConfiguration<RoomAssignment>
{
    public void Configure(EntityTypeBuilder<RoomAssignment> builder)
    {
        builder.ToTable("room_assignment");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.WorkerNo).HasMaxLength(50).IsRequired();
        builder.Property(a => a.Name).HasMaxLength(300).IsRequired();
        builder.Property(a => a.SourceType).HasMaxLength(30).IsRequired();
        builder.Property(a => a.SourceNo).HasMaxLength(50);
        builder.Property(a => a.AssignedByName).HasMaxLength(200).IsRequired();
        builder.HasOne<Room>().WithMany().HasForeignKey(a => a.RoomId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(a => new { a.TenantId, a.RoomId, a.EndsOn });

        // A worker is in one room at a time.
        builder.HasIndex(a => new { a.TenantId, a.WorkerId }).IsUnique().HasFilter("[ends_on] IS NULL");
    }
}

/// <summary>Used only by <c>dotnet ef migrations add</c>; no database connection is opened.</summary>
internal sealed class HousingDesignTimeDbContextFactory : IDesignTimeDbContextFactory<HousingDbContext>
{
    public HousingDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<HousingDbContext>();
        PersistenceExtensions.Configure(options, connectionString, HousingDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        return new HousingDbContext(options.Options, new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System)));
    }
}
