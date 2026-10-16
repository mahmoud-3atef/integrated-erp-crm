using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Reference;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Organization.Domain.Branches;
using IntegratedErp.Modules.Organization.Domain.LegalEntities;
using IntegratedErp.Modules.Organization.Domain.Reference;
using IntegratedErp.Modules.Organization.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Organization.Application.Organization;

public sealed record BranchDto(Guid Id, string Code, string NameAr, string NameEn, Guid? LegalEntityId, string? City, bool IsActive);

public sealed record ReferenceListDto(string Code, string NameAr, string NameEn, string DescriptionAr, string DescriptionEn, int ItemCount);

public sealed record ReferenceItemDto(Guid Id, string Code, string NameAr, string NameEn, int SortOrder, bool IsSystem, bool IsActive);

/// <summary>One change in a record's history: who, when, what (field → old/new).</summary>
public sealed record HistoryEntryDto(string Action, string UserName, DateTimeOffset OccurredAt, IReadOnlyDictionary<string, JsonElement> Changes);

/// <summary>
/// Company setup of the current company: commercial registrations, branches and reference lists. Every change is
/// written to the audit log in the same transaction (ModuleDbContext), and <see cref="HistoryAsync"/> reads it back.
/// </summary>
internal sealed class CompanySetupService(OrganizationDbContext db, ReferenceListCatalog lists, ITenantContext tenant) : IReferenceData
{
    public static readonly Error LegalEntityNotFound = Error.NotFound("legal_entity", "Commercial registration not found.");
    public static readonly Error BranchNotFound = Error.NotFound("branch", "Branch not found.");
    public static readonly Error ListNotFound = Error.NotFound("reference_list", "Reference list not found.");
    public static readonly Error ItemNotFound = Error.NotFound("reference_item", "Reference item not found.");

    // ---------------------------------------------------------------- Commercial registrations

    public async Task<Result<LegalEntityDto>> UpdateLegalEntityAsync(Guid id, string nameAr, string nameEn, string crNumber, string? vatNumber, bool isActive, CancellationToken cancellationToken)
    {
        var entity = await db.LegalEntities.FirstOrDefaultAsync(e => e.Id == id, cancellationToken).ConfigureAwait(false);
        if (entity is null)
        {
            return Result.Failure<LegalEntityDto>(LegalEntityNotFound);
        }

        var updated = entity.Update(nameAr, nameEn, crNumber, vatNumber);
        if (updated.IsFailure)
        {
            return Result.Failure<LegalEntityDto>(updated.Error);
        }

        entity.SetActive(isActive);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(new LegalEntityDto(entity.Id, entity.Code, entity.NameAr, entity.NameEn, entity.CommercialRegistrationNo, entity.VatNumber, entity.IsActive));
    }

    // ---------------------------------------------------------------- Branches

    public async Task<IReadOnlyList<BranchDto>> ListBranchesAsync(CancellationToken cancellationToken) =>
        (await db.Branches.AsNoTracking().OrderBy(b => b.Code).ToListAsync(cancellationToken).ConfigureAwait(false)).Select(ToDto).ToList();

