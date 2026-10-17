using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.CrmSync.Application;

/// <summary>What importing one list did.</summary>
public sealed record ListImportSummary(
    string ListCode,
    int CrmRecords,
    int Items,
    int Created,
    int AlreadyPresent,
    int Merged,
    int Unmapped,
    int NeedsReview);

public sealed record ReferenceImportReport(ListImportSummary Nationalities, ListImportSummary Professions);

/// <summary>One CRM record and the item it became (null when unmapped).</summary>
public sealed record MappingDto(Guid CrmId, string CrmName, string? CrmCode, string? ItemCode, string Rule, int Usage);

/// <summary>A reference item with the CRM records merged into it.</summary>
public sealed record MappedItemDto(string Code, string NameAr, string NameEn, int Usage, IReadOnlyList<MappingDto> Records);

public sealed record MappingReportDto(string ListCode, IReadOnlyList<MappedItemDto> Items, IReadOnlyList<MappingDto> Unmapped);

/// <summary>
/// Brings the CRM's countries and professions (from staging) into the company's nationality and profession lists,
/// one item per real nationality or profession whatever the number of CRM copies, and remembers which item each CRM
/// record became (to link employees later). Importing again adds only what is new and never changes existing codes.
/// </summary>
internal sealed class ReferenceImportService(CrmSyncDbContext db, IReferenceDataImport import, IReferenceData reference, IClock clock)
{
    public static readonly Error NotSynced = Error.Validation("crm_sync_not_synced", "Sync countries and professions from the CRM first.");
    public static readonly Error ItemUnknown = Error.Validation("crm_sync_item_unknown", "Choose an active item of the list.");
    public static readonly Error SameItem = Error.Validation("crm_sync_same_item", "An item cannot be merged into itself.");
    public static readonly Error MappingNotFound = Error.NotFound("crm_mapping", "CRM record not found.");

