using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Workflow.Api;
using IntegratedErp.Modules.Workflow.Application;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workflow.Infrastructure;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Workflow;

/// <summary>
/// Workflow module: approval processes in the style of Dynamics CRM workflows — a process targets a screen, has a
/// start condition and nested steps (approval stages, if/else conditions, record updates, notifications, stop),
/// is published as immutable versions, and runs through the approval engine; plus "my tasks", "my requests",
/// monitoring, and internal requests as the first screen.
/// </summary>
public sealed class WorkflowModule : IModule
{
    public string Name => WorkflowContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<WorkflowDbContext>(configuration, WorkflowDbContext.SchemaName);
        services.AddScoped<ApprovalEngine>();
        services.AddScoped<IApprovalService>(sp => sp.GetRequiredService<ApprovalEngine>());
        services.AddScoped<ProcessService>();
        services.AddScoped<ApprovalQueries>();
        services.AddScoped<InternalRequestService>();
        services.AddScoped<IApprovalRecordAdapter, InternalRequestAdapter>();
        services.AddScoped<AlertCenter>();
        services.AddHostedService<AlertDigestWorker>();
        services.AddPermissions(WorkflowPermissions.All);
        services.AddNumberSequences(
            new NumberSequenceDefinition("internal_request", WorkflowDbContext.SchemaName, "الطلبات والاعتمادات", "Requests and approvals", "الطلبات الداخلية", "Internal requests", "REQ-{YYYY}-{N:5}", NumberReset.Yearly));
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapWorkflowEndpoints();
        endpoints.MapAlertEndpoints();
    }
}
