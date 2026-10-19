using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Attendance.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Attendance.Infrastructure;

internal sealed class AttendanceDbContext(DbContextOptions<AttendanceDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "attendance";

    public override string Schema => SchemaName;

    public DbSet<Shift> Shifts => Set<Shift>();

    public DbSet<ShiftAssignment> Assignments => Set<ShiftAssignment>();

    public DbSet<Holiday> Holidays => Set<Holiday>();

    public DbSet<EmployeeSetting> EmployeeSettings => Set<EmployeeSetting>();

    public DbSet<AttendanceSetting> Settings => Set<AttendanceSetting>();

    public DbSet<AttendanceDay> Days => Set<AttendanceDay>();

    public DbSet<AttendanceImport> Imports => Set<AttendanceImport>();

    public DbSet<AttendanceMonth> Months => Set<AttendanceMonth>();

    public DbSet<AttendanceMonthLine> MonthLines => Set<AttendanceMonthLine>();

    public DbSet<OvertimeRequest> Overtime => Set<OvertimeRequest>();
}

internal sealed class AttendanceMonthConfiguration : IEntityTypeConfiguration<AttendanceMonth>
{
    public void Configure(EntityTypeBuilder<AttendanceMonth> builder)
    {
        builder.ToTable("month");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).ValueGeneratedNever();
        builder.Property(m => m.Period).HasMaxLength(7).IsRequired();
        builder.Property(m => m.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(m => m.SubmittedByName).HasMaxLength(200);
        builder.Property(m => m.LastComment).HasMaxLength(2000);
        builder.HasMany(m => m.Lines).WithOne().HasForeignKey(l => l.MonthId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(m => m.Lines).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.HasIndex(m => new { m.TenantId, m.Period }).IsUnique();
    }
}

internal sealed class AttendanceMonthLineConfiguration : IEntityTypeConfiguration<AttendanceMonthLine>
{
    public void Configure(EntityTypeBuilder<AttendanceMonthLine> builder)
    {
        builder.ToTable("month_line");
        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).ValueGeneratedNever();
        builder.Property(l => l.EmployeeNo).HasMaxLength(50).IsRequired();
        builder.Property(l => l.NameAr).HasMaxLength(300);
        builder.Property(l => l.NameEn).HasMaxLength(300).IsRequired();
        builder.Property(l => l.DepartmentAr).HasMaxLength(150);
        builder.Property(l => l.DepartmentEn).HasMaxLength(150);
        builder.Property(l => l.ShiftAr).HasMaxLength(100);
        builder.Property(l => l.ShiftEn).HasMaxLength(100);
        builder.Property(l => l.DeductionDays).HasPrecision(7, 2);
        builder.Property(l => l.State).HasMaxLength(20).IsRequired();
        builder.HasIndex(l => new { l.TenantId, l.MonthId, l.EmployeeId }).IsUnique();
    }
}

internal sealed class OvertimeRequestConfiguration : IEntityTypeConfiguration<OvertimeRequest>
{
    public void Configure(EntityTypeBuilder<OvertimeRequest> builder)
    {
        builder.ToTable("overtime");
        builder.HasKey(o => o.Id);
        builder.Property(o => o.Id).ValueGeneratedNever();
        builder.Property(o => o.RequestNo).HasMaxLength(40).IsRequired();
        builder.Property(o => o.EmployeeName).HasMaxLength(300).IsRequired();
        builder.Property(o => o.Reason).HasMaxLength(500).IsRequired();
        builder.Property(o => o.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(o => o.CreatedByName).HasMaxLength(200).IsRequired();
        builder.Property(o => o.LastComment).HasMaxLength(2000);
        builder.HasIndex(o => new { o.TenantId, o.RequestNo }).IsUnique();
        builder.HasIndex(o => new { o.TenantId, o.EmployeeId, o.Date });
    }
}

internal sealed class ShiftConfiguration : IEntityTypeConfiguration<Shift>
{
    public void Configure(EntityTypeBuilder<Shift> builder)
    {
        builder.ToTable("shift");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.NameAr).HasMaxLength(100).IsRequired();
        builder.Property(s => s.NameEn).HasMaxLength(100).IsRequired();
        builder.Property(s => s.LateFrom).HasConversion<string>().HasMaxLength(20);
        builder.Property(s => s.MinutesSource).HasConversion<string>().HasMaxLength(20);
    }
}

