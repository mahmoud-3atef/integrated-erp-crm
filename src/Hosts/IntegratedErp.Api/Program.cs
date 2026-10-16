using IntegratedErp.Api;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Web;
using IntegratedErp.Modules.Organization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddWebDefaults();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();
builder.Services.AddTransient<DatabaseMigrator>();

// Every business module is listed here once; enablement is controlled by configuration.
builder.Services.AddModules(
    builder.Configuration,
    new OrganizationModule());

var app = builder.Build();

// "migrate": create/upgrade the database (all enabled modules) and exit.
if (args.Contains("migrate", StringComparer.OrdinalIgnoreCase))
{
    await app.Services.GetRequiredService<DatabaseMigrator>().MigrateAsync(CancellationToken.None).ConfigureAwait(false);
    return;
}

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthChecks("/health");
app.MapSystemEndpoints();
app.MapModules();

await app.RunAsync().ConfigureAwait(false);

/// <summary>Entry point marker, used by integration and architecture tests.</summary>
public partial class Program;
