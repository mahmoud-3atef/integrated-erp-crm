using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Commercial.Domain;

/// <summary>The amounts of a package (docs/02-target-architecture/04 §4.3).</summary>
public sealed record PackageAmounts(decimal Salary, decimal ServiceFee, decimal Housing, bool HousingBillable, decimal Transport, bool TransportBillable)
{
    /// <summary>The full monthly service price: salary + service fee + housing + transport.</summary>
    public decimal Total => Salary + ServiceFee + Housing + Transport;
}

/// <summary>
/// A price package: the monthly service price of a profession (and a nationality, or any) on one project's contract,
/// or a general package for every project. Created and maintained by the user; a delivery order line picks the
/// package of the worker's profession and nationality (<see cref="PackageResolution"/>) instead of typing a price.
/// </summary>
public sealed class PricePackage : ITenantOwned
{
    private PricePackage()
    {
        PackageNo = string.Empty;
        ProfessionCode = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>Gap-free number, e.g. PKG-00001.</summary>
    public string PackageNo { get; private set; }

    /// <summary>The project the package is for; null = a general package for all projects.</summary>
    public Guid? ProjectId { get; private set; }

    public string ProfessionCode { get; private set; }

    /// <summary>Null = any nationality.</summary>
    public string? NationalityCode { get; private set; }

    public decimal Salary { get; private set; }

    /// <summary>The company's service fee on top of the salary.</summary>
    public decimal ServiceFee { get; private set; }

    public decimal Housing { get; private set; }

    /// <summary>Housing is a separate line on the customer's invoice.</summary>
    public bool HousingBillable { get; private set; }

    public decimal Transport { get; private set; }

    /// <summary>Transport is a separate line on the customer's invoice.</summary>
    public bool TransportBillable { get; private set; }

    /// <summary>The full monthly service price (stored for lists and reports).</summary>
    public decimal TotalPrice { get; private set; }

    public DateOnly ValidFrom { get; private set; }

    /// <summary>Last valid day; null = open-ended.</summary>
    public DateOnly? ValidTo { get; private set; }

    public bool IsActive { get; private set; }

    public string? Notes { get; private set; }

    public static Result<PricePackage> Create(string packageNo, PackageTerms terms)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(packageNo);
        var package = new PricePackage { Id = Guid.CreateVersion7(), PackageNo = packageNo, IsActive = true };
        var applied = package.Apply(terms);
        return applied.IsFailure ? Result.Failure<PricePackage>(applied.Error) : Result.Success(package);
    }

    public Result Update(PackageTerms terms) => Apply(terms);

    public void SetActive(bool active) => IsActive = active;

    /// <summary>Whether the package is valid on a day.</summary>
    public bool IsValidOn(DateOnly day) => IsActive && ValidFrom <= day && (ValidTo is null || day <= ValidTo);

    /// <summary>Whether a validity period shares a day with this package's.</summary>
    public bool Overlaps(DateOnly from, DateOnly? to) => ValidFrom <= (to ?? DateOnly.MaxValue) && from <= (ValidTo ?? DateOnly.MaxValue);

    /// <summary>
    /// A worker's monthly price on this package. On Cost Plus contracts the salary passes through to the customer,
    /// so the worker's own salary replaces the package's.
    /// </summary>
    public decimal PriceFor(bool costPlus, decimal workerSalary) => costPlus ? workerSalary + ServiceFee + Housing + Transport : TotalPrice;

    private Result Apply(PackageTerms t)
    {
        ArgumentNullException.ThrowIfNull(t);
        var a = t.Amounts;
        if (string.IsNullOrWhiteSpace(t.ProfessionCode))
        {
            return Result.Failure(Error.Validation("package_profession", "A profession is required."));
        }

        if (a.Salary < 0 || a.ServiceFee < 0 || a.Housing < 0 || a.Transport < 0)
        {
            return Result.Failure(Error.Validation("package_negative", "Amounts cannot be negative."));
        }

        if (a.Total <= 0)
        {
            return Result.Failure(Error.Validation("package_total", "The package price must be more than zero."));
        }

        if (t.ValidTo is { } to && to < t.ValidFrom)
        {
            return Result.Failure(Error.Validation("package_dates", "The end date is before the start date."));
        }

        ProjectId = t.ProjectId;
        ProfessionCode = t.ProfessionCode.Trim();
        NationalityCode = string.IsNullOrWhiteSpace(t.NationalityCode) ? null : t.NationalityCode.Trim();
        Salary = Math.Round(a.Salary, 2);
        ServiceFee = Math.Round(a.ServiceFee, 2);
        Housing = Math.Round(a.Housing, 2);
        HousingBillable = a.HousingBillable;
        Transport = Math.Round(a.Transport, 2);
        TransportBillable = a.TransportBillable;
        TotalPrice = Salary + ServiceFee + Housing + Transport;
        ValidFrom = t.ValidFrom;
        ValidTo = t.ValidTo;
        Notes = string.IsNullOrWhiteSpace(t.Notes) ? null : t.Notes.Trim();
        return Result.Success();
    }
}

