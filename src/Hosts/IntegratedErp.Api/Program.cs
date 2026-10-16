using IntegratedErp.Api;
using IntegratedErp.BuildingBlocks;
using IntegratedErp.BuildingBlocks.Configuration;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Web;
using IntegratedErp.Modules.Identity;
using IntegratedErp.Modules.Organization;

var builder = WebApplication.CreateBuilder(args);

// Secrets (LDAP bind password, ...) from the DPAPI-encrypted file written by tools/Set-ErpSecret.ps1.
builder.Configuration.AddProtectedSecretsFile();

builder.Services.AddPlatformCore();
builder.Services.AddWebDefaults();
builder.Services.AddPlatformAuthentication(builder.Configuration, builder.Environment);
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();

// Every business module is listed here once; enablement is controlled by configuration.
builder.Services.AddModules(
    builder.Configuration,
    new OrganizationModule(),
    new IdentityModule());

var app = builder.Build();

// "migrate": create/upgrade the database (all enabled modules) and exit.
if (args.Contains("migrate", StringComparer.OrdinalIgnoreCase))
{
    await app.Services.GetRequiredService<DatabaseMigrator>().MigrateAsync(CancellationToken.None).ConfigureAwait(false);
    return;
}

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseRateLimiter();
app.UsePlatformSecurity();

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
