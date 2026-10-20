using IntegratedErp.Api;
using IntegratedErp.BuildingBlocks;
using IntegratedErp.BuildingBlocks.Configuration;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Web;
using IntegratedErp.Modules.Commercial;
using IntegratedErp.Modules.Billing;
using IntegratedErp.Modules.Payroll;
using IntegratedErp.Modules.Staff;
using IntegratedErp.Modules.Attendance;
using IntegratedErp.Modules.Deductions;
using IntegratedErp.Modules.Leave;
using IntegratedErp.Modules.Housing;
using IntegratedErp.Modules.Operations;
using IntegratedErp.Modules.CrmSync;
using IntegratedErp.Modules.Documents;
using IntegratedErp.Modules.Identity;
using IntegratedErp.Modules.Identity.Infrastructure.Ldap;
using IntegratedErp.Modules.Organization;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workflow;
using IntegratedErp.Modules.Workforce;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// On a server: its own settings (connections, AD, CRM, company) in a file outside the release folder, so a deploy
// never overwrites them (deploy/Initialize-ErpServer.ps1 creates it and sets ERP_CONFIG_FILE).
if (Environment.GetEnvironmentVariable("ERP_CONFIG_FILE") is { Length: > 0 } serverConfig)
{
    builder.Configuration.AddJsonFile(serverConfig, optional: false, reloadOnChange: false);
}

// Secrets (LDAP bind password, ...) from the DPAPI-encrypted file written by tools/Set-ErpSecret.ps1.
builder.Configuration.AddProtectedSecretsFile();

// Logs: console in development; daily files on a server (Serilog section of the settings).
builder.Services.AddSerilog((services, logger) => logger.ReadFrom.Configuration(builder.Configuration).ReadFrom.Services(services));

builder.Services.AddPlatformCore();
builder.Services.AddWebDefaults();
builder.Services.AddPlatformAuthentication(builder.Configuration, builder.Environment);
builder.Services.AddOpenApi();
builder.Services.AddPlatformHealthChecks(builder.Configuration);

// Every business module is listed here once; enablement is controlled by configuration.
builder.Services.AddModules(
    builder.Configuration,
    new OrganizationModule(),
    new IdentityModule(),
    new DocumentsModule(),
    new WorkflowModule(),
    new CrmSyncModule(),
    new WorkforceModule(),
    new CommercialModule(),
    new OperationsModule(),
    new HousingModule(),
    new BillingModule(),
    new PayrollModule(), new StaffModule(), new AttendanceModule(), new LeaveModule(), new DeductionsModule());

// Development only: local test accounts (dev.*) for exercising the sign-in UI without real passwords.
if (builder.Environment.IsDevelopment() && builder.Configuration.GetValue("Identity:DevDirectory:Enabled", false))
{
    DevelopmentDirectory.Replace(builder.Services, builder.Configuration);
}

var app = builder.Build();

if (!app.Configuration.GetValue("Identity:MfaRequired", true))
{
    app.Logger.LogWarning("Two-step verification (MFA) is OFF (Identity:MfaRequired = false): sign-in needs the password only. Turn it back on after the test period.");
}

// "migrate": create/upgrade the database (all enabled modules) and exit.
if (args.Contains("migrate", StringComparer.OrdinalIgnoreCase))
{
    await app.Services.GetRequiredService<DatabaseMigrator>().MigrateAsync(CancellationToken.None).ConfigureAwait(false);
    return;
}

// "create-company [code Arabic-name English-name]": first-run setup of a server — the company the bootstrap
// administrators join (names from the arguments, or from the Setup section of the server settings); does nothing if
// it exists, so every deploy runs it.
if (args.Length >= 1 && string.Equals(args[0], "create-company", StringComparison.OrdinalIgnoreCase))
{
    var setup = app.Configuration.GetSection("Setup");
    var code = args.Length >= 4 ? args[1] : setup["CompanyCode"];
    var nameAr = args.Length >= 4 ? args[2] : setup["CompanyNameAr"];
    var nameEn = args.Length >= 4 ? args[3] : setup["CompanyNameEn"];
    if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(nameAr) || string.IsNullOrWhiteSpace(nameEn))
    {
        Console.WriteLine("No company to set up (Setup:CompanyCode / CompanyNameAr / CompanyNameEn).");
        return;
    }

    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<ExecutionContextAccessor>().RunAsSystem("setup");
    var company = await scope.ServiceProvider.GetRequiredService<ITenantSetup>().EnsureAsync(code, nameAr, nameEn, CancellationToken.None).ConfigureAwait(false);
    Console.WriteLine(company.IsSuccess ? $"Company '{company.Value.Code}' is ready." : $"Could not create the company: {company.Error.Message}");
    Environment.ExitCode = company.IsSuccess ? 0 : 1;
    return;
}

app.UseExceptionHandler();
app.UseSerilogRequestLogging();
app.UseSecurityHeaders();
app.UseStatusCodePages();
app.UseRateLimiter();
app.UsePlatformSecurity();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapPlatformHealthChecks();
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
