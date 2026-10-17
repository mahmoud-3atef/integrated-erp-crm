using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Billing.Api;
using IntegratedErp.Modules.Billing.Application;
using IntegratedErp.Modules.Billing.Contracts;
using IntegratedErp.Modules.Billing.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Billing;

/// <summary>
/// Billing module (docs/02-target-architecture/06–07): the monthly project timesheets generated from the period
/// ledger — and, next, the invoices made from them. An approved timesheet feeds the customer invoice, the payroll of
/// the company's workers and the internal suppliers' statements.
/// </summary>
public sealed class BillingModule : IModule
{
    public string Name => BillingContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<BillingDbContext>(configuration, BillingDbContext.SchemaName);
        services.AddScoped<TimesheetService>();
        services.AddScoped<TimesheetQueries>();
        services.AddScoped<IApprovalRecordAdapter, TimesheetAdapter>();
        services.AddPermissions(BillingPermissions.All);
        services.AddNumberSequences(
            new NumberSequenceDefinition("timesheet", BillingDbContext.SchemaName, "الفوترة", "Billing", "التحضير الشهري", "Monthly timesheets", "TS-{YYYY}-{N:5}", NumberReset.Yearly));
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapTimesheetEndpoints();
}

internal static class BillingPermissions
{
    public const string TimesheetsView = "billing.timesheets.view";
    public const string TimesheetsManage = "billing.timesheets.manage";
    public const string TimesheetsApprove = "billing.timesheets.approve";

    private const string GroupAr = "الفوترة";
    private const string GroupEn = "Billing";

    public static readonly PermissionDefinition[] All =
    [
        new(TimesheetsView, GroupAr, GroupEn, "عرض التحضير الشهري ومخرجاته", "View monthly timesheets and their outputs"),
        new(TimesheetsManage, GroupAr, GroupEn, "توليد التحضير وتعديلاته وإرساله وإعدادات فوترة المشروع", "Generate, adjust and send timesheets; project billing settings"),
        new(TimesheetsApprove, GroupAr, GroupEn, "اعتماد التحضير الشهري", "Approve monthly timesheets"),
    ];
}
