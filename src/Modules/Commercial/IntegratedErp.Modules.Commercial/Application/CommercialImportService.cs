using System.Globalization;
using System.Text.Json;
using IntegratedErp.Modules.Commercial.Domain;
using IntegratedErp.Modules.Commercial.Infrastructure;
using IntegratedErp.Modules.CrmSync.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Commercial.Application;

/// <summary>
/// Builds customers (CRM account), contracts and projects (CRM new_project: the project is the contract there)
/// from the CRM copy after every sync, only what changed. A project whose customer arrives later is linked then.
/// </summary>
internal sealed class CommercialImportService(CommercialDbContext db, ICrmStaging staging) : ICrmStagingConsumer
{
    // CRM dates are midnight in Riyadh stored as UTC (21:00 the day before).
    private static readonly TimeSpan Riyadh = TimeSpan.FromHours(3);

    public string Name => "customers and projects";

    public async Task<string> ApplyAsync(CancellationToken cancellationToken)
    {
        var state = await db.Imports.FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (state is null)
        {
            state = new CommercialImport();
            db.Imports.Add(state);
        }

        var accounts = await staging.ChangedSinceAsync("account", state.CustomersWatermark, cancellationToken).ConfigureAwait(false);
        var projects = await staging.ChangedSinceAsync("new_project", state.ProjectsWatermark, cancellationToken).ConfigureAwait(false);

        // Customers.
        var accountIds = accounts.Select(a => a.CrmId).ToList();
        var customers = await db.Customers.Where(c => accountIds.Contains(c.CrmId)).ToDictionaryAsync(c => c.CrmId, cancellationToken).ConfigureAwait(false);
        int customersAdded = 0, customersRemoved = 0;
        foreach (var record in accounts)
        {
            customers.TryGetValue(record.CrmId, out var customer);
            if (record.IsDeleted)
            {
                if (customer is { RemovedInCrm: false })
                {
                    customer.MarkRemovedInCrm();
                    customersRemoved++;
                }

                continue;
            }

            if (customer is null)
            {
                customer = new Customer(record.CrmId);
                db.Customers.Add(customer);
                customers[record.CrmId] = customer;
                customersAdded++;
            }

            using var document = JsonDocument.Parse(record.Payload);
            var row = document.RootElement;
            customer.Update(new CustomerSnapshot(
                Fit(Text(row, "accountnumber"), 50),
                Fit(Text(row, "name"), 300) ?? "—",
                Fit(Text(row, "new_nameen"), 300),
                Fit(Text(row, "new_noregisterationno"), 50),
                Fit(Text(row, "new_vatnumber"), 50),
                Fit(Text(row, "new_mobilenumber") ?? Text(row, "telephone1"), 50),
                Fit(Text(row, "new_email") ?? Text(row, "emailaddress1"), 200),
                Fit(Text(row, "new_cityidname"), 100),
                Fit(Text(row, "new_responsiblename"), 200),
                Fit(Text(row, "new_laborofficeno"), 50),
                Int(row, "statecode") is null or 0,
                Created(row)));
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        // Projects and their contracts.
        var customerIdsByCrm = await db.Customers.AsNoTracking().ToDictionaryAsync(c => c.CrmId, c => c.Id, cancellationToken).ConfigureAwait(false);
        var projectIds = projects.Select(p => p.CrmId).ToList();
        var existing = await db.Projects.Where(p => projectIds.Contains(p.CrmId)).ToDictionaryAsync(p => p.CrmId, cancellationToken).ConfigureAwait(false);
        var contracts = await db.Contracts.Where(c => projectIds.Contains(c.ProjectCrmId)).ToDictionaryAsync(c => c.ProjectCrmId, cancellationToken).ConfigureAwait(false);
        int projectsAdded = 0, projectsRemoved = 0;
        foreach (var record in projects)
        {
            existing.TryGetValue(record.CrmId, out var project);
            if (record.IsDeleted)
            {
                if (project is { RemovedInCrm: false })
                {
                    project.MarkRemovedInCrm();
                    projectsRemoved++;
                }

                continue;
            }

            using var document = JsonDocument.Parse(record.Payload);
            var row = document.RootElement;
            if (!contracts.TryGetValue(record.CrmId, out var contract))
            {
                contract = new Contract(record.CrmId);
                db.Contracts.Add(contract);
                contracts[record.CrmId] = contract;
            }

            if (project is null)
            {
                project = new Project(record.CrmId, contract.Id);
                db.Projects.Add(project);
                projectsAdded++;
            }

            var customerCrmId = Id(row, "new_customerid");
            Guid? customerId = customerCrmId is { } crm && customerIdsByCrm.TryGetValue(crm, out var found) ? found : null;
            var code = Fit(Text(row, "new_code"), 100) ?? "—";
            contract.Update(code, customerId, ContractTypeOf(Int(row, "new_contracttype")), ContractStatusOf(Int(row, "new_contractstatus")), Date(row, "new_startdate"), Date(row, "new_enddate"));
            project.Update(
                new ProjectSnapshot(
                    code,
                    Fit(Text(row, "new_name"), 300) ?? code,
                    Fit(Text(row, "new_arabicname"), 300),
                    Fit(Text(row, "new_nameenglish"), 300),
                    Fit(Text(row, "owneridname"), 200),
                    Fit(Text(row, "new_registerationno"), 50),
                    Fit(Text(row, "new_cityname"), 100),
                    Fit(Text(row, "new_sectortypeidname"), 200),
                    Fit(Text(row, "new_responsablename"), 200),
                    Fit(Text(row, "new_mobilen"), 50),
                    Fit(Text(row, "new_emailaddresses"), 500),
                    Int(row, "statecode") is null or 0,
                    Created(row),
                    LoginOf(Text(row, "owner_domainname"))),
                customerCrmId,
                customerId);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        // Projects that came before their customer: link them now.
        var linked = 0;
        foreach (var project in await db.Projects.Where(p => p.CustomerId == null && p.CustomerCrmId != null).ToListAsync(cancellationToken).ConfigureAwait(false))
        {
            if (customerIdsByCrm.TryGetValue(project.CustomerCrmId!.Value, out var customerId))
            {
                project.LinkCustomer(customerId);
                (await db.Contracts.FirstAsync(c => c.Id == project.ContractId, cancellationToken).ConfigureAwait(false)).LinkCustomer(customerId);
                linked++;
            }
        }

        state.Advance(accounts.Count > 0 ? accounts.Max(a => a.LastSyncedAt) : null, projects.Count > 0 ? projects.Max(p => p.LastSyncedAt) : null);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return accounts.Count == 0 && projects.Count == 0 && linked == 0
            ? "no changes"
            : $"customers: {customersAdded} added, {accounts.Count - customersAdded} updated, {customersRemoved} removed in the CRM; "
              + $"projects: {projectsAdded} added, {projects.Count - projectsAdded} updated, {projectsRemoved} removed in the CRM, {linked} linked to their customer";
    }

    private static ContractType? ContractTypeOf(int? code) => code switch
    {
        1 => ContractType.CostPlus,
        2 => ContractType.TotalCost,
        3 => ContractType.TotalCostMultiSalaries,
        _ => null,
    };

    private static ContractStatus? ContractStatusOf(int? code) => code switch
    {
        1 => ContractStatus.Valid,
        100000000 => ContractStatus.WantsRenewal,
        100000001 => ContractStatus.NoRenewal,
        100000002 => ContractStatus.Canceled,
        100000003 => ContractStatus.Expired,
        _ => null,
    };

    private static string? Text(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()) ? v.GetString()!.Trim() : null;

    private static Guid? Id(JsonElement row, string field) => Guid.TryParse(Text(row, field), out var id) ? id : null;

    private static int? Int(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;

    private static DateOnly? Date(JsonElement row, string field) =>
        DateTimeOffset.TryParse(Text(row, field), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var at)
            ? DateOnly.FromDateTime(at.ToOffset(Riyadh).DateTime)
            : null;

    private static DateTimeOffset? Created(JsonElement row) =>
        DateTimeOffset.TryParse(Text(row, "createdon"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var at) ? at : null;

    private static string? Fit(string? text, int max) => text is null ? null : text.Length <= max ? text : text[..max];

    /// <summary>"JRCO\\name" → "name" (lower case): how the account signs in here.</summary>
    internal static string? LoginOf(string? domainName)
    {
        if (string.IsNullOrWhiteSpace(domainName))
        {
            return null;
        }

        var name = domainName.Trim();
        var slash = name.LastIndexOf('\\');
        name = (slash >= 0 ? name[(slash + 1)..] : name).Trim().ToLowerInvariant();
        return name.Length is 0 or > 100 ? null : name;
    }
}
