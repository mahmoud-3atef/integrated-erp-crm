using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Expenses.Domain;

public enum ExpenseStatus
{
    Active,
    Cancelled,
}

/// <summary>
/// Money the company spent (docs/03-migration-plan/16), charged to a project (its cost), else to a worker (their cost,
/// shared by the projects they worked on), else to the company in general. A cost that covers a stretch (a year's
/// residence renewal) is spread over its months.
/// </summary>
public sealed class Expense : ITenantOwned
{
    public const int TextMaxLength = 200;
    public const int NotesMaxLength = 1000;
    public const int MaxMonths = 36;

    private Expense()
    {
        ExpenseNo = string.Empty;
        Category = string.Empty;
        CreatedBy = string.Empty;
    }

    public Expense(Guid tenantId, string expenseNo, ExpenseValues v, string by, DateTimeOffset at)
        : this()
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        ExpenseNo = expenseNo;
        CreatedBy = by;
        CreatedAt = at;
        Apply(v);
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public string ExpenseNo { get; private set; }

    public DateOnly SpentOn { get; private set; }

    /// <summary>Code from the <c>expense_categories</c> list.</summary>
    public string Category { get; private set; }

    public Guid? WorkerId { get; private set; }

    public string? WorkerNo { get; private set; }

    public string? WorkerName { get; private set; }

    public Guid? ProjectCrmId { get; private set; }

    public string? ProjectName { get; private set; }

    /// <summary>Before VAT (the cost); the VAT is kept apart.</summary>
    public decimal Amount { get; private set; }

    public decimal Vat { get; private set; }

    /// <summary>The months the cost covers from the month it was spent (1: that month only).</summary>
    public int Months { get; private set; }

    public string? PaidTo { get; private set; }

    public string? Reference { get; private set; }

    public string? Notes { get; private set; }

    public ExpenseStatus Status { get; private set; }

    public string? CancelReason { get; private set; }

    public string CreatedBy { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public string? UpdatedBy { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public void Update(ExpenseValues v, string by, DateTimeOffset at)
    {
        Apply(v);
        UpdatedBy = by;
        UpdatedAt = at;
    }

    public void Cancel(string reason, string by, DateTimeOffset at)
    {
        Status = ExpenseStatus.Cancelled;
        CancelReason = reason;
        UpdatedBy = by;
        UpdatedAt = at;
    }

    /// <summary>The part of the cost that falls in a period: each month it covers carries an equal share.</summary>
    public decimal ShareIn(DateOnly from, DateOnly to)
    {
        if (Status == ExpenseStatus.Cancelled)
        {
            return 0;
        }

        var first = new DateOnly(SpentOn.Year, SpentOn.Month, 1);
        var months = Enumerable.Range(0, Months).Select(first.AddMonths).Count(m => m <= to && m.AddMonths(1).AddDays(-1) >= from);
        return Math.Round(Amount * months / Months, 2);
    }

    private void Apply(ExpenseValues v)
    {
        ArgumentNullException.ThrowIfNull(v);
        SpentOn = v.SpentOn;
        Category = v.Category;
        WorkerId = v.WorkerId;
        WorkerNo = v.WorkerNo;
        WorkerName = v.WorkerName;
        ProjectCrmId = v.ProjectCrmId;
        ProjectName = v.ProjectName;
        Amount = v.Amount;
        Vat = v.Vat;
        Months = v.Months;
        PaidTo = v.PaidTo;
        Reference = v.Reference;
        Notes = v.Notes;
    }
}

public sealed record ExpenseValues(
    DateOnly SpentOn,
    string Category,
    Guid? WorkerId,
    string? WorkerNo,
    string? WorkerName,
    Guid? ProjectCrmId,
    string? ProjectName,
    decimal Amount,
    decimal Vat,
    int Months,
    string? PaidTo,
    string? Reference,
    string? Notes);
