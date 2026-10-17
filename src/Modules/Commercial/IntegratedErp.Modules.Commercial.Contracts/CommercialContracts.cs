namespace IntegratedErp.Modules.Commercial.Contracts;

/// <summary>
/// Public surface of the Commercial module: customers, their contracts and the projects workers are placed on
/// (docs/02-target-architecture/01 module 2), and the price packages. In the parallel phase customers and projects are
/// built from the old CRM's copy.
/// </summary>
public static class CommercialContracts
{
    public const string ModuleName = "Commercial";
}

/// <summary>The package that prices a worker, as a delivery order line takes it.</summary>
public sealed record PackagePriceInfo(
    Guid PackageId,
    string PackageNo,
    decimal Salary,
    decimal ServiceFee,
    decimal Housing,
    bool HousingBillable,
    decimal Transport,
    bool TransportBillable,
    decimal TotalPrice,
    bool ForProject,
    bool AnyNationality);

/// <summary>The price packages of the current company.</summary>
public interface IPriceCatalog
{
    /// <summary>
    /// The package for a worker of this profession and nationality on a project on a day: the project's own package
    /// first, then a general one; a package for the nationality before one for any nationality. Null when none applies.
    /// </summary>
    Task<PackagePriceInfo?> FindAsync(Guid projectId, string professionCode, string? nationalityCode, DateOnly on, CancellationToken cancellationToken);
}
