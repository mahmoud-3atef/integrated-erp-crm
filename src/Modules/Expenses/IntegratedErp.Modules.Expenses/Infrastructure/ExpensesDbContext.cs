using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Expenses.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IntegratedErp.Modules.Expenses.Infrastructure;

internal sealed class ExpensesDbContext(DbContextOptions<ExpensesDbContext> options, ModuleDbContextDependencies dependencies)
    : ModuleDbContext(options, dependencies)
{
    public const string SchemaName = "expense";

    public override string Schema => SchemaName;

    public DbSet<Expense> Expenses => Set<Expense>();
}

internal sealed class ExpenseConfiguration : IEntityTypeConfiguration<Expense>
{
    public void Configure(EntityTypeBuilder<Expense> builder)
    {
        builder.ToTable("expense");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.ExpenseNo).HasMaxLength(30).IsRequired();
        builder.Property(e => e.Category).HasMaxLength(30).IsRequired();
        builder.Property(e => e.WorkerNo).HasMaxLength(30);
        builder.Property(e => e.WorkerName).HasMaxLength(Expense.TextMaxLength);
        builder.Property(e => e.ProjectName).HasMaxLength(300);
        builder.Property(e => e.Amount).HasPrecision(18, 2);
        builder.Property(e => e.Vat).HasPrecision(18, 2);
        builder.Property(e => e.PaidTo).HasMaxLength(Expense.TextMaxLength);
        builder.Property(e => e.Reference).HasMaxLength(100);
        builder.Property(e => e.Notes).HasMaxLength(Expense.NotesMaxLength);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.CancelReason).HasMaxLength(500);
        builder.Property(e => e.CreatedBy).HasMaxLength(200).IsRequired();
        builder.Property(e => e.UpdatedBy).HasMaxLength(200);
        builder.HasIndex(e => new { e.TenantId, e.ExpenseNo }).IsUnique();
        builder.HasIndex(e => new { e.TenantId, e.SpentOn });
        builder.HasIndex(e => new { e.TenantId, e.WorkerId });
        builder.HasIndex(e => new { e.TenantId, e.ProjectCrmId });
    }
}

internal sealed class ExpensesDesignTimeDbContextFactory : IDesignTimeDbContextFactory<ExpensesDbContext>
{
    public ExpensesDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ERP_DESIGN_CONNECTION")
            ?? @"Server=(localdb)\MSSQLLocalDB;Database=IntegratedErp_Design;Integrated Security=true;TrustServerCertificate=true";
        var options = new DbContextOptionsBuilder<ExpensesDbContext>();
        PersistenceExtensions.Configure(options, connectionString, ExpensesDbContext.SchemaName);

        var context = new ExecutionContextAccessor();
        context.RunAsSystem("design-time");
        return new ExpensesDbContext(options.Options, new ModuleDbContextDependencies(context, context, new SystemClock(TimeProvider.System)));
    }
}