public sealed record PackageTerms(Guid? ProjectId, string ProfessionCode, string? NationalityCode, PackageAmounts Amounts, DateOnly ValidFrom, DateOnly? ValidTo, string? Notes);

/// <summary>Which package applies to a worker: the most specific valid one.</summary>
public static class PackageResolution
{
    /// <summary>
    /// The project's package for the profession and nationality, then the project's for any nationality, then the
    /// general package for the nationality, then the general one for any nationality.
    /// </summary>
    public static PricePackage? Resolve(IEnumerable<PricePackage> packages, Guid? projectId, string? professionCode, string? nationalityCode, DateOnly on)
    {
        ArgumentNullException.ThrowIfNull(packages);
        if (string.IsNullOrWhiteSpace(professionCode))
        {
            return null;
        }

        return packages
            .Where(p => p.IsValidOn(on) && p.ProfessionCode == professionCode
                && (p.ProjectId == null || p.ProjectId == projectId)
                && (p.NationalityCode == null || p.NationalityCode == nationalityCode))
            .OrderBy(p => p.ProjectId == null ? 1 : 0)
            .ThenBy(p => p.NationalityCode == null ? 1 : 0)
            .ThenByDescending(p => p.ValidFrom)
            .FirstOrDefault();
    }
}

/// <summary>
/// A suggested package derived from the prices on the open work starts in the old system: the most common price of a
/// project × profession × nationality, to create real packages from quickly. Rebuilt after every sync.
/// </summary>
public sealed class PriceSuggestion : ITenantOwned, INotAudited
{
    private PriceSuggestion()
    {
    }

    public PriceSuggestion(Guid projectId, string? professionCode, string? nationalityCode)
    {
        Id = Guid.CreateVersion7();
        ProjectId = projectId;
        ProfessionCode = professionCode;
        NationalityCode = nationalityCode;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid ProjectId { get; private set; }

    public string? ProfessionCode { get; private set; }

    public string? NationalityCode { get; private set; }

    /// <summary>The most common full service price (salary included) of the workers at it.</summary>
    public decimal TotalPrice { get; private set; }

    /// <summary>The most common salary of the workers at the suggested price.</summary>
    public decimal Salary { get; private set; }

    /// <summary>On Cost Plus: the fee above each worker's own salary (the suggestion is compared on it).</summary>
    public decimal? FeeAboveSalary { get; private set; }

    public decimal Housing { get; private set; }

    public decimal Transport { get; private set; }

    /// <summary>Workers at the suggested price.</summary>
    public int Workers { get; private set; }

    /// <summary>Workers of this profession and nationality on the project at another price.</summary>
    public int OtherPrices { get; private set; }

    /// <summary>Workers without any price.</summary>
    public int WithoutPrice { get; private set; }

    public DateOnly? Since { get; private set; }

    public DateTimeOffset DerivedAt { get; private set; }

    public void Derive(PriceSuggestionValues v, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(v);
        TotalPrice = v.TotalPrice;
        Salary = v.Salary;
        FeeAboveSalary = v.FeeAboveSalary;
        Housing = v.Housing;
        Transport = v.Transport;
        Workers = v.Workers;
        OtherPrices = v.OtherPrices;
        WithoutPrice = v.WithoutPrice;
        Since = v.Since;
        DerivedAt = at;
    }
}

public sealed record PriceSuggestionValues(
    decimal TotalPrice, decimal Salary, decimal? FeeAboveSalary, decimal Housing, decimal Transport, int Workers, int OtherPrices, int WithoutPrice, DateOnly? Since);

/// <summary>
/// A worker's current price on their project in the old system: from their latest work start there (CRM new_empwork),
/// or the worker's default service price when the work start has none.
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

/// <summary>When the suggestions were last derived, and the outcome.</summary>
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
