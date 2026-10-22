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

/// <summary>A project as other modules show and use it (e.g. on a delivery order).</summary>
public sealed record ProjectInfo(
    Guid Id,
    Guid CrmId,
    string Code,
    string Name,
    string? CustomerName,
    string? Manager,
    string? ContractType,
    bool IsActive,
    string? ManagerLogin = null,
    string? City = null,
    string? Sector = null);

/// <summary>The projects of the current company.</summary>
public interface IProjectDirectory
{
    /// <summary>Active projects, by name.</summary>
    Task<IReadOnlyList<ProjectInfo>> ActiveAsync(CancellationToken cancellationToken);

    /// <summary>Active projects whose manager signs in with one of these names (lower case), by name.</summary>
    Task<IReadOnlyList<ProjectInfo>> ManagedByAsync(IReadOnlyCollection<string> logins, CancellationToken cancellationToken);

    /// <summary>These projects (by id or by CRM id); unknown ones are left out.</summary>
    Task<IReadOnlyList<ProjectInfo>> FindAsync(IReadOnlyCollection<Guid> ids, IReadOnlyCollection<Guid> crmIds, CancellationToken cancellationToken);

    /// <summary>Who the project's invoices are addressed to (null when the project is unknown).</summary>
    Task<ProjectBillTo?> BillToAsync(Guid projectId, CancellationToken cancellationToken);
}

/// <summary>
/// A project's invoice addressee: its customer, or the project itself when it has none (as the old system billed);
/// the registration is the customer's, else the one on the project.
/// </summary>
public sealed record ProjectBillTo(Guid? CustomerId, string Name, string? NameEn, string? VatNumber, string? CommercialRegistration, string? City);
