using IntegratedErp.BuildingBlocks.Records;
using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;

namespace IntegratedErp.Modules.Billing.Application;

/// <summary>The billing tables processes can reach through the entity catalog.</summary>
internal sealed class BillingEntities(BillingDbContext db) : ModelEntitySource(db, Models)
{
    private const string Project = "commercial.project";
    private const string Customer = "commercial.customer";

    private static readonly IEntityModel[] Models =
    [
        new EntityModel<Timesheet>(TimesheetAdapter.ScreenCode, "كشف الحضور الشهري", "Timesheet")
            .Lookup(nameof(Timesheet.ProjectId), Project, "المشروع", "Project"),
        new EntityModel<Invoice>(InvoiceAdapter.ScreenCode, "الفاتورة", "Invoice")
            .Lookup(nameof(Invoice.ProjectId), Project, "المشروع", "Project")
            .Lookup(nameof(Invoice.CustomerId), Customer, "العميل", "Customer")
            .Lookup(nameof(Invoice.TimesheetId), TimesheetAdapter.ScreenCode, "كشف الحضور", "Timesheet")
            .Lookup(nameof(Invoice.OriginalInvoiceId), InvoiceAdapter.ScreenCode, "الفاتورة الأصلية", "Original invoice"),
        new EntityModel<Receipt>(ReceiptAdapter.ScreenCode, "سند القبض", "Receipt")
            .Lookup(nameof(Receipt.ProjectId), Project, "المشروع", "Project"),
    ];
}