    public async Task<Result<BranchDto>> CreateBranchAsync(string code, string nameAr, string nameEn, Guid? legalEntityId, string? city, CancellationToken cancellationToken)
    {
        if (!await LegalEntityExistsAsync(legalEntityId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<BranchDto>(LegalEntityNotFound);
        }

        var created = Branch.Create(code, nameAr, nameEn, legalEntityId, city);
        if (created.IsFailure)
        {
            return Result.Failure<BranchDto>(created.Error);
        }

        if (await db.Branches.AnyAsync(b => b.Code == created.Value.Code, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<BranchDto>(Error.Conflict("branch_code_taken", "A branch with this code already exists."));
        }

        db.Branches.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(ToDto(created.Value));
    }

    public async Task<Result<BranchDto>> UpdateBranchAsync(Guid id, string nameAr, string nameEn, Guid? legalEntityId, string? city, bool isActive, CancellationToken cancellationToken)
    {
        var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == id, cancellationToken).ConfigureAwait(false);
        if (branch is null)
        {
            return Result.Failure<BranchDto>(BranchNotFound);
        }

        if (!await LegalEntityExistsAsync(legalEntityId, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<BranchDto>(LegalEntityNotFound);
        }

        var updated = branch.Update(nameAr, nameEn, legalEntityId, city);
        if (updated.IsFailure)
        {
            return Result.Failure<BranchDto>(updated.Error);
        }

        branch.SetActive(isActive);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(ToDto(branch));
    }

    // ---------------------------------------------------------------- Reference lists

    public async Task<IReadOnlyList<ReferenceListDto>> ListReferenceListsAsync(CancellationToken cancellationToken)
    {
        await EnsureSystemItemsAsync(cancellationToken).ConfigureAwait(false);
        var counts = await db.ReferenceItems.AsNoTracking().GroupBy(i => i.ListCode).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, cancellationToken).ConfigureAwait(false);
        return lists.All.Select(l => new ReferenceListDto(l.Code, l.NameAr, l.NameEn, l.DescriptionAr, l.DescriptionEn, counts.GetValueOrDefault(l.Code))).ToList();
    }

    public async Task<Result<IReadOnlyList<ReferenceItemDto>>> ListItemsAsync(string listCode, CancellationToken cancellationToken)
    {
        if (lists.Find(listCode) is null)
        {
            return Result.Failure<IReadOnlyList<ReferenceItemDto>>(ListNotFound);
        }

        await EnsureSystemItemsAsync(cancellationToken).ConfigureAwait(false);
        var items = await db.ReferenceItems.AsNoTracking().Where(i => i.ListCode == listCode)
            .OrderBy(i => i.SortOrder).ThenBy(i => i.Code).ToListAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success<IReadOnlyList<ReferenceItemDto>>(items.Select(ToDto).ToList());
    }

    public async Task<Result<ReferenceItemDto>> CreateItemAsync(string listCode, string code, string nameAr, string nameEn, int sortOrder, CancellationToken cancellationToken)
    {
        if (lists.Find(listCode) is null)
        {
            return Result.Failure<ReferenceItemDto>(ListNotFound);
        }

        var created = ReferenceItem.Create(listCode, code, nameAr, nameEn, sortOrder);
        if (created.IsFailure)
        {
            return Result.Failure<ReferenceItemDto>(created.Error);
        }

        if (await db.ReferenceItems.AnyAsync(i => i.ListCode == listCode && i.Code == created.Value.Code, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<ReferenceItemDto>(Error.Conflict("reference_code_taken", "This list already has an item with this code."));
        }

        db.ReferenceItems.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(ToDto(created.Value));
    }

    public async Task<Result<ReferenceItemDto>> UpdateItemAsync(string listCode, Guid id, string nameAr, string nameEn, int sortOrder, bool isActive, CancellationToken cancellationToken)
    {
        var item = await db.ReferenceItems.FirstOrDefaultAsync(i => i.Id == id && i.ListCode == listCode, cancellationToken).ConfigureAwait(false);
        if (item is null)
        {
            return Result.Failure<ReferenceItemDto>(ItemNotFound);
        }

        var outcome = item.Update(nameAr, nameEn, sortOrder);
        if (outcome.IsSuccess)
        {
            outcome = item.SetActive(isActive);
        }

        if (outcome.IsFailure)
        {
            return Result.Failure<ReferenceItemDto>(outcome.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(ToDto(item));
    }

    public async Task<IReadOnlyList<ReferenceItemInfo>> ListAsync(string listCode, CancellationToken cancellationToken)
    {
        await EnsureSystemItemsAsync(cancellationToken).ConfigureAwait(false);
        return await db.ReferenceItems.AsNoTracking().Where(i => i.ListCode == listCode && i.IsActive)
            .OrderBy(i => i.SortOrder).ThenBy(i => i.Code)
            .Select(i => new ReferenceItemInfo(i.ListCode, i.Code, i.NameAr, i.NameEn, i.IsActive))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<bool> IsValidAsync(string listCode, string code, CancellationToken cancellationToken)
    {
        await EnsureSystemItemsAsync(cancellationToken).ConfigureAwait(false);
        var normalized = ReferenceItem.NormalizeCode(code);
        return await db.ReferenceItems.AnyAsync(i => i.ListCode == listCode && i.Code == normalized && i.IsActive, cancellationToken).ConfigureAwait(false);
    }

    // ---------------------------------------------------------------- History

    /// <summary>Audit trail of one record of the current company, newest first.</summary>
    public async Task<IReadOnlyList<HistoryEntryDto>> HistoryAsync(string entityType, Guid id, CancellationToken cancellationToken)
    {
        var key = id.ToString();
        var entries = await db.AuditLog.AsNoTracking()
            .Where(a => a.TenantId == tenant.TenantId && a.EntityType == entityType && a.EntityId == key)
            .OrderByDescending(a => a.OccurredAt)
            .Take(200)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return entries.Select(a => new HistoryEntryDto(
                a.Action,
                a.UserName,
                a.OccurredAt,
                JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(a.Changes) ?? []))
            .ToList();
    }

    /// <summary>Every company gets each list's system items (codes the logic relies on) on first use.</summary>
    private async Task EnsureSystemItemsAsync(CancellationToken cancellationToken)
    {
        if (tenant.TenantId is not { } tenantId)
        {
            return;
        }

        var wanted = lists.All.SelectMany(l => l.SystemItems.Select((item, index) => (List: l.Code, Item: item, Order: index + 1))).ToList();
        if (wanted.Count == 0)
        {
            return;
        }

        var listCodes = wanted.Select(w => w.List).Distinct().ToList();
        var existing = (await db.ReferenceItems.AsNoTracking().Where(i => listCodes.Contains(i.ListCode) && i.IsSystem)
                .Select(i => new { i.ListCode, i.Code }).ToListAsync(cancellationToken).ConfigureAwait(false))
            .Select(i => (i.ListCode, i.Code)).ToHashSet();
        var missing = wanted.Where(w => !existing.Contains((w.List, w.Item.Code))).ToList();
        if (missing.Count == 0)
        {
            return;
        }

        foreach (var (list, item, order) in missing)
        {
            db.ReferenceItems.Add(ReferenceItem.System(tenantId, list, item.Code, item.NameAr, item.NameEn, order));
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    private async Task<bool> LegalEntityExistsAsync(Guid? id, CancellationToken cancellationToken) =>
        id is null || await db.LegalEntities.AnyAsync(e => e.Id == id, cancellationToken).ConfigureAwait(false);

    private static BranchDto ToDto(Branch b) => new(b.Id, b.Code, b.NameAr, b.NameEn, b.LegalEntityId, b.City, b.IsActive);

    private static ReferenceItemDto ToDto(ReferenceItem i) => new(i.Id, i.Code, i.NameAr, i.NameEn, i.SortOrder, i.IsSystem, i.IsActive);
}

internal static class AuditEntityTypes
{
    public const string LegalEntity = nameof(Domain.LegalEntities.LegalEntity);
    public const string Branch = nameof(Domain.Branches.Branch);
    public const string ReferenceItem = nameof(Domain.Reference.ReferenceItem);
}
