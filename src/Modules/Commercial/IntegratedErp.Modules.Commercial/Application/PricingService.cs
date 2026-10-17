using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Commercial.Domain;
using IntegratedErp.Modules.Commercial.Infrastructure;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Commercial.Application;

public sealed record PackageInput(
    Guid? ProjectId,
    string ProfessionCode,
    string? NationalityCode,
    decimal Salary,
    decimal ServiceFee,
    decimal Housing,
    bool HousingBillable,
    decimal Transport,
    bool TransportBillable,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    string? Notes);

/// <summary>Creates and maintains the price packages, and finds the package that prices a worker.</summary>
internal sealed class PricingService(CommercialDbContext db, NumberSequenceService numbering, IReferenceData reference, IClock clock) : IPriceCatalog
{
    private static readonly Error NotFound = Error.NotFound("price_package", "Package not found.");

    private static readonly Error Overlap = Error.Conflict(
        "package_overlap", "An active package for the same project, profession and nationality already covers part of this period.");

    public async Task<Result<Guid>> CreateAsync(PackageInput input, CancellationToken cancellationToken)
    {
        var terms = await CheckAsync(null, input, cancellationToken).ConfigureAwait(false);
        if (terms.IsFailure)
        {
            return Result.Failure<Guid>(terms.Error);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var value = await numbering.NextAsync(db, new NumberRequest("price_package"), cancellationToken).ConfigureAwait(false);
        var created = PricePackage.Create(DocumentNumberFormat.Format("PKG-{N:5}", value, clock.Today), terms.Value);
        if (created.IsFailure)
        {
            return Result.Failure<Guid>(created.Error); // rolled back: the number is not used
        }

        db.PricePackages.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(created.Value.Id);
    }

    public async Task<Result> UpdateAsync(Guid id, PackageInput input, CancellationToken cancellationToken)
    {
        var package = await db.PricePackages.FirstOrDefaultAsync(p => p.Id == id, cancellationToken).ConfigureAwait(false);
        if (package is null)
        {
            return Result.Failure(NotFound);
        }

        var terms = await CheckAsync(package.IsActive ? id : Guid.Empty, input, cancellationToken).ConfigureAwait(false);
        if (terms.IsFailure)
        {
            return terms;
        }

        var updated = package.Update(terms.Value);
        if (updated.IsFailure)
        {
            return updated;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>Stops a package (no longer offered) or brings it back, if no other active package covers the same period.</summary>
    public async Task<Result> SetActiveAsync(Guid id, bool active, CancellationToken cancellationToken)
    {
        var package = await db.PricePackages.FirstOrDefaultAsync(p => p.Id == id, cancellationToken).ConfigureAwait(false);
        if (package is null)
        {
            return Result.Failure(NotFound);
        }

        if (active && !package.IsActive
            && await OverlapsAsync(id, package.ProjectId, package.ProfessionCode, package.NationalityCode, package.ValidFrom, package.ValidTo, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure(Overlap);
        }

        package.SetActive(active);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<PackagePriceInfo?> FindAsync(Guid projectId, string professionCode, string? nationalityCode, DateOnly on, CancellationToken cancellationToken)
    {
        var candidates = await db.PricePackages.AsNoTracking()
            .Where(p => p.IsActive && p.ProfessionCode == professionCode && (p.ProjectId == null || p.ProjectId == projectId))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var package = PackageResolution.Resolve(candidates, projectId, professionCode, nationalityCode, on);
        return package is null ? null : new PackagePriceInfo(
            package.Id, package.PackageNo, package.Salary, package.ServiceFee, package.Housing, package.HousingBillable,
            package.Transport, package.TransportBillable, package.TotalPrice, package.ProjectId is not null, package.NationalityCode is null);
    }

    /// <summary>
    /// Validates the codes and the project, and that no other active package of the same project, profession and
    /// nationality covers the period. <paramref name="ownId"/>: null on create, the package's id when it is active,
    /// <see cref="Guid.Empty"/> when it is stopped (a stopped package is not checked).
    /// </summary>
    private async Task<Result<PackageTerms>> CheckAsync(Guid? ownId, PackageInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (string.IsNullOrWhiteSpace(input.ProfessionCode)
            || !await reference.IsValidAsync(ReferenceListCodes.Professions, input.ProfessionCode, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<PackageTerms>(Error.Validation("package_profession", "Choose a profession from the list."));
        }

        if (!string.IsNullOrWhiteSpace(input.NationalityCode)
            && !await reference.IsValidAsync(ReferenceListCodes.Nationalities, input.NationalityCode, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<PackageTerms>(Error.Validation("package_nationality", "Choose a nationality from the list."));
        }

        if (input.ProjectId is { } projectId && !await db.Projects.AnyAsync(p => p.Id == projectId && !p.RemovedInCrm, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<PackageTerms>(Error.Validation("package_project", "Project not found."));
        }

        var profession = input.ProfessionCode.Trim();
        var nationality = string.IsNullOrWhiteSpace(input.NationalityCode) ? null : input.NationalityCode.Trim();
        if (ownId != Guid.Empty
            && await OverlapsAsync(ownId, input.ProjectId, profession, nationality, input.ValidFrom, input.ValidTo, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<PackageTerms>(Overlap);
        }

        return Result.Success(new PackageTerms(
            input.ProjectId, profession, nationality,
            new PackageAmounts(input.Salary, input.ServiceFee, input.Housing, input.HousingBillable, input.Transport, input.TransportBillable),
            input.ValidFrom, input.ValidTo, input.Notes));
    }

    private async Task<bool> OverlapsAsync(Guid? exceptId, Guid? projectId, string professionCode, string? nationalityCode, DateOnly from, DateOnly? to, CancellationToken cancellationToken)
    {
        var same = await db.PricePackages.AsNoTracking()
            .Where(p => p.IsActive && p.Id != exceptId && p.ProjectId == projectId && p.ProfessionCode == professionCode && p.NationalityCode == nationalityCode)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return same.Any(p => p.Overlaps(from, to));
    }
}
