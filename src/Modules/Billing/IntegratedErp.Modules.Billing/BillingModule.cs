using IntegratedErp.BuildingBlocks.Attachments;
using IntegratedErp.Modules.CrmSync.Contracts;
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
        services.AddScoped<InvoiceService>();
        services.AddScoped<InvoiceQueries>();
        services.AddScoped<IApprovalRecordAdapter, InvoiceAdapter>();
        services.AddScoped<ReceivablesLedger>();
        services.AddScoped<ReceiptService>();
        services.AddScoped<ReceivableQueries>();
        services.AddScoped<IApprovalRecordAdapter, ReceiptAdapter>();
        services.AddScoped<OpeningBalanceImport>();
        services.AddScoped<ICrmStagingConsumer>(sp => sp.GetRequiredService<OpeningBalanceImport>());
        services.AddAttachmentOwners<BillingAttachmentOwners>(BillingAttachmentOwners.All);
        services.AddPermissions(BillingPermissions.All);
        services.AddNumberSequences(
            new NumberSequenceDefinition("timesheet", BillingDbContext.SchemaName, "الفوترة", "Billing", "التحضير الشهري", "Monthly timesheets", "TS-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition("invoice", BillingDbContext.SchemaName, "الفوترة", "Billing", "فواتير العملاء", "Customer invoices", "INV{N:5}", NumberReset.Never),
            new NumberSequenceDefinition("credit_note", BillingDbContext.SchemaName, "الفوترة", "Billing", "الإشعارات الدائنة", "Credit notes", "CN-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition("debit_note", BillingDbContext.SchemaName, "الفوترة", "Billing", "الإشعارات المدينة", "Debit notes", "DN-{YYYY}-{N:5}", NumberReset.Yearly),
            new NumberSequenceDefinition("receipt", BillingDbContext.SchemaName, "الفوترة", "Billing", "سندات القبض", "Receipt vouchers", "RV-{YYYY}-{N:5}", NumberReset.Yearly));
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapTimesheetEndpoints();
        endpoints.MapInvoiceEndpoints();
        endpoints.MapReceivableEndpoints();
    }
}

internal static class BillingPermissions
{
    public const string TimesheetsView = "billing.timesheets.view";
    public const string TimesheetsManage = "billing.timesheets.manage";
    public const string TimesheetsApprove = "billing.timesheets.approve";
    public const string InvoicesView = "billing.invoices.view";
    public const string InvoicesManage = "billing.invoices.manage";
    public const string InvoicesReview = "billing.invoices.review";
    public const string InvoicesApprove = "billing.invoices.approve";
    public const string ReceiptsView = "billing.receipts.view";
    public const string ReceiptsManage = "billing.receipts.manage";
    public const string ReceiptsReview = "billing.receipts.review";
    public const string ReceiptsApprove = "billing.receipts.approve";
    public const string BankAccountsManage = "billing.bank_accounts.manage";

    private const string GroupAr = "الفوترة";
    private const string GroupEn = "Billing";

    public static readonly PermissionDefinition[] All =
    [
        new(TimesheetsView, GroupAr, GroupEn, "عرض التحضير الشهري ومخرجاته", "View monthly timesheets and their outputs"),
        new(TimesheetsManage, GroupAr, GroupEn, "توليد التحضير وتعديلاته وإرساله وإعدادات فوترة المشروع", "Generate, adjust and send timesheets; project billing settings"),
        new(TimesheetsApprove, GroupAr, GroupEn, "اعتماد التحضير الشهري", "Approve monthly timesheets"),
        new(InvoicesView, GroupAr, GroupEn, "عرض فواتير العملاء والإشعارات", "View customer invoices and notes"),
        new(InvoicesManage, GroupAr, GroupEn, "إنشاء الفواتير والإشعارات وتعديل مسوداتها وإرسالها", "Create invoices and notes, edit their drafts and send them"),
        new(InvoicesReview, GroupAr, GroupEn, "مراجعة الفواتير (مشرف أو مدير المشروع)", "Review invoices (project supervisor or manager)"),
        new(InvoicesApprove, GroupAr, GroupEn, "اعتماد الفواتير وإصدارها (المالية)", "Approve and issue invoices (finance)"),
        new(ReceiptsView, GroupAr, GroupEn, "عرض سندات القبض وكشوف حسابات المشاريع وأعمار الديون", "View receipts, project statements and debt ages"),
        new(ReceiptsManage, GroupAr, GroupEn, "إنشاء سندات القبض وتوزيعها على الفواتير وإرسالها", "Create receipts, allocate them to invoices and send them"),
        new(ReceiptsReview, GroupAr, GroupEn, "مراجعة سندات القبض (المحاسب)", "Review receipts (accountant)"),
        new(ReceiptsApprove, GroupAr, GroupEn, "اعتماد سندات القبض (المالية)", "Approve receipts (finance)"),
        new(BankAccountsManage, GroupAr, GroupEn, "إدارة الحسابات البنكية للشركة", "Manage the company's bank accounts"),
    ];
}
