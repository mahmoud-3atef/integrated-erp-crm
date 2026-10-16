using IntegratedErp.BuildingBlocks.Approvals;
using IntegratedErp.BuildingBlocks.Modules;
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
/// Workflow module: approval routes per document type (stages with a named user, a role, or a user the document
/// supplies such as the direct manager), versioned; the approval engine and "my tasks"; and internal requests.
/// </summary>
public sealed class WorkflowModule : IModule
{
    public string Name => WorkflowContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<WorkflowDbContext>(configuration, WorkflowDbContext.SchemaName);
        services.AddScoped<ApprovalEngine>();
        services.AddScoped<IApprovalService>(sp => sp.GetRequiredService<ApprovalEngine>());
        services.AddScoped<RouteService>();
        services.AddScoped<InternalRequestService>();
        services.AddScoped<IApprovalOutcomeHandler, InternalRequestOutcomeHandler>();
        services.AddPermissions(WorkflowPermissions.All);
        services.AddApprovalDocuments(InternalRequestService.Definition);
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapWorkflowEndpoints();
}
