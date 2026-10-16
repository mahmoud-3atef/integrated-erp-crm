using IntegratedErp.Api;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.Modules.Organization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();

// Every business module is listed here once; enablement is controlled by configuration.
builder.Services.AddModules(
    builder.Configuration,
    new OrganizationModule());

var app = builder.Build();

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
