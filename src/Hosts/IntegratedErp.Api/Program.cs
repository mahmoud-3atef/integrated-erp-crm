using IntegratedErp.Api;
using IntegratedErp.BuildingBlocks;
using IntegratedErp.BuildingBlocks.Configuration;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Web;
using IntegratedErp.Modules.CrmSync;
using IntegratedErp.Modules.Documents;
using IntegratedErp.Modules.Identity;
using IntegratedErp.Modules.Identity.Infrastructure.Ldap;
using IntegratedErp.Modules.Organization;
using IntegratedErp.Modules.Workflow;

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
    new IdentityModule(),
    new DocumentsModule(),
    new WorkflowModule(),
    new CrmSyncModule());

// Development only: local test accounts (dev.*) for exercising the sign-in UI without real passwords.
if (builder.Environment.IsDevelopment() && builder.Configuration.GetValue("Identity:DevDirectory:Enabled", false))
{
    DevelopmentDirectory.Replace(builder.Services, builder.Configuration);
}

var app = builder.Build();

// "migrate": create/upgrade the database (all enabled modules) and exit.
if (args.Contains("migrate", StringComparer.OrdinalIgnoreCase))
{
    await app.Services.GetRequiredService<DatabaseMigrator>().MigrateAsync(CancellationToken.None).ConfigureAwait(false);
    return;
}

app.UseExceptionHandler();
app.UseSecurityHeaders();
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

// The web app (built into wwwroot) on the same origin; unknown non-API paths go to the app's router.
app.UseDefaultFiles();
app.UseStaticFiles();
// Deep links into the web app return index.html; files (assets) and anything under /api do not.
app.MapFallbackToFile("{*path:nonfile:regex(^(?!api(/|$)).*$)}", "index.html");

await app.RunAsync().ConfigureAwait(false);

/// <summary>Entry point marker, used by integration and architecture tests.</summary>
public partial class Program;
