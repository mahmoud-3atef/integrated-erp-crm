using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Commercial.Domain;

/// <summary>A customer (company or person) the workers are supplied to.</summary>
public sealed class Customer : ITenantOwned
{
    private Customer()
    {
        Name = string.Empty;
    }

    public Customer(Guid crmId)
        : this()
    {
        Id = Guid.CreateVersion7();
        CrmId = crmId;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid CrmId { get; private set; }

    /// <summary>Customer number (CRM account number).</summary>
    public string? CustomerNo { get; private set; }

    public string Name { get; private set; }

    public string? NameEn { get; private set; }

    public string? CommercialRegistration { get; private set; }

    public string? VatNumber { get; private set; }

    public string? Mobile { get; private set; }

    public string? Email { get; private set; }

    public string? City { get; private set; }

    /// <summary>Contact person at the customer.</summary>
    public string? ContactName { get; private set; }

    public string? LaborOfficeNo { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset? CrmCreatedAt { get; private set; }

    public bool RemovedInCrm { get; private set; }

    public void Update(CustomerSnapshot s)
    {
        ArgumentNullException.ThrowIfNull(s);
        CustomerNo = s.CustomerNo;
        Name = s.Name;
        NameEn = s.NameEn;
        CommercialRegistration = s.CommercialRegistration;
        VatNumber = s.VatNumber;
        Mobile = s.Mobile;
        Email = s.Email;
        City = s.City;
        ContactName = s.ContactName;
        LaborOfficeNo = s.LaborOfficeNo;
        IsActive = s.IsActive;
        CrmCreatedAt = s.CrmCreatedAt;
        RemovedInCrm = false;
    }

    public void MarkRemovedInCrm() => RemovedInCrm = true;
}

public sealed record CustomerSnapshot(
    string? CustomerNo,
    string Name,
    string? NameEn,
    string? CommercialRegistration,
    string? VatNumber,
    string? Mobile,
    string? Email,
    string? City,
    string? ContactName,
    string? LaborOfficeNo,
    bool IsActive,
    DateTimeOffset? CrmCreatedAt);

/// <summary>How the customer is charged (CRM new_contracttype).</summary>
public enum ContractType
{
    /// <summary>مبلغ مقطوع.</summary>
    CostPlus,

    /// <summary>التكلفة الإجمالية.</summary>
    TotalCost,

    /// <summary>التكلفة الإجمالية برواتب متعددة.</summary>
    TotalCostMultiSalaries,
}

/// <summary>Where the contract stands (CRM new_contractstatus).</summary>
public enum ContractStatus
{
    Valid,
    WantsRenewal,
    NoRenewal,
    Canceled,
    Expired,
}

/// <summary>
/// The contract with the customer for a project. In the CRM the project is the contract, so each project has one
/// here; renewals and annexes become separate contracts later.
/// </summary>
public sealed class Contract : ITenantOwned
{
    private Contract()
    {
        ContractNo = string.Empty;
    }

    public Contract(Guid projectCrmId)
        : this()
    {
        Id = Guid.CreateVersion7();
        ProjectCrmId = projectCrmId;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary>The CRM project the contract came from.</summary>
    public Guid ProjectCrmId { get; private set; }

    public string ContractNo { get; private set; }

    public Guid? CustomerId { get; private set; }

    public ContractType? Type { get; private set; }

    public ContractStatus? Status { get; private set; }

    public DateOnly? StartsOn { get; private set; }

    public DateOnly? EndsOn { get; private set; }

    public void LinkCustomer(Guid customerId) => CustomerId = customerId;

    public void Update(string contractNo, Guid? customerId, ContractType? type, ContractStatus? status, DateOnly? startsOn, DateOnly? endsOn)
    {
        ContractNo = contractNo;
        CustomerId = customerId;
        Type = type;
        Status = status;
        StartsOn = startsOn;
        EndsOn = endsOn;
    }
}

/// <summary>A project (site) workers are placed on, under a customer's contract.</summary>
public sealed class Project : ITenantOwned
{
    private Project()
    {
        Code = string.Empty;
        Name = string.Empty;
    }

    public Project(Guid crmId, Guid contractId)
        : this()
    {
        Id = Guid.CreateVersion7();
        CrmId = crmId;
        ContractId = contractId;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid CrmId { get; private set; }

    public Guid ContractId { get; private set; }

    /// <summary>Null when the CRM project has no customer (to be linked).</summary>
    public Guid? CustomerId { get; private set; }

    /// <summary>The CRM customer of the project (kept to link it when the customer arrives later).</summary>
    public Guid? CustomerCrmId { get; private set; }

    public string Code { get; private set; }

    /// <summary>The short name people use (CRM new_name).</summary>
    public string Name { get; private set; }

    public string? NameAr { get; private set; }

    public string? NameEn { get; private set; }

    public string? Manager { get; private set; }

    public string? CommercialRegistration { get; private set; }

    public string? City { get; private set; }

    public string? Sector { get; private set; }

    /// <summary>The customer's person in charge of the project, and how to reach them.</summary>
    public string? ContactName { get; private set; }

    public string? ContactMobile { get; private set; }

    public string? ContactEmails { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset? CrmCreatedAt { get; private set; }

    public bool RemovedInCrm { get; private set; }

    public void Update(ProjectSnapshot s, Guid? customerCrmId, Guid? customerId)
    {
        ArgumentNullException.ThrowIfNull(s);
        CustomerCrmId = customerCrmId;
        CustomerId = customerId;
        Code = s.Code;
        Name = s.Name;
        NameAr = s.NameAr;
        NameEn = s.NameEn;
        Manager = s.Manager;
        CommercialRegistration = s.CommercialRegistration;
        City = s.City;
        Sector = s.Sector;
        ContactName = s.ContactName;
        ContactMobile = s.ContactMobile;
        ContactEmails = s.ContactEmails;
        IsActive = s.IsActive;
        CrmCreatedAt = s.CrmCreatedAt;
        RemovedInCrm = false;
    }

    public void MarkRemovedInCrm() => RemovedInCrm = true;

    public void LinkCustomer(Guid customerId) => CustomerId = customerId;
}

public sealed record ProjectSnapshot(
    string Code,
    string Name,
    string? NameAr,
    string? NameEn,
    string? Manager,
    string? CommercialRegistration,
    string? City,
    string? Sector,
    string? ContactName,
    string? ContactMobile,
    string? ContactEmails,
    bool IsActive,
    DateTimeOffset? CrmCreatedAt);

/// <summary>What the last import from the CRM copy did (one row per company).</summary>
public sealed class CommercialImport : ITenantOwned
{
    public Guid Id { get; private set; } = Guid.CreateVersion7();

    public Guid TenantId { get; private set; }

    public DateTimeOffset? CustomersWatermark { get; private set; }

    public DateTimeOffset? ProjectsWatermark { get; private set; }

    public void Advance(DateTimeOffset? customers, DateTimeOffset? projects)
    {
        CustomersWatermark = customers ?? CustomersWatermark;
        ProjectsWatermark = projects ?? ProjectsWatermark;
    }
}
