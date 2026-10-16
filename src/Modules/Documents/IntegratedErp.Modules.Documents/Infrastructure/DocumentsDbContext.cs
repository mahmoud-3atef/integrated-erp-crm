using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Documents.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Documents.Infrastructure;

internal sealed class DocumentsDbContext(DbContextOptions<DocumentsDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "documents";

    public override string Schema => SchemaName;

    public DbSet<Attachment> Attachments => Set<Attachment>();

    public DbSet<Notification> Notifications => Set<Notification>();

    public DbSet<OutgoingEmail> OutgoingEmails => Set<OutgoingEmail>();
}

internal sealed class AttachmentConfiguration : IEntityTypeConfiguration<Attachment>
{
    public void Configure(EntityTypeBuilder<Attachment> builder)
    {
        builder.ToTable("attachment");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.OwnerType).HasMaxLength(100).IsRequired();
        builder.Property(a => a.DocumentType).HasMaxLength(30).IsRequired();
        builder.Property(a => a.FileName).HasMaxLength(Attachment.FileNameMaxLength).IsRequired();
        builder.Property(a => a.ContentType).HasMaxLength(100).IsRequired();
        builder.Property(a => a.Sha256).HasMaxLength(64).IsRequired();
        builder.Property(a => a.StorageKey).HasMaxLength(300).IsRequired();
        builder.Property(a => a.Notes).HasMaxLength(Attachment.NotesMaxLength);
        builder.Property(a => a.UploadedBy).HasMaxLength(200).IsRequired();
        builder.Property(a => a.DeletedBy).HasMaxLength(200);
        builder.HasIndex(a => new { a.TenantId, a.OwnerType, a.OwnerId });
        builder.HasIndex(a => new { a.TenantId, a.ExpiresOn });
    }
}

internal sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("notification");
        builder.HasKey(n => n.Id);
        builder.Property(n => n.Id).ValueGeneratedNever();
        builder.Property(n => n.Kind).HasMaxLength(100).IsRequired();
        builder.Property(n => n.TitleAr).HasMaxLength(200).IsRequired();
        builder.Property(n => n.TitleEn).HasMaxLength(200).IsRequired();
        builder.Property(n => n.BodyAr).HasMaxLength(2000).IsRequired();
        builder.Property(n => n.BodyEn).HasMaxLength(2000).IsRequired();
        builder.Property(n => n.Link).HasMaxLength(300);
        builder.HasIndex(n => new { n.TenantId, n.RecipientUserId, n.CreatedAt });
    }
}

internal sealed class OutgoingEmailConfiguration : IEntityTypeConfiguration<OutgoingEmail>
{
    public void Configure(EntityTypeBuilder<OutgoingEmail> builder)
    {
        builder.ToTable("outgoing_email");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.To).HasMaxLength(256).IsRequired();
        builder.Property(e => e.Subject).HasMaxLength(300).IsRequired();
        builder.Property(e => e.HtmlBody).IsRequired();
        builder.Property(e => e.TextBody).IsRequired();
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.LastError).HasMaxLength(500);
        builder.HasIndex(e => new { e.Status, e.NextAttemptAt });
    }
}

/// <summary>Used only by <c>dotnet ef migrations add</c>; no database connection is opened.</summary>
internal sealed class DocumentsDesignTimeDbContextFactory : IDesignTimeDbContextFactory<DocumentsDbContext>
{
    public DocumentsDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<DocumentsDbContext>();
        PersistenceExtensions.Configure(options, connectionString, DocumentsDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        return new DocumentsDbContext(options.Options, new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System)));
    }
}
