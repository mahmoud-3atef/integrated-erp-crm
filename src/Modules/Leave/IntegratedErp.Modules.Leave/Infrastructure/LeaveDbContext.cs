using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Leave.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Leave.Infrastructure;

internal sealed class LeaveDbContext(DbContextOptions<LeaveDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "leave";

    public override string Schema => SchemaName;

    public DbSet<LeaveSetting> Settings => Set<LeaveSetting>();

    public DbSet<LeaveType> Types => Set<LeaveType>();

    public DbSet<BalanceEntry> Entries => Set<BalanceEntry>();

    public DbSet<LeaveRequest> Requests => Set<LeaveRequest>();
}

internal sealed class LeaveSettingConfiguration : IEntityTypeConfiguration<LeaveSetting>
{
    public void Configure(EntityTypeBuilder<LeaveSetting> builder)
    {
        builder.ToTable("setting");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.HasIndex(s => s.TenantId).IsUnique();
    }
}

internal sealed class LeaveTypeConfiguration : IEntityTypeConfiguration<LeaveType>
{
    public void Configure(EntityTypeBuilder<LeaveType> builder)
    {
        builder.ToTable("leave_type");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();
        builder.Property(t => t.Code).HasMaxLength(30).IsRequired();
        builder.Property(t => t.NameAr).HasMaxLength(100).IsRequired();
        builder.Property(t => t.NameEn).HasMaxLength(100).IsRequired();
        builder.Property(t => t.Pay).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.DayCount).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.DaysPerYear).HasPrecision(6, 2);
        builder.Property(t => t.SeniorDaysPerYear).HasPrecision(6, 2);
        builder.Property(t => t.MaxDaysPerRequest).HasPrecision(6, 2);
        builder.HasIndex(t => new { t.TenantId, t.Code });
    }
}

internal sealed class BalanceEntryConfiguration : IEntityTypeConfiguration<BalanceEntry>
{
    public void Configure(EntityTypeBuilder<BalanceEntry> builder)
    {
        builder.ToTable("balance_entry");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.Days).HasPrecision(7, 2);
        builder.Property(e => e.Reason).HasMaxLength(300).IsRequired();
        builder.Property(e => e.Period).HasMaxLength(7);
        builder.Property(e => e.CreatedByName).HasMaxLength(200).IsRequired();
        builder.HasIndex(e => new { e.TenantId, e.EmployeeId, e.LeaveTypeId, e.Date });
        builder.HasIndex(e => new { e.TenantId, e.EmployeeId, e.LeaveTypeId, e.Period }).IsUnique().HasFilter("[period] IS NOT NULL");
    }
}

internal sealed class LeaveRequestConfiguration : IEntityTypeConfiguration<LeaveRequest>
{
    public void Configure(EntityTypeBuilder<LeaveRequest> builder)
    {
        builder.ToTable("request");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.RequestNo).HasMaxLength(40).IsRequired();
        builder.Property(r => r.EmployeeName).HasMaxLength(300).IsRequired();
        builder.Property(r => r.Days).HasPrecision(6, 2);
        builder.Property(r => r.Reason).HasMaxLength(500);
        builder.Property(r => r.SubstituteName).HasMaxLength(300);
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(r => r.CreatedByName).HasMaxLength(200).IsRequired();
        builder.Property(r => r.LastComment).HasMaxLength(2000);
        builder.Ignore(r => r.Holds);
        builder.HasIndex(r => new { r.TenantId, r.RequestNo }).IsUnique();
        builder.HasIndex(r => new { r.TenantId, r.EmployeeId, r.From });
    }
}

internal sealed class LeaveDesignTimeDbContextFactory : IDesignTimeDbContextFactory<LeaveDbContext>
{
    public LeaveDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<LeaveDbContext>();
        PersistenceExtensions.Configure(options, connectionString, LeaveDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        return new LeaveDbContext(options.Options, new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System)));
    }
}
