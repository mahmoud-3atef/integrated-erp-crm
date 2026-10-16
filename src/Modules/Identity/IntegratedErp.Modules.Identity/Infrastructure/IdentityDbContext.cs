using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Identity.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Identity.Infrastructure;

/// <summary>
/// Identity data. Catalog-level (users span companies); lives in the shared database for now and moves to
/// the catalog database with database-per-company (docs/02-target-architecture/14 §1.2.1).
/// </summary>
internal sealed class IdentityDbContext(DbContextOptions<IdentityDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "identity";

    public override string Schema => SchemaName;

    public DbSet<UserAccount> Users => Set<UserAccount>();

    public DbSet<ExternalLogin> ExternalLogins => Set<ExternalLogin>();

    public DbSet<Membership> Memberships => Set<Membership>();

    public DbSet<SignInAttempt> SignInAttempts => Set<SignInAttempt>();

    public DbSet<Role> Roles => Set<Role>();

    public DbSet<RoleAssignment> RoleAssignments => Set<RoleAssignment>();
}

internal sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("role");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.Code).HasMaxLength(Role.CodeMaxLength).IsRequired();
        builder.Property(r => r.NameAr).HasMaxLength(Role.NameMaxLength).IsRequired();
        builder.Property(r => r.NameEn).HasMaxLength(Role.NameMaxLength).IsRequired();
        builder.Property(r => r.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Ignore(r => r.IsBuiltIn);
        builder.HasIndex(r => new { r.TenantId, r.Code }).IsUnique();
        builder.HasMany(r => r.Permissions).WithOne().HasForeignKey(p => p.RoleId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(r => r.Permissions).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class RoleGrantConfiguration : IEntityTypeConfiguration<RoleGrant>
{
    public void Configure(EntityTypeBuilder<RoleGrant> builder)
    {
        builder.ToTable("role_permission");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.PermissionCode).HasMaxLength(100).IsRequired();
        builder.HasIndex(p => new { p.RoleId, p.PermissionCode }).IsUnique();
    }
}

internal sealed class RoleAssignmentConfiguration : IEntityTypeConfiguration<RoleAssignment>
{
    public void Configure(EntityTypeBuilder<RoleAssignment> builder)
    {
        builder.ToTable("role_assignment");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        // One row per role and scope; NULL (all registrations) counts as one value in a SQL Server unique index.
        builder.HasIndex(a => new { a.MembershipId, a.RoleId, a.LegalEntityId }).IsUnique().HasFilter(null);
        builder.HasOne<Membership>().WithMany().HasForeignKey(a => a.MembershipId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Role>().WithMany().HasForeignKey(a => a.RoleId).OnDelete(DeleteBehavior.NoAction);
    }
}

internal sealed class UserAccountConfiguration : IEntityTypeConfiguration<UserAccount>
{
    public void Configure(EntityTypeBuilder<UserAccount> builder)
    {
        builder.ToTable("user_account");
        builder.HasKey(u => u.Id);
        builder.Property(u => u.Id).ValueGeneratedNever();
        builder.Property(u => u.DisplayName).HasMaxLength(200).IsRequired();
        builder.Property(u => u.Email).HasMaxLength(256);
        builder.Property(u => u.MfaSecretProtected).HasMaxLength(1000);
        builder.HasMany(u => u.RecoveryCodes).WithOne().HasForeignKey(c => c.UserAccountId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(u => u.RecoveryCodes).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class RecoveryCodeConfiguration : IEntityTypeConfiguration<RecoveryCode>
{
    public void Configure(EntityTypeBuilder<RecoveryCode> builder)
    {
        builder.ToTable("recovery_code");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();
        builder.Property(c => c.CodeHash).HasMaxLength(64).IsRequired();
    }
}

internal sealed class ExternalLoginConfiguration : IEntityTypeConfiguration<ExternalLogin>
{
    public void Configure(EntityTypeBuilder<ExternalLogin> builder)
    {
        builder.ToTable("external_login");
        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).ValueGeneratedNever();
        builder.Property(l => l.Provider).HasMaxLength(50).IsRequired();
        builder.Property(l => l.Subject).HasMaxLength(200).IsRequired();
        builder.Property(l => l.UserName).HasMaxLength(256).IsRequired();
        builder.HasIndex(l => new { l.Provider, l.Subject }).IsUnique();
        builder.HasOne<UserAccount>().WithMany().HasForeignKey(l => l.UserAccountId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class MembershipConfiguration : IEntityTypeConfiguration<Membership>
{
    public void Configure(EntityTypeBuilder<Membership> builder)
    {
        builder.ToTable("membership");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).ValueGeneratedNever();
        builder.HasIndex(m => new { m.UserAccountId, m.TenantId }).IsUnique();
        builder.HasOne<UserAccount>().WithMany().HasForeignKey(m => m.UserAccountId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class SignInAttemptConfiguration : IEntityTypeConfiguration<SignInAttempt>
{
    public void Configure(EntityTypeBuilder<SignInAttempt> builder)
    {
        builder.ToTable("sign_in_attempt");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.UserName).HasMaxLength(256).IsRequired();
        builder.Property(a => a.Provider).HasMaxLength(50).IsRequired();
        builder.Property(a => a.Result).HasMaxLength(50).IsRequired();
        builder.Property(a => a.IpAddress).HasMaxLength(64);
        builder.Ignore(a => a.IsFailure);
        builder.HasIndex(a => new { a.UserName, a.OccurredAt });
    }
}

internal sealed class IdentityDesignTimeDbContextFactory : IDesignTimeDbContextFactory<IdentityDbContext>
{
    public IdentityDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<IdentityDbContext>();
        PersistenceExtensions.Configure(options, connectionString, IdentityDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        return new IdentityDbContext(options.Options, new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System)));
    }
}