internal sealed class ShiftAssignmentConfiguration : IEntityTypeConfiguration<ShiftAssignment>
{
    public void Configure(EntityTypeBuilder<ShiftAssignment> builder)
    {
        builder.ToTable("shift_assignment");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.HasIndex(a => new { a.TenantId, a.ShiftId });
    }
}

internal sealed class HolidayConfiguration : IEntityTypeConfiguration<Holiday>
{
    public void Configure(EntityTypeBuilder<Holiday> builder)
    {
        builder.ToTable("holiday");
        builder.HasKey(h => h.Id);
        builder.Property(h => h.Id).ValueGeneratedNever();
        builder.Property(h => h.NameAr).HasMaxLength(100).IsRequired();
        builder.Property(h => h.NameEn).HasMaxLength(100).IsRequired();
        builder.Property(h => h.Kind).HasConversion<string>().HasMaxLength(20);
        builder.HasIndex(h => new { h.TenantId, h.From });
    }
}

internal sealed class EmployeeSettingConfiguration : IEntityTypeConfiguration<EmployeeSetting>
{
    public void Configure(EntityTypeBuilder<EmployeeSetting> builder)
    {
        builder.ToTable("employee_setting");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.BadgeNo).HasMaxLength(30);
        builder.HasIndex(e => new { e.TenantId, e.EmployeeId }).IsUnique();
        builder.HasIndex(e => new { e.TenantId, e.BadgeNo }).IsUnique().HasFilter("[badge_no] IS NOT NULL");
    }
}

internal sealed class AttendanceSettingConfiguration : IEntityTypeConfiguration<AttendanceSetting>
{
    public void Configure(EntityTypeBuilder<AttendanceSetting> builder)
    {
        builder.ToTable("setting");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.MatchBy).HasConversion<string>().HasMaxLength(20);
        builder.Property(s => s.Columns).HasMaxLength(4000).IsRequired();
        builder.HasIndex(s => s.TenantId).IsUnique();
    }
}

internal sealed class AttendanceDayConfiguration : IEntityTypeConfiguration<AttendanceDay>
{
    public void Configure(EntityTypeBuilder<AttendanceDay> builder)
    {
        builder.ToTable("day");
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).ValueGeneratedNever();
        builder.Property(d => d.DeviceStatus).HasMaxLength(200);
        builder.Property(d => d.DeviceMark).HasConversion<string>().HasMaxLength(20);
        builder.Property(d => d.ManualStatus).HasConversion<string>().HasMaxLength(20);
        builder.Property(d => d.Note).HasMaxLength(500);
        builder.Property(d => d.Deduction).HasPrecision(5, 2);
        builder.Property(d => d.EditedByName).HasMaxLength(200);
        builder.Ignore(d => d.In);
        builder.Ignore(d => d.Out);
        builder.HasIndex(d => new { d.TenantId, d.EmployeeId, d.Date }).IsUnique();
        builder.HasIndex(d => new { d.TenantId, d.Date });
    }
}

internal sealed class AttendanceImportConfiguration : IEntityTypeConfiguration<AttendanceImport>
{
    public void Configure(EntityTypeBuilder<AttendanceImport> builder)
    {
        builder.ToTable("import");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.FileName).HasMaxLength(200).IsRequired();
        builder.Property(i => i.Problems).IsRequired();
        builder.Property(i => i.CreatedByName).HasMaxLength(200).IsRequired();
        builder.HasIndex(i => new { i.TenantId, i.From, i.To });
    }
}

internal sealed class AttendanceDesignTimeDbContextFactory : IDesignTimeDbContextFactory<AttendanceDbContext>
{
    public AttendanceDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<AttendanceDbContext>();
        PersistenceExtensions.Configure(options, connectionString, AttendanceDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        return new AttendanceDbContext(options.Options, new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System)));
    }
}
