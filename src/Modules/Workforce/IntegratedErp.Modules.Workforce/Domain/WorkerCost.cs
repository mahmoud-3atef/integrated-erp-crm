using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Workforce.Domain;

/// <summary>How a supplier charges for a worker (docs/02-target-architecture/10 §3).</summary>
public enum CostMethod
{
    /// <summary>The whole month, worked or not (a day in housing is still paid).</summary>
    MonthlyFixed,

    /// <summary>The month's cost ÷ 30 for each day on the job.</summary>
    ByWorkingDays,
}

/// <summary>
/// A supplier's default cost for its workers (docs/03-migration-plan/16): for the supplier, optionally narrowed to a
/// profession and a nationality, from a date. A worker without a card of their own costs the closest package.
/// </summary>
public sealed class SupplierCostPackage : ITenantOwned
{
    public const int NotesMaxLength = 300;

    private SupplierCostPackage()
    {
        Supplier = string.Empty;
        UpdatedBy = string.Empty;
    }

    public SupplierCostPackage(Guid tenantId, CostValues v, string by, DateTimeOffset at)
        : this()
    {
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        Set(v, by, at);
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>The sponsor as the old system names it (e.g. «IRC - 02»).</summary>
    public string Supplier { get; private set; }

    public string? ProfessionCode { get; private set; }

    public string? NationalityCode { get; private set; }

    public decimal MonthlyCost { get; private set; }

    public CostMethod Method { get; private set; }

    public DateOnly EffectiveFrom { get; private set; }

    public string? Notes { get; private set; }

    public bool IsActive { get; private set; } = true;

    public string UpdatedBy { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public void Set(CostValues v, string by, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(v);
        Supplier = v.Supplier;
        ProfessionCode = v.ProfessionCode;
        NationalityCode = v.NationalityCode;
        MonthlyCost = v.MonthlyCost;
        Method = v.Method;
        EffectiveFrom = v.EffectiveFrom;
        Notes = v.Notes;
        UpdatedBy = by;
        UpdatedAt = at;
    }

    public void Deactivate(string by, DateTimeOffset at)
    {
        IsActive = false;
        UpdatedBy = by;
        UpdatedAt = at;
    }

    /// <summary>How closely the package fits a worker: null when it does not, higher when narrower.</summary>
    public int? Fit(string supplier, string? profession, string? nationality, DateOnly on) =>
        !IsActive || EffectiveFrom > on || !string.Equals(Supplier, supplier, StringComparison.OrdinalIgnoreCase)
        || (ProfessionCode is not null && ProfessionCode != profession) || (NationalityCode is not null && NationalityCode != nationality)
            ? null
            : (ProfessionCode is null ? 0 : 2) + (NationalityCode is null ? 0 : 1);
}

/// <summary>
/// What one worker of a supplier costs the company from a date (docs/02-target-architecture/10 §4); a change is a new
/// card (the history stays).
/// </summary>
public sealed class WorkerCostCard : ITenantOwned
{
    private WorkerCostCard()
    {
        Supplier = string.Empty;
        CreatedBy = string.Empty;
    }

    public WorkerCostCard(Guid tenantId, Guid workerId, CostValues v, string by, DateTimeOffset at)
        : this()
    {
        ArgumentNullException.ThrowIfNull(v);
        Id = Guid.CreateVersion7();
        TenantId = tenantId;
        WorkerId = workerId;
        Supplier = v.Supplier;
        MonthlyCost = v.MonthlyCost;
        Method = v.Method;
        EffectiveFrom = v.EffectiveFrom;
        Notes = v.Notes;
        CreatedBy = by;
        CreatedAt = at;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid WorkerId { get; private set; }

    public string Supplier { get; private set; }

    public decimal MonthlyCost { get; private set; }

    public CostMethod Method { get; private set; }

    public DateOnly EffectiveFrom { get; private set; }

    public string? Notes { get; private set; }

    public string CreatedBy { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public bool IsDeleted { get; private set; }

    public void Delete() => IsDeleted = true;
}

public sealed record CostValues(string Supplier, string? ProfessionCode, string? NationalityCode, decimal MonthlyCost, CostMethod Method, DateOnly EffectiveFrom, string? Notes);

/// <summary>Where a worker comes from, read from the old system's sponsor (docs/02-target-architecture/02 §2).</summary>
public enum WorkerSource
{
    /// <summary>On one of the company's registrations (Care-Pro 05 and 07).</summary>
    Company,
    Supplier,

    /// <summary>No sponsor recorded.</summary>
    Unknown,
}

public static class WorkerSources
{
    public static WorkerSource Of(string? sponsor) =>
        string.IsNullOrWhiteSpace(sponsor) ? WorkerSource.Unknown
        : sponsor.Trim().StartsWith("Care-Pro", StringComparison.OrdinalIgnoreCase) ? WorkerSource.Company
        : WorkerSource.Supplier;
}
