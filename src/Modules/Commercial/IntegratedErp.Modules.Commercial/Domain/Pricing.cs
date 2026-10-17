using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Commercial.Domain;

/// <summary>
/// How a package prices a worker: a fixed monthly total (Total Cost contracts), or the worker's own salary plus a
/// fixed service fee (Cost Plus contracts, where the salary passes through to the customer).
/// </summary>
public enum PricingBasis
{
    FixedTotal,
    SalaryPlusFee,
}

/// <summary>Where a worker's current price comes from.</summary>
public enum WorkerPriceKind
{
    /// <summary>The worker's price is the package's price.</summary>
    Package,

    /// <summary>A price different from the package's ("special price").</summary>
    Special,

    /// <summary>No price on the work start nor on the worker: needs a price before the period ledger.</summary>
    Missing,
}

/// <summary>
/// A price package: the monthly price of a profession and nationality on a project's contract
/// (docs/02-target-architecture/04 §4.3). In the parallel phase it is derived from the prices on the open work
/// starts: the most common price of each project × profession × nationality; the others are special prices.
/// </summary>
public sealed class PricePackage : ITenantOwned, INotAudited
{
    private PricePackage()
    {
    }

    public PricePackage(Guid projectId, Guid contractId, string? professionCode, string? nationalityCode)
    {
        Id = Guid.CreateVersion7();
        ProjectId = projectId;
        ContractId = contractId;
        ProfessionCode = professionCode;
        NationalityCode = nationalityCode;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid ProjectId { get; private set; }

    public Guid ContractId { get; private set; }

    /// <summary>Profession reference code (after any merge); null when the workers have none.</summary>
    public string? ProfessionCode { get; private set; }

    /// <summary>Nationality reference code; null when the workers have none.</summary>
    public string? NationalityCode { get; private set; }

    public PricingBasis Basis { get; private set; }

    /// <summary>The fixed monthly total (fixed-total packages).</summary>
    public decimal? TotalPrice { get; private set; }

    /// <summary>The service fee on top of the salary (salary-plus-fee packages).</summary>
    public decimal? ServiceFee { get; private set; }

    /// <summary>Housing part of the price.</summary>
    public decimal Housing { get; private set; }

    /// <summary>Transport part of the price.</summary>
    public decimal Transport { get; private set; }

    /// <summary>Workers priced at the package.</summary>
    public int Workers { get; private set; }

    /// <summary>Workers of this profession and nationality on the project at a special price.</summary>
    public int SpecialWorkers { get; private set; }

    /// <summary>The earliest work start priced at the package.</summary>
    public DateOnly? Since { get; private set; }

    public DateTimeOffset DerivedAt { get; private set; }

    public void Derive(PricingBasis basis, decimal amount, decimal housing, decimal transport, int workers, int specialWorkers, DateOnly? since, DateTimeOffset at)
    {
        Basis = basis;
        TotalPrice = basis == PricingBasis.FixedTotal ? amount : null;
        ServiceFee = basis == PricingBasis.SalaryPlusFee ? amount : null;
        Housing = housing;
        Transport = transport;
        Workers = workers;
        SpecialWorkers = specialWorkers;
        Since = since;
        DerivedAt = at;
    }

    /// <summary>The monthly price of a worker with this salary.</summary>
    public decimal PriceFor(decimal salary) => Basis == PricingBasis.FixedTotal ? TotalPrice ?? 0 : salary + (ServiceFee ?? 0);
}

/// <summary>
/// A worker's current price on their project: from their latest work start there (CRM new_empwork), or the
/// worker's default service price when the work start has none.
/// </summary>
public sealed class WorkerPrice : ITenantOwned, INotAudited
{
    private WorkerPrice()
    {
        WorkerNo = string.Empty;
        Name = string.Empty;
    }

    public WorkerPrice(Guid workerId, Guid workerCrmId)
        : this()
    {
        Id = Guid.CreateVersion7();
        WorkerId = workerId;
        WorkerCrmId = workerCrmId;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>The worker in the Workforce module.</summary>
    public Guid WorkerId { get; private set; }

    public Guid WorkerCrmId { get; private set; }

    public string WorkerNo { get; private set; }

    public string Name { get; private set; }

    public Guid ProjectId { get; private set; }

    public string? ProfessionCode { get; private set; }

    public string? NationalityCode { get; private set; }

    public decimal Salary { get; private set; }

    /// <summary>The full monthly price (salary included), as on the old system's service price.</summary>
    public decimal? ServicePrice { get; private set; }

    public decimal Housing { get; private set; }

    public decimal Transport { get; private set; }

    public WorkerPriceKind Kind { get; private set; }

    public Guid? PackageId { get; private set; }

    /// <summary>The work start's number (SW000000) the price was read from.</summary>
    public string? WorkStartNo { get; private set; }

    public DateOnly? StartedOn { get; private set; }

    /// <summary>The price came from the worker's default service price (the work start had none).</summary>
    public bool FromWorkerDefault { get; private set; }

    public void Update(WorkerPriceSnapshot s)
    {
        ArgumentNullException.ThrowIfNull(s);
        WorkerId = s.WorkerId;
        WorkerNo = s.WorkerNo;
        Name = s.Name;
        ProjectId = s.ProjectId;
        ProfessionCode = s.ProfessionCode;
        NationalityCode = s.NationalityCode;
        Salary = s.Salary;
        ServicePrice = s.ServicePrice;
        Housing = s.Housing;
        Transport = s.Transport;
        WorkStartNo = s.WorkStartNo;
        StartedOn = s.StartedOn;
        FromWorkerDefault = s.FromWorkerDefault;
    }

    public void Classify(WorkerPriceKind kind, Guid? packageId)
    {
        Kind = kind;
        PackageId = packageId;
    }
}

public sealed record WorkerPriceSnapshot(
    Guid WorkerId,
    string WorkerNo,
    string Name,
    Guid ProjectId,
    string? ProfessionCode,
    string? NationalityCode,
    decimal Salary,
    decimal? ServicePrice,
    decimal Housing,
    decimal Transport,
    string? WorkStartNo,
    DateOnly? StartedOn,
    bool FromWorkerDefault);

/// <summary>When the packages were last derived, and the outcome.</summary>
public sealed class PricingImport : ITenantOwned
{
    public Guid Id { get; private set; } = Guid.CreateVersion7();

    public Guid TenantId { get; private set; }

    public DateTimeOffset? DerivedAt { get; private set; }

    public string? Summary { get; private set; }

    public void Derived(DateTimeOffset at, string summary)
    {
        DerivedAt = at;
        Summary = summary;
    }
}