    /// <summary>
    /// Merges an item into another (e.g. "worker" into "عامل"): every CRM record of <paramref name="fromCode"/> now
    /// points to <paramref name="toCode"/>, the emptied item is switched off, and later imports keep this choice.
    /// </summary>
    public async Task<Result> MergeAsync(string listCode, string fromCode, string toCode, CancellationToken cancellationToken)
    {
        if (string.Equals(fromCode, toCode, StringComparison.OrdinalIgnoreCase))
        {
            return Result.Failure(SameItem);
        }

        if (!await reference.IsValidAsync(listCode, toCode, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(ItemUnknown);
        }

        var moved = await db.Mappings.Where(m => m.ListCode == listCode && m.ItemCode == fromCode).ToListAsync(cancellationToken).ConfigureAwait(false);
        if (moved.Count == 0)
        {
            return Result.Failure(MappingNotFound);
        }

        var target = toCode.Trim().ToUpperInvariant();
        foreach (var mapping in moved)
        {
            mapping.Update(mapping.CrmName, mapping.CrmCode, target, MatchRule.Manual, mapping.Usage, clock.UtcNow);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return await import.DeactivateAsync(listCode, [fromCode], cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Links one CRM record (e.g. an unmatched one) to an item by hand; later imports keep this choice.</summary>
    public async Task<Result> LinkAsync(string listCode, Guid crmId, string toCode, CancellationToken cancellationToken)
    {
        if (!await reference.IsValidAsync(listCode, toCode, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(ItemUnknown);
        }

        var mapping = await db.Mappings.FirstOrDefaultAsync(m => m.ListCode == listCode && m.CrmId == crmId, cancellationToken).ConfigureAwait(false);
        if (mapping is null)
        {
            return Result.Failure(MappingNotFound);
        }

        mapping.Update(mapping.CrmName, mapping.CrmCode, toCode.Trim().ToUpperInvariant(), MatchRule.Manual, mapping.Usage, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result<ReferenceImportReport>> ImportAsync(CancellationToken cancellationToken)
    {
        var countries = await PayloadsAsync(CrmEntities.Country, cancellationToken).ConfigureAwait(false);
        var professions = await PayloadsAsync(CrmEntities.Profession, cancellationToken).ConfigureAwait(false);
        if (countries.Count == 0 || professions.Count == 0)
        {
            return Result.Failure<ReferenceImportReport>(NotSynced);
        }

        // How many employees use each country / profession (to rank items and judge what a gap affects).
        var nationalityUse = new Dictionary<Guid, int>();
        var professionUse = new Dictionary<Guid, int>();
        foreach (var employee in await PayloadsAsync(CrmEntities.Employee, cancellationToken).ConfigureAwait(false))
        {
            Count(nationalityUse, GuidOf(employee.Values, "new_nationalityid"));
            Count(professionUse, GuidOf(employee.Values, "new_professionid"));
        }

        var nationalities = await ImportListAsync(
            CrmEntities.Country,
            ReferenceListCodes.Nationalities,
            countries.Select(c => Lookup(c, "new_nameenglish", "new_nationality", nationalityUse)).ToList(),
            NationalityPlanner.Plan,
            cancellationToken).ConfigureAwait(false);
        if (nationalities.IsFailure)
        {
            return Result.Failure<ReferenceImportReport>(nationalities.Error);
        }

        var professionResult = await ImportListAsync(
            CrmEntities.Profession,
            ReferenceListCodes.Professions,
            professions.Select(p => Lookup(p, "new_professionenglish", null, professionUse)).ToList(),
            ProfessionPlanner.Plan,
            cancellationToken).ConfigureAwait(false);
        return professionResult.IsFailure
            ? Result.Failure<ReferenceImportReport>(professionResult.Error)
            : Result.Success(new ReferenceImportReport(nationalities.Value, professionResult.Value));
    }

    /// <summary>Every item of a list with the CRM records it came from, and the CRM records left unmapped.</summary>
    public async Task<MappingReportDto> ReportAsync(string listCode, CancellationToken cancellationToken)
    {
        var mappings = await db.Mappings.AsNoTracking().Where(m => m.ListCode == listCode)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var items = await reference.ListAsync(listCode, cancellationToken).ConfigureAwait(false);
        var byCode = mappings.Where(m => m.ItemCode is not null).ToLookup(m => m.ItemCode!);
        var mapped = items
            .Select(i => new MappedItemDto(
                i.Code, i.NameAr, i.NameEn,
                byCode[i.Code].Sum(m => m.Usage),
                byCode[i.Code].OrderByDescending(m => m.Usage).ThenBy(m => m.CrmName, StringComparer.Ordinal).Select(ToDto).ToList()))
            .OrderByDescending(i => i.Usage)
            .ThenBy(i => i.NameAr, StringComparer.Ordinal)
            .ToList();
        var unmapped = mappings.Where(m => m.ItemCode is null).OrderByDescending(m => m.Usage).Select(ToDto).ToList();
        return new MappingReportDto(listCode, mapped, unmapped);
    }

    private async Task<Result<ListImportSummary>> ImportListAsync(
        string entity,
        string listCode,
        List<CrmLookup> records,
        Func<IReadOnlyList<CrmLookup>, ReferencePlan> planner,
        CancellationToken cancellationToken)
    {
        var existing = await db.Mappings.Where(m => m.Entity == entity).ToDictionaryAsync(m => m.CrmId, cancellationToken).ConfigureAwait(false);
        records = records.Select(r => existing.GetValueOrDefault(r.Id) is { } before
                ? r with { PreviousItemCode = before.ItemCode, ChosenByPerson = before.Rule == MatchRule.Manual }
                : r)
            .ToList();
        var plan = planner(records);

        var imported = await import.ImportAsync(
            listCode,
            plan.Items.Select(i => new ImportedReferenceItem(i.Code, i.NameAr, i.NameEn, i.SortOrder)).ToList(),
            cancellationToken).ConfigureAwait(false);
        if (imported.IsFailure)
        {
            return Result.Failure<ListImportSummary>(imported.Error);
        }

        var now = clock.UtcNow;
        foreach (var mapping in plan.Mappings)
        {
            var name = ArabicText.Fit(mapping.CrmName, 500);
            var code = mapping.CrmCode is null ? null : ArabicText.Fit(mapping.CrmCode, 100);
            if (existing.TryGetValue(mapping.CrmId, out var row))
            {
                row.Update(name, code, mapping.ItemCode, mapping.Rule, mapping.Usage, now);
            }
            else
            {
                db.Mappings.Add(new ReferenceMapping(entity, mapping.CrmId, name, code, listCode, mapping.ItemCode, mapping.Rule, mapping.Usage, now));
            }
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var mergedItems = plan.Mappings.Where(m => m.ItemCode is not null).GroupBy(m => m.ItemCode).Sum(g => g.Count() - 1);
        return Result.Success(new ListImportSummary(
            listCode,
            records.Count,
            plan.Items.Count,
            imported.Value.Created,
            imported.Value.AlreadyPresent,
            mergedItems,
            plan.Mappings.Count(m => m.ItemCode is null),
            plan.Items.Count(i => i.NeedsReview) + plan.Mappings.Count(m => m.Rule == MatchRule.Conflict)));
    }

    private async Task<List<(Guid Id, JsonElement Values)>> PayloadsAsync(string entity, CancellationToken cancellationToken)
    {
        var rows = await db.Records.AsNoTracking().Where(r => r.Entity == entity && !r.IsDeleted)
            .Select(r => new { r.CrmId, r.Payload }).ToListAsync(cancellationToken).ConfigureAwait(false);
        return rows.Select(r => (r.CrmId, JsonDocument.Parse(r.Payload).RootElement.Clone())).ToList();
    }

    private static CrmLookup Lookup((Guid Id, JsonElement Values) row, string englishField, string? nationalityField, Dictionary<Guid, int> usage) => new(
        row.Id,
        TextOf(row.Values, "new_name"),
        TextOf(row.Values, "new_code"),
        TextOf(row.Values, englishField),
        nationalityField is null ? null : TextOf(row.Values, nationalityField),
        IntOf(row.Values, "statecode") is null or 0,
        DateOf(row.Values, "createdon"),
        usage.GetValueOrDefault(row.Id));

    private static void Count(Dictionary<Guid, int> counts, Guid? id)
    {
        if (id is { } value)
        {
            counts[value] = counts.GetValueOrDefault(value) + 1;
        }
    }

    private static string? TextOf(JsonElement values, string field) =>
        values.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static Guid? GuidOf(JsonElement values, string field) =>
        Guid.TryParse(TextOf(values, field), out var id) ? id : null;

    private static int? IntOf(JsonElement values, string field) =>
        values.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;

    private static DateTime? DateOf(JsonElement values, string field) =>
        DateTime.TryParse(TextOf(values, field), CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var d) ? d : null;

    private static MappingDto ToDto(ReferenceMapping m) => new(m.CrmId, m.CrmName, m.CrmCode, m.ItemCode, m.Rule.ToString(), m.Usage);
}
