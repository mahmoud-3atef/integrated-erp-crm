using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workforce.Application;

/// <summary>
/// Builds people and worker files from the CRM copy (new_employee), after every sync: only what changed since the
/// last import. Identity numbers already held by another person are kept for review but not as current, so no
/// number ever belongs to two people. Nationality and profession come from the reference list mappings.
/// </summary>
internal sealed class WorkerImportService(WorkforceDbContext db, ICrmStaging staging, IClock clock) : ICrmStagingConsumer
{
    private const string Employee = "new_employee";
    private const int Chunk = 300;

    // CRM dates are midnight in Riyadh stored as UTC (21:00 the day before).
    private static readonly TimeSpan Riyadh = TimeSpan.FromHours(3);

    public string Name => "workers";

    public async Task<string> ApplyAsync(CancellationToken cancellationToken)
    {
        var nationalities = await staging.MappedCodesAsync("new_country", cancellationToken).ConfigureAwait(false);
        var professions = await staging.MappedCodesAsync("new_profession", cancellationToken).ConfigureAwait(false);
        var remapped = await RemapAsync(nationalities, professions, cancellationToken).ConfigureAwait(false);

        var state = await db.Imports.FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (state is null)
        {
            state = new WorkforceImport();
            db.Imports.Add(state);
        }

        var records = await staging.ChangedSinceAsync(Employee, state.Watermark, cancellationToken).ConfigureAwait(false);
        if (records.Count == 0)
        {
            return remapped == 0 ? "no changes" : $"{remapped} nationalities or professions updated after a merge";
        }

        // Current identity numbers of the company: (type, number) → person. Numbers are never moved between people
        // during an import, so a number freed by one person in this run is not given to another until the next one.
        var taken = (await db.Identifiers.AsNoTracking().Where(i => i.IsCurrent)
                .Select(i => new { i.Type, i.Number, i.PersonId }).ToListAsync(cancellationToken).ConfigureAwait(false))
            .ToDictionary(i => (i.Type, i.Number), i => i.PersonId);

        // Oldest CRM records first: when two people carry the same number, the one created first keeps it.
        var ordered = records.OrderBy(r => CreatedOn(r.Payload)).ThenBy(r => r.CrmId).ToList();
        int created = 0, updated = 0, removed = 0, duplicates = 0;
        foreach (var chunk in ordered.Chunk(Chunk))
        {
            var ids = chunk.Select(r => r.CrmId).ToList();
            var workers = await db.Workers.Where(w => ids.Contains(w.CrmId)).ToDictionaryAsync(w => w.CrmId, cancellationToken).ConfigureAwait(false);
            var personIds = workers.Values.Select(w => w.PersonId).ToList();
            var people = await db.People.Include(p => p.Identifiers).Where(p => personIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, cancellationToken).ConfigureAwait(false);

            foreach (var record in chunk)
            {
                workers.TryGetValue(record.CrmId, out var worker);
                if (record.IsDeleted)
                {
                    if (worker is { RemovedInCrm: false })
                    {
                        worker.MarkRemovedInCrm();
                        removed++;
                    }

                    continue;
                }

                using var document = JsonDocument.Parse(record.Payload);
                var row = document.RootElement;
                Person person;
                if (worker is null)
                {
                    person = new Person(Text(row, "new_name") ?? "—", null);
                    db.People.Add(person);
                    worker = new Worker(person.Id, record.CrmId);
                    db.Workers.Add(worker);
                    created++;
                }
                else
                {
                    person = people[worker.PersonId];
                    updated++;
                }

                person.Update(
                    Fit(Text(row, "new_name") ?? "—", Person.NameMaxLength),
                    null,
                    Id(row, "new_nationalityid"),
                    Lookup(row, "new_nationalityid", nationalities),
                    Int(row, "new_maritalstatus"));

                foreach (var (type, field, expiryField) in IdentifierFields)
                {
                    var number = Text(row, field)?.Trim().ToUpperInvariant();
                    if (number is { Length: > PersonIdentifier.NumberMaxLength })
                    {
                        number = number[..PersonIdentifier.NumberMaxLength];
                    }

                    var usable = number is null || !taken.TryGetValue((type, number), out var holder) || holder == person.Id;
                    if (number is not null && !usable)
                    {
                        duplicates++;
                    }
                    else if (number is not null)
                    {
                        taken[(type, number)] = person.Id;
                    }

                    person.SetIdentifier(type, number, expiryField is null ? null : Date(row, expiryField), usable);
                }

                worker.Update(Snapshot(record.CrmId, row, professions));
            }

            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        var summary = $"{created} added, {updated} updated, {removed} removed in the CRM, {duplicates} identity numbers already used by another person"
            + (remapped > 0 ? $", {remapped} remapped after a merge" : string.Empty);
        state.Done(records.Max(r => r.LastSyncedAt), clock.UtcNow, summary);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return summary;
    }

    /// <summary>
    /// Follows changes of the nationality / profession mappings (a value linked or merged by hand on the sync screen):
    /// records whose stored code no longer matches their CRM value's mapping get the new code.
    /// </summary>
    private async Task<int> RemapAsync(IReadOnlyDictionary<Guid, string> nationalities, IReadOnlyDictionary<Guid, string> professions, CancellationToken cancellationToken)
    {
        static string? CodeOf(Guid? id, IReadOnlyDictionary<Guid, string> codes) => id is { } value && codes.TryGetValue(value, out var code) ? code : null;

        var changed = 0;
        foreach (var person in await db.People.Where(p => p.NationalityCrmId != null).ToListAsync(cancellationToken).ConfigureAwait(false))
        {
            var code = CodeOf(person.NationalityCrmId, nationalities);
            if (code != person.NationalityCode)
            {
                person.Remap(code);
                changed++;
            }
        }

        foreach (var worker in await db.Workers.Where(w => w.ProfessionCrmId != null || w.IqamaProfessionCrmId != null).ToListAsync(cancellationToken).ConfigureAwait(false))
        {
            var profession = CodeOf(worker.ProfessionCrmId, professions);
            var iqamaProfession = CodeOf(worker.IqamaProfessionCrmId, professions);
            if (profession != worker.ProfessionCode || iqamaProfession != worker.IqamaProfessionCode)
            {
                worker.Remap(profession, iqamaProfession);
                changed++;
            }
        }

        if (changed > 0)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        db.ChangeTracker.Clear();
        return changed;
    }

    private static readonly (IdentifierType Type, string Field, string? Expiry)[] IdentifierFields =
    [
        (IdentifierType.Iqama, "new_idnumber", "new_expirydateg"),
        (IdentifierType.Passport, "new_passportnumber", "new_expirydate"),
        (IdentifierType.BorderNumber, "new_borderno", null),
        (IdentifierType.Visa, "new_passportvisanumber", null),
        (IdentifierType.WorkPermit, "new_sadadworkpermitno", null),
        (IdentifierType.Gosi, "new_gossiidnumber", null),
    ];

    private static WorkerSnapshot Snapshot(Guid crmId, JsonElement row, IReadOnlyDictionary<Guid, string> professions) => new(
        WorkerNo: Text(row, "new_empidnumber")?.Trim() is { Length: > 0 } no ? Fit(no, 50) : "CRM-" + crmId.ToString("N")[..8].ToUpperInvariant(),
        Kind: Int(row, "new_employeetype") == 1 ? WorkerKind.Staff : WorkerKind.Worker,
        ProfessionCrmId: Id(row, "new_professionid"),
        ProfessionCode: Lookup(row, "new_professionid", professions),
        IqamaProfessionCrmId: Id(row, "new_professioniniqama"),
        IqamaProfessionCode: Lookup(row, "new_professioniniqama", professions),
        CrmStatus: Int(row, "statuscode"),
        Sponsor: CrmSponsors.Name(Int(row, "new_sponseredby")),
        RecruitmentAgent: Text(row, "new_agentname") is { } agent ? Fit(agent, 200) : null,
        ProjectCrmId: Id(row, "new_projectid"),
        ProjectName: Text(row, "new_projectidname") is { } project ? Fit(project, 300) : null,
        ProjectJoinedOn: Date(row, "new_projectjoingdate"),
        ArrivedOn: Date(row, "new_dateofjoining"),
        Salary: new Salary(
            Money(row, "new_basicsalary"),
            Money(row, "new_housingallowance"),
            Money(row, "new_foodallowance"),
            Money(row, "new_trasnallowance"),
            Money(row, "new_overtimeallowance"),
            Money(row, "new_otherallowance"),
            Money(row, "new_mobileallowance"),
            Money(row, "new_hardworkallowance"),
            Money(row, "new_totalsalary")),
        Contract: new ContractTerms(Date(row, "new_contractstartdate"), Int(row, "new_pirodcontract"), Date(row, "new_contractenddate")),
        Leave: new LeaveBalance(
            Number(row, "new_annualleave"),
            Number(row, "new_vacationbalance"),
            Number(row, "new_consumedblalnce"),
            Number(row, "new_oldconsumedbalance"),
            Number(row, "new_remainingbalance")),
        CrmCreatedAt: DateTimeOffset.TryParse(Text(row, "createdon"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var createdAt) ? createdAt : null);

    private static DateTimeOffset CreatedOn(string payload)
    {
        using var document = JsonDocument.Parse(payload);
        return DateTimeOffset.TryParse(Text(document.RootElement, "createdon"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var at)
            ? at
            : DateTimeOffset.MaxValue;
    }

    private static string? Text(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()) ? v.GetString() : null;

    private static Guid? Id(JsonElement row, string field) => Guid.TryParse(Text(row, field), out var id) ? id : null;

    private static string? Lookup(JsonElement row, string field, IReadOnlyDictionary<Guid, string> codes) =>
        Id(row, field) is { } id && codes.TryGetValue(id, out var code) ? code : null;

    private static int? Int(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;

    private static decimal? Number(JsonElement row, string field) =>
        row.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d) ? Math.Round(d, 2) : null;

    private static decimal Money(JsonElement row, string field) => Number(row, field) ?? 0;

    private static DateOnly? Date(JsonElement row, string field) =>
        DateTimeOffset.TryParse(Text(row, field), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var at)
            ? DateOnly.FromDateTime(at.ToOffset(Riyadh).DateTime)
            : null;

    private static string Fit(string text, int max) => text.Length <= max ? text : text[..max];
}
