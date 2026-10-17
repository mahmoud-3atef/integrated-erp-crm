using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workforce.Domain;

/// <summary>How an old invoice line compares with the period ledger.</summary>
public static class InvoiceCheckResults
{
    /// <summary>Same days on the project and the same price.</summary>
    public const string Match = "Match";

    /// <summary>The invoice counts other days on the project than the ledger.</summary>
    public const string DaysDiff = "DaysDiff";

    /// <summary>Same days, another price.</summary>
    public const string PriceDiff = "PriceDiff";

    /// <summary>Other days and another price.</summary>
    public const string DaysAndPriceDiff = "DaysAndPriceDiff";

    /// <summary>Invoiced, but the ledger has the worker nowhere on this project in the invoice's period.</summary>
    public const string NotInLedger = "NotInLedger";

    /// <summary>On the project in the ledger, the project was invoiced, but not for this worker.</summary>
    public const string NotInvoiced = "NotInvoiced";

    /// <summary>On the project in the ledger, and the project has no invoice for the month (not counted in the match rate).</summary>
    public const string ProjectNotInvoiced = "ProjectNotInvoiced";

    public static readonly string[] All = [Match, DaysDiff, PriceDiff, DaysAndPriceDiff, NotInLedger, NotInvoiced, ProjectNotInvoiced];
}

/// <summary>
/// One line of the attendance check (slice 1.5): an old invoice line (or a worker the ledger has on an invoiced project
/// without one) against the days and price the period ledger gives for the same worker, project and invoice period.
/// Rebuilt after every sync, never edited.
/// </summary>
public sealed class InvoiceCheckLine : ITenantOwned, INotAudited
{
    private InvoiceCheckLine()
    {
        WorkerNo = string.Empty;
        Name = string.Empty;
        Result = string.Empty;
        Details = string.Empty;
    }

    public InvoiceCheckLine(DateOnly month, Guid? workerId, string workerNo, string name, Guid? projectCrmId, string? projectName, string? invoiceNo,
        DateOnly from, DateOnly to, decimal monthDays, decimal? workingDays, decimal? absentDays, decimal? invoicedPrice, decimal? amount,
        decimal? ledgerDays, decimal? ledgerPrice, string? ledgerSources, string result, string details)
        : this()
    {
        Id = Guid.CreateVersion7();
        Month = month;
        WorkerId = workerId;
        WorkerNo = workerNo;
        Name = name;
        ProjectCrmId = projectCrmId;
        ProjectName = projectName;
        InvoiceNo = invoiceNo;
        From = from;
        To = to;
        MonthDays = monthDays;
        WorkingDays = workingDays;
        AbsentDays = absentDays;
        InvoicedPrice = invoicedPrice;
        Amount = amount;
        LedgerDays = ledgerDays;
        LedgerPrice = ledgerPrice;
        LedgerSources = ledgerSources;
        Result = result;
        Details = details;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>The first day of the invoiced month.</summary>
    public DateOnly Month { get; private set; }

    /// <summary>The worker here; null when the old system's worker is not in this system.</summary>
    public Guid? WorkerId { get; private set; }

    public string WorkerNo { get; private set; }

    public string Name { get; private set; }

    public Guid? ProjectCrmId { get; private set; }

    public string? ProjectName { get; private set; }

    public string? InvoiceNo { get; private set; }

    /// <summary>The invoice's period (both days included).</summary>
    public DateOnly From { get; private set; }

    public DateOnly To { get; private set; }

    /// <summary>The month's days on the invoice (a full month counts as these, whatever the calendar says).</summary>
    public decimal MonthDays { get; private set; }

    public decimal? WorkingDays { get; private set; }

    public decimal? AbsentDays { get; private set; }

    /// <summary>The monthly price on the invoice line.</summary>
    public decimal? InvoicedPrice { get; private set; }

    /// <summary>The line's amount before VAT (with overtime, deductions…, shown only).</summary>
    public decimal? Amount { get; private set; }

    public decimal? LedgerDays { get; private set; }

    public decimal? LedgerPrice { get; private set; }

    /// <summary>The ledger's periods behind the days (document numbers).</summary>
    public string? LedgerSources { get; private set; }

    public string Result { get; private set; }

    /// <summary>What differs, in Arabic (shown as is).</summary>
    public string Details { get; private set; }
}

/// <summary>When the check was last rebuilt, from which changes, and the outcome.</summary>
public sealed class InvoiceCheckImport : ITenantOwned
{
    public Guid Id { get; private set; } = Guid.CreateVersion7();

    public Guid TenantId { get; private set; }

    public DateTimeOffset? InvoicesWatermark { get; private set; }

    public DateTimeOffset? LinesWatermark { get; private set; }

    /// <summary>The history build and the recorded periods the check was made from.</summary>
    public string? LedgerSignature { get; private set; }

    public DateTimeOffset? BuiltAt { get; private set; }

    public string? Summary { get; private set; }

    public void Built(DateTimeOffset? invoices, DateTimeOffset? lines, string ledgerSignature, DateTimeOffset at, string summary)
    {
        InvoicesWatermark = invoices ?? InvoicesWatermark;
        LinesWatermark = lines ?? LinesWatermark;
        LedgerSignature = ledgerSignature;
        BuiltAt = at;
        Summary = summary;
    }
}
