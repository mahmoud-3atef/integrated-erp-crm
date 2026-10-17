namespace IntegratedErp.Modules.Billing.Contracts;

/// <summary>
/// Public surface of the Billing module: the monthly project timesheets (docs/02-target-architecture/06) and, later,
/// the invoices made from them. An approved timesheet feeds the customer invoice, the payroll of the company's workers
/// and the statement of each internal supplier.
/// </summary>
public static class BillingContracts
{
    public const string ModuleName = "Billing";
}
