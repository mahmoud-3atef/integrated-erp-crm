using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Staff.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Staff.Infrastructure;

internal sealed class StaffDbContext(DbContextOptions<StaffDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "staff";

    public override string Schema => SchemaName;

    public DbSet<Department> Departments => Set<Department>();

    public DbSet<JobTitle> JobTitles => Set<JobTitle>();

    public DbSet<Grade> Grades => Set<Grade>();

    public DbSet<Position> Positions => Set<Position>();

    public DbSet<StaffEmployee> Employees => Set<StaffEmployee>();

    public DbSet<StaffSalary> Salaries => Set<StaffSalary>();
}

internal sealed class DepartmentConfiguration : IEntityTypeConfiguration<Department>
{
    public void Configure(EntityTypeBuilder<Department> builder)
    {
        builder.ToTable("department");
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).ValueGeneratedNever();
        builder.Property(d => d.NameAr).HasMaxLength(150).IsRequired();
        builder.Property(d => d.NameEn).HasMaxLength(150).IsRequired();
        builder.Property(d => d.CostCenter).HasMaxLength(40);
        builder.HasIndex(d => new { d.TenantId, d.ParentId });
    }
}

internal sealed class JobTitleConfiguration : IEntityTypeConfiguration<JobTitle>
{
    public void Configure(EntityTypeBuilder<JobTitle> builder)
    {
        builder.ToTable("job_title");
        builder.HasKey(j => j.Id);
        builder.Property(j => j.Id).ValueGeneratedNever();
        builder.Property(j => j.NameAr).HasMaxLength(150).IsRequired();
        builder.Property(j => j.NameEn).HasMaxLength(150).IsRequired();
        builder.Property(j => j.OccupationCode).HasMaxLength(30);
    }
}

internal sealed class GradeConfiguration : IEntityTypeConfiguration<Grade>
{
    public void Configure(EntityTypeBuilder<Grade> builder)
    {
        builder.ToTable("grade");
        builder.HasKey(g => g.Id);
        builder.Property(g => g.Id).ValueGeneratedNever();
        builder.Property(g => g.Code).HasMaxLength(20).IsRequired();
        builder.Property(g => g.NameAr).HasMaxLength(100).IsRequired();
        builder.HasIndex(g => new { g.TenantId, g.Code }).IsUnique();
    }
}

internal sealed class PositionConfiguration : IEntityTypeConfiguration<Position>
{
    public void Configure(EntityTypeBuilder<Position> builder)
    {
        builder.ToTable("position");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.HasIndex(p => new { p.TenantId, p.DepartmentId });
    }
}

internal sealed class StaffEmployeeConfiguration : IEntityTypeConfiguration<StaffEmployee>
{
    public void Configure(EntityTypeBuilder<StaffEmployee> builder)
    {
        builder.ToTable("employee");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.EmployeeNo).HasMaxLength(50).IsRequired();
        builder.Property(e => e.NameAr).HasMaxLength(300);
        builder.Property(e => e.NameEn).HasMaxLength(300).IsRequired();
        builder.Property(e => e.IdNumber).HasMaxLength(30);
        builder.Property(e => e.NationalityCode).HasMaxLength(50);
        builder.Property(e => e.NationalityAr).HasMaxLength(100);
        builder.Property(e => e.NationalityEn).HasMaxLength(100);
        builder.Property(e => e.Mobile).HasMaxLength(30);
        builder.Property(e => e.Email).HasMaxLength(200);
        builder.Property(e => e.GosiNo).HasMaxLength(30);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.LegacyStatusAr).HasMaxLength(100);
        builder.Property(e => e.LegacyStatusEn).HasMaxLength(100);
        builder.Property(e => e.Sponsor).HasMaxLength(100);
        builder.Property(e => e.CreatedByName).HasMaxLength(200).IsRequired();
        foreach (var name in new[] { nameof(StaffEmployee.AnnualLeaveDays), nameof(StaffEmployee.LeaveBalance), nameof(StaffEmployee.LeaveConsumed), nameof(StaffEmployee.LeaveOldConsumed), nameof(StaffEmployee.LeaveRemaining) })
        {
            builder.Property<decimal?>(name).HasPrecision(9, 2);
        }

        builder.Ignore(e => e.DisplayName);
        builder.HasIndex(e => new { e.TenantId, e.EmployeeNo }).IsUnique();
        builder.HasIndex(e => new { e.TenantId, e.WorkerId }).IsUnique().HasFilter("[worker_id] IS NOT NULL");
        builder.HasIndex(e => new { e.TenantId, e.DepartmentId });
        builder.HasIndex(e => new { e.TenantId, e.PositionId });
    }
}

internal sealed class StaffSalaryConfiguration : IEntityTypeConfiguration<StaffSalary>
{
    public void Configure(EntityTypeBuilder<StaffSalary> builder)
    {
        builder.ToTable("salary");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.Source).HasConversion<string>().HasMaxLength(20);
        builder.Property(s => s.Reason).HasMaxLength(500);
        builder.Property(s => s.CreatedByName).HasMaxLength(200).IsRequired();
        builder.HasIndex(s => new { s.TenantId, s.EmployeeId, s.EffectiveFrom });
    }
}

internal sealed class StaffDesignTimeDbContextFactory : IDesignTimeDbContextFactory<StaffDbContext>
{
    public StaffDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<StaffDbContext>();
        PersistenceExtensions.Configure(options, connectionString, StaffDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        return new StaffDbContext(options.Options, new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System)));
    }
}
