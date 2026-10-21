using ClosedXML.Excel;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workforce.Application;

public sealed record CostPackageDto(Guid Id, string Supplier, string? ProfessionCode, string? ProfessionAr, string? ProfessionEn, string? NationalityCode, string? NationalityAr, string? NationalityEn, decimal MonthlyCost, string Method, DateOnly EffectiveFrom, string? Notes, int Workers, string UpdatedBy, DateTimeOffset UpdatedAt);

public sealed record CostInput(string? Supplier, string? ProfessionCode, string? NationalityCode, decimal MonthlyCost, string? Method, DateOnly? EffectiveFrom, string? Notes);

/// <param name="CostSource"><c>Card</c> (the worker's own), <c>Package</c> (the supplier's) or null (none yet).</param>
public sealed record SupplierWorkerDto(Guid WorkerId, string WorkerNo, string Name, string Supplier, string Placement, string? ProfessionAr, string? ProfessionEn, string? NationalityAr, string? NationalityEn, decimal? MonthlyCost, string? Method, string? CostSource, DateOnly? EffectiveFrom);

public sealed record SupplierSummaryDto(string Supplier, int Workers, int WithCost, int Missing);

public sealed record CostOverviewDto(int SupplierWorkers, int WithCard, int ByPackage, int Missing, IReadOnlyList<SupplierSummaryDto> Suppliers);

public sealed record CostCardDto(Guid Id, string Supplier, decimal MonthlyCost, string Method, DateOnly EffectiveFrom, string? Notes, string CreatedBy, DateTimeOffset CreatedAt, bool Current);

/// <param name="Source"><c>Company</c>, <c>Supplier</c> or <c>Unknown</c>, from the sponsor.</param>
public sealed record WorkerCostDto(string Source, string? Supplier, decimal? MonthlyCost, string? Method, string? CostSource, DateOnly? EffectiveFrom, CostPackageDto? Package, IReadOnlyList<CostCardDto> Cards, decimal? Salary);

public sealed record CostImportRowDto(int Row, string? WorkerNo, string? Error);

public sealed record CostOptionsDto(IReadOnlyList<string> Suppliers, IReadOnlyList<ReferenceItemInfo> Professions, IReadOnlyList<ReferenceItemInfo> Nationalities);

public sealed record CostImportDto(int Added, int Failed, IReadOnlyList<CostImportRowDto> Errors);

/// <summary>
/// What each worker of a supplier costs the company (docs/03-migration-plan/16): the suppliers' packages, the workers'
/// own cards (dated), an Excel upload of cards, and the cost on a day for the profitability.
/// </summary>
internal sealed class WorkerCostService(WorkforceDbContext db, IReferenceData referenceData, ITenantContext tenant, ICurrentUser user, IClock clock) : IWorkerCosts
{
    private static readonly DateOnly Earliest = new(2025, 1, 1);

    public static readonly Error SupplierRequired = Error.Validation("cost_supplier", "Choose one of the suppliers (not the company's registrations).");
    public static readonly Error BadCost = Error.Validation("cost_amount", "The monthly cost must be above 0 and at most 100,000.");
    public static readonly Error BadDate = Error.Validation("cost_date", "The cost applies from a date in 2025 or later.");
    public static readonly Error BadMethod = Error.Validation("cost_method", "Choose monthly fixed or by working days.");
    public static readonly Error NotSupplierWorker = Error.Validation("cost_not_supplier_worker", "This worker is not a supplier's worker.");
    public static readonly Error NotFound = Error.NotFound("cost", "Not found.");

    public async Task<CostOverviewDto> OverviewAsync(CancellationToken cancellationToken)
    {
        var rows = await WorkersAsync(null, null, null, cancellationToken).ConfigureAwait(false);
        return new CostOverviewDto(
            rows.Count, rows.Count(r => r.CostSource == "Card"), rows.Count(r => r.CostSource == "Package"), rows.Count(r => r.CostSource is null),
            rows.GroupBy(r => r.Supplier).Select(g => new SupplierSummaryDto(g.Key, g.Count(), g.Count(r => r.CostSource is not null), g.Count(r => r.CostSource is null)))
                .OrderByDescending(s => s.Workers).ToList());
    }

    /// <summary>The suppliers (the old system's sponsors other than the company's registrations) and the lists of a package.</summary>
    public async Task<CostOptionsDto> OptionsAsync(CancellationToken cancellationToken) => new(
        CrmSponsors.All.Where(s => WorkerSources.Of(s) == WorkerSource.Supplier).Order(StringComparer.Ordinal).ToList(),
        await referenceData.ListAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false),
        await referenceData.ListAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false));

    public async Task<IReadOnlyList<CostPackageDto>> PackagesAsync(CancellationToken cancellationToken)
    {
        var packages = await db.CostPackages.AsNoTracking().Where(p => p.IsActive).OrderBy(p => p.Supplier).ThenByDescending(p => p.EffectiveFrom).ToListAsync(cancellationToken).ConfigureAwait(false);
        var workers = await WorkersAsync(null, null, null, cancellationToken).ConfigureAwait(false);
        var professions = await Names(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false);
        var nationalities = await Names(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false);
        return packages.Select(p => Package(p, professions, nationalities, workers.Count(w => w.CostSource == "Package" && w.EffectiveFrom == p.EffectiveFrom && w.Supplier == p.Supplier && w.MonthlyCost == p.MonthlyCost))).ToList();
    }

    public async Task<Result<Guid>> SavePackageAsync(Guid? id, CostInput input, CancellationToken cancellationToken)
    {
        var values = await ValidateAsync(input, true, cancellationToken).ConfigureAwait(false);
        if (values.IsFailure)
        {
            return Result.Failure<Guid>(values.Error);
        }

        SupplierCostPackage? package;
        if (id is { } existing)
        {
            package = await db.CostPackages.FirstOrDefaultAsync(p => p.Id == existing && p.IsActive, cancellationToken).ConfigureAwait(false);
            if (package is null)
            {
                return Result.Failure<Guid>(NotFound);
            }

            package.Set(values.Value, user.DisplayName, clock.UtcNow);
        }
        else
        {
            package = new SupplierCostPackage(TenantId(), values.Value, user.DisplayName, clock.UtcNow);
            db.CostPackages.Add(package);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(package.Id);
    }

    public async Task<Result> DeletePackageAsync(Guid id, CancellationToken cancellationToken)
    {
        var package = await db.CostPackages.FirstOrDefaultAsync(p => p.Id == id && p.IsActive, cancellationToken).ConfigureAwait(false);
        if (package is null)
        {
            return Result.Failure(NotFound);
        }

        package.Deactivate(user.DisplayName, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>The suppliers' workers (not left the company) with what each costs today.</summary>
    public async Task<IReadOnlyList<SupplierWorkerDto>> WorkersAsync(string? supplier, bool? missing, string? search, CancellationToken cancellationToken)
    {
        var today = clock.Today;
        var workers = (await SupplierWorkersAsync(cancellationToken).ConfigureAwait(false))
            .Where(w => supplier is null || string.Equals(w.Supplier, supplier, StringComparison.OrdinalIgnoreCase)).ToList();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim();
            workers = workers.Where(w => w.WorkerNo.Contains(q, StringComparison.OrdinalIgnoreCase) || w.Name.Contains(q, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        var costs = await ResolveAsync(workers, today, cancellationToken).ConfigureAwait(false);
        var professions = await Names(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false);
        var nationalities = await Names(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false);
        return workers
            .Select(w =>
            {
                var c = costs.GetValueOrDefault(w.Id);
                var p = w.ProfessionCode is null ? default : professions.GetValueOrDefault(w.ProfessionCode);
                var n = w.NationalityCode is null ? default : nationalities.GetValueOrDefault(w.NationalityCode);
                return new SupplierWorkerDto(w.Id, w.WorkerNo, w.Name, w.Supplier, w.Placement.ToString(), p.Ar, p.En, n.Ar, n.En, c?.MonthlyCost, c?.Method.ToString(), c?.Source, c?.EffectiveFrom);
            })
            .Where(r => missing is null || (r.CostSource is null) == missing)
            .OrderBy(r => r.Supplier, StringComparer.Ordinal).ThenBy(r => r.WorkerNo, StringComparer.Ordinal)
            .ToList();
    }

    public async Task<WorkerCostDto?> WorkerAsync(Guid workerId, bool withSalary, CancellationToken cancellationToken)
    {
        var w = await db.Workers.AsNoTracking().Where(x => x.Id == workerId && x.Kind == WorkerKind.Worker)
            .Join(db.People, x => x.PersonId, p => p.Id, (x, p) => new { x.Id, x.WorkerNo, x.Sponsor, x.ProfessionCode, p.NationalityCode, x.Placement, x.Salary, Name = p.NameAr ?? p.NameEn })
            .FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (w is null)
        {
            return null;
        }

        var source = WorkerSources.Of(w.Sponsor);
        var salary = withSalary ? w.Salary.Total : (decimal?)null;
        if (source != WorkerSource.Supplier)
        {
            return new WorkerCostDto(source.ToString(), null, null, null, null, null, null, [], salary);
        }

        var today = clock.Today;
        var row = new SupplierWorker(w.Id, w.WorkerNo, w.Name, w.Sponsor!.Trim(), w.ProfessionCode, w.NationalityCode, w.Placement);
        var cost = (await ResolveAsync([row], today, cancellationToken).ConfigureAwait(false)).GetValueOrDefault(w.Id);
        var cards = await db.CostCards.AsNoTracking().Where(c => c.WorkerId == workerId && !c.IsDeleted).OrderByDescending(c => c.EffectiveFrom).ThenByDescending(c => c.CreatedAt).ToListAsync(cancellationToken).ConfigureAwait(false);
        var current = cards.FirstOrDefault(c => c.EffectiveFrom <= today);
        CostPackageDto? package = null;
        if (cost?.PackageId is { } pid && await db.CostPackages.AsNoTracking().FirstOrDefaultAsync(p => p.Id == pid, cancellationToken).ConfigureAwait(false) is { } found)
        {
            package = Package(found, await Names(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false), await Names(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false), 0);
        }

        return new WorkerCostDto(source.ToString(), row.Supplier, cost?.MonthlyCost, cost?.Method.ToString(), cost?.Source, cost?.EffectiveFrom, package,
            cards.Select(c => new CostCardDto(c.Id, c.Supplier, c.MonthlyCost, c.Method.ToString(), c.EffectiveFrom, c.Notes, c.CreatedBy, c.CreatedAt, c.Id == current?.Id)).ToList(), salary);
    }

    public async Task<Result<Guid>> AddCardAsync(Guid workerId, CostInput input, CancellationToken cancellationToken)
    {
        var worker = await db.Workers.AsNoTracking().Where(w => w.Id == workerId && w.Kind == WorkerKind.Worker).Select(w => new { w.Sponsor }).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (worker is null)
        {
            return Result.Failure<Guid>(NotFound);
        }

        if (WorkerSources.Of(worker.Sponsor) != WorkerSource.Supplier)
        {
            return Result.Failure<Guid>(NotSupplierWorker);
        }

        var values = await ValidateAsync(input with { Supplier = worker.Sponsor!.Trim(), ProfessionCode = null, NationalityCode = null }, false, cancellationToken).ConfigureAwait(false);
        if (values.IsFailure)
        {
            return Result.Failure<Guid>(values.Error);
        }

        var card = new WorkerCostCard(TenantId(), workerId, values.Value, user.DisplayName, clock.UtcNow);
        db.CostCards.Add(card);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(card.Id);
    }

    public async Task<Result> DeleteCardAsync(Guid workerId, Guid cardId, CancellationToken cancellationToken)
    {
        var card = await db.CostCards.FirstOrDefaultAsync(c => c.Id == cardId && c.WorkerId == workerId && !c.IsDeleted, cancellationToken).ConfigureAwait(false);
        if (card is null)
        {
            return Result.Failure(NotFound);
        }

        card.Delete();
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>A sheet of the suppliers' workers with their cost today, to fill and upload back.</summary>
    public async Task<byte[]> TemplateAsync(string? supplier, CancellationToken cancellationToken)
    {
        var rows = await WorkersAsync(supplier, null, null, cancellationToken).ConfigureAwait(false);
        using var book = new XLWorkbook();
        var ws = book.Worksheets.Add("تكلفة العمالة");
        ws.RightToLeft = true;
        string[] headers = ["رقم العامل", "العامل", "المورد", "التكلفة الشهرية", "طريقة الحساب (شهري / بالأيام)", "سارية من", "ملاحظات"];
        for (var c = 0; c < headers.Length; c++)
        {
            ws.Cell(1, c + 1).Value = headers[c];
        }

        for (var r = 0; r < rows.Count; r++)
        {
            var x = rows[r];
            ws.Cell(r + 2, 1).Value = x.WorkerNo;
            ws.Cell(r + 2, 2).Value = x.Name;
            ws.Cell(r + 2, 3).Value = x.Supplier;
            if (x.MonthlyCost is { } cost)
            {
                ws.Cell(r + 2, 4).Value = cost;
            }

            ws.Cell(r + 2, 5).Value = x.Method == nameof(CostMethod.ByWorkingDays) ? "بالأيام" : "شهري";
            ws.Cell(r + 2, 6).Value = (x.EffectiveFrom ?? new DateOnly(clock.Today.Year, clock.Today.Month, 1)).ToDateTime(TimeOnly.MinValue);
            ws.Cell(r + 2, 6).Style.DateFormat.Format = "yyyy/mm/dd";
        }

        var header = ws.Range(1, 1, 1, headers.Length);
        header.Style.Font.Bold = true;
        header.Style.Fill.BackgroundColor = XLColor.FromHtml("#0d4a6c");
        header.Style.Font.FontColor = XLColor.White;
        ws.SheetView.FreezeRows(1);
        ws.Columns().AdjustToContents(1, Math.Min(rows.Count + 1, 300));
        using var stream = new MemoryStream();
        book.SaveAs(stream);
        return stream.ToArray();
    }

    /// <summary>
    /// Cards from a sheet (the template, or any sheet with a worker number and a cost column): each valid row adds a card;
    /// a row equal to the worker's current card is skipped.
    /// </summary>
    public async Task<Result<CostImportDto>> ImportAsync(Stream content, CancellationToken cancellationToken)
    {
        XLWorkbook book;
        try
        {
            book = new XLWorkbook(content);
        }
        catch (Exception e) when (e is ArgumentException or InvalidDataException or FormatException or IOException)
        {
            return Result.Failure<CostImportDto>(Error.Validation("excel_file", "Upload an Excel file (.xlsx)."));
        }

        using (book)
        {
            var ws = book.Worksheets.First();
            var used = ws.RangeUsed();
            if (used is null)
            {
                return Result.Success(new CostImportDto(0, 0, []));
            }

            var last = used.LastColumn().ColumnNumber();
            int Col(params string[] names) => Enumerable.Range(1, last).FirstOrDefault(c => names.Any(n => ws.Cell(1, c).GetString().Trim().StartsWith(n, StringComparison.OrdinalIgnoreCase)));
            int no = Col("رقم العامل", "worker no", "workerno"), cost = Col("التكلفة", "cost", "monthly"), method = Col("طريقة", "method"), from = Col("سارية", "effective", "from"), notes = Col("ملاحظات", "notes");
            if (no == 0 || cost == 0)
            {
                return Result.Failure<CostImportDto>(Error.Validation("cost_sheet", "The sheet needs a worker number column and a cost column."));
            }

            var workers = (await SupplierWorkersAsync(cancellationToken).ConfigureAwait(false)).ToDictionary(w => w.WorkerNo, StringComparer.OrdinalIgnoreCase);
            var today = clock.Today;
            var current = await ResolveAsync(workers.Values.ToList(), today, cancellationToken).ConfigureAwait(false);
            var errors = new List<CostImportRowDto>();
            var added = 0;
            for (var r = 2; r <= used.LastRow().RowNumber(); r++)
            {
                var workerNo = ws.Cell(r, no).GetString().Trim();
                if (workerNo.Length == 0)
                {
                    continue;
                }

                if (!workers.TryGetValue(workerNo, out var worker))
                {
                    errors.Add(new CostImportRowDto(r, workerNo, "errors.validation_cost_not_supplier_worker"));
                    continue;
                }

                if (!ws.Cell(r, cost).TryGetValue<decimal>(out var amount) || amount <= 0 || amount > 100_000)
                {
                    errors.Add(new CostImportRowDto(r, workerNo, "errors.validation_cost_amount"));
                    continue;
                }

                var text = method == 0 ? string.Empty : ws.Cell(r, method).GetString().Trim();
                var m = text.Contains("أيام", StringComparison.Ordinal) || text.Contains("day", StringComparison.OrdinalIgnoreCase) ? CostMethod.ByWorkingDays : CostMethod.MonthlyFixed;
                var on = from != 0 && ws.Cell(r, from).TryGetValue<DateTime>(out var d) ? DateOnly.FromDateTime(d) : new DateOnly(today.Year, today.Month, 1);
                if (on < Earliest)
                {
                    errors.Add(new CostImportRowDto(r, workerNo, "errors.validation_cost_date"));
                    continue;
                }

                if (current.GetValueOrDefault(worker.Id) is { Source: "Card" } now && now.MonthlyCost == amount && now.Method == m && now.EffectiveFrom == on)
                {
                    continue;
                }

                var note = notes == 0 ? null : ws.Cell(r, notes).GetString().Trim() is { Length: > 0 } n ? n[..Math.Min(n.Length, SupplierCostPackage.NotesMaxLength)] : null;
                db.CostCards.Add(new WorkerCostCard(TenantId(), worker.Id, new CostValues(worker.Supplier, null, null, amount, m, on, note), user.DisplayName, clock.UtcNow));
                added++;
            }

            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Success(new CostImportDto(added, errors.Count, errors.Take(200).ToList()));
        }
    }

    public async Task<IReadOnlyList<WorkerCostInfo>> CostsAsync(IReadOnlyCollection<Guid> workerIds, DateOnly on, CancellationToken cancellationToken)
    {
        var ids = workerIds.Distinct().ToList();
        var workers = await db.Workers.AsNoTracking().Where(w => ids.Contains(w.Id))
            .Join(db.People, w => w.PersonId, p => p.Id, (w, p) => new { w.Id, w.WorkerNo, w.Sponsor, w.ProfessionCode, p.NationalityCode, w.Placement, w.Salary, Name = p.NameAr ?? p.NameEn })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var suppliers = workers.Where(w => WorkerSources.Of(w.Sponsor) == WorkerSource.Supplier)
            .Select(w => new SupplierWorker(w.Id, w.WorkerNo, w.Name, w.Sponsor!.Trim(), w.ProfessionCode, w.NationalityCode, w.Placement)).ToList();
        var costs = await ResolveAsync(suppliers, on, cancellationToken).ConfigureAwait(false);
        return workers.Select(w =>
            {
                var c = costs.GetValueOrDefault(w.Id);
                return new WorkerCostInfo(w.Id, WorkerSources.Of(w.Sponsor).ToString(), w.Sponsor?.Trim(), c?.MonthlyCost, c is null ? null : c.Method == CostMethod.ByWorkingDays, w.Salary.Total);
            })
            .ToList();
    }

    internal sealed record SupplierWorker(Guid Id, string WorkerNo, string Name, string Supplier, string? ProfessionCode, string? NationalityCode, Placement Placement);

    internal sealed record ResolvedCost(decimal MonthlyCost, CostMethod Method, DateOnly EffectiveFrom, string Source, Guid? PackageId);

    /// <summary>Each worker's cost on a day: the latest own card from that day, else the closest supplier package.</summary>
    private async Task<Dictionary<Guid, ResolvedCost>> ResolveAsync(List<SupplierWorker> workers, DateOnly on, CancellationToken cancellationToken)
    {
        var ids = workers.Select(w => w.Id).ToList();
        var cards = (await db.CostCards.AsNoTracking().Where(c => !c.IsDeleted && c.EffectiveFrom <= on && ids.Contains(c.WorkerId)).ToListAsync(cancellationToken).ConfigureAwait(false))
            .GroupBy(c => c.WorkerId).ToDictionary(g => g.Key, g => g.OrderByDescending(c => c.EffectiveFrom).ThenByDescending(c => c.CreatedAt).First());
        var packages = await db.CostPackages.AsNoTracking().Where(p => p.IsActive && p.EffectiveFrom <= on).ToListAsync(cancellationToken).ConfigureAwait(false);
        var result = new Dictionary<Guid, ResolvedCost>();
        foreach (var w in workers)
        {
            if (cards.TryGetValue(w.Id, out var card))
            {
                result[w.Id] = new ResolvedCost(card.MonthlyCost, card.Method, card.EffectiveFrom, "Card", null);
                continue;
            }

            var best = Best(packages, w.Supplier, w.ProfessionCode, w.NationalityCode, on);
            if (best is not null)
            {
                result[w.Id] = new ResolvedCost(best.MonthlyCost, best.Method, best.EffectiveFrom, "Package", best.Id);
            }
        }

        return result;
    }

    /// <summary>The narrowest package that fits, the latest of them.</summary>
    internal static SupplierCostPackage? Best(IEnumerable<SupplierCostPackage> packages, string supplier, string? profession, string? nationality, DateOnly on) =>
        packages.Select(p => (Package: p, Fit: p.Fit(supplier, profession, nationality, on))).Where(x => x.Fit is not null)
            .OrderByDescending(x => x.Fit).ThenByDescending(x => x.Package.EffectiveFrom).Select(x => x.Package).FirstOrDefault();

    private async Task<List<SupplierWorker>> SupplierWorkersAsync(CancellationToken cancellationToken) =>
        (await db.Workers.AsNoTracking()
            .Where(w => w.Kind == WorkerKind.Worker && !w.RemovedInCrm && w.Sponsor != null && w.Placement != Placement.Exited && w.Placement != Placement.Absconded)
            .Join(db.People, w => w.PersonId, p => p.Id, (w, p) => new { w.Id, w.WorkerNo, w.Sponsor, w.ProfessionCode, p.NationalityCode, w.Placement, Name = p.NameAr ?? p.NameEn })
            .ToListAsync(cancellationToken).ConfigureAwait(false))
        .Where(w => WorkerSources.Of(w.Sponsor) == WorkerSource.Supplier)
        .Select(w => new SupplierWorker(w.Id, w.WorkerNo, w.Name, w.Sponsor!.Trim(), w.ProfessionCode, w.NationalityCode, w.Placement))
        .ToList();

    private async Task<Result<CostValues>> ValidateAsync(CostInput input, bool package, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var supplier = input.Supplier?.Trim();
        if (string.IsNullOrEmpty(supplier) || WorkerSources.Of(supplier) != WorkerSource.Supplier || supplier.Length > 100)
        {
            return Result.Failure<CostValues>(SupplierRequired);
        }

        if (input.MonthlyCost <= 0 || input.MonthlyCost > 100_000)
        {
            return Result.Failure<CostValues>(BadCost);
        }

        if (input.EffectiveFrom is not { } from || from < Earliest)
        {
            return Result.Failure<CostValues>(BadDate);
        }

        if (!Enum.TryParse<CostMethod>(input.Method ?? nameof(CostMethod.MonthlyFixed), out var method) || !Enum.IsDefined(method))
        {
            return Result.Failure<CostValues>(BadMethod);
        }

        string? profession = null, nationality = null;
        if (package)
        {
            profession = string.IsNullOrWhiteSpace(input.ProfessionCode) ? null : input.ProfessionCode.Trim();
            nationality = string.IsNullOrWhiteSpace(input.NationalityCode) ? null : input.NationalityCode.Trim().ToUpperInvariant();
            if ((profession is not null && !await referenceData.IsValidAsync(ReferenceListCodes.Professions, profession, cancellationToken).ConfigureAwait(false))
                || (nationality is not null && !await referenceData.IsValidAsync(ReferenceListCodes.Nationalities, nationality, cancellationToken).ConfigureAwait(false)))
            {
                return Result.Failure<CostValues>(Error.Validation("cost_code", "Choose a profession and a nationality from their lists."));
            }
        }

        var notes = string.IsNullOrWhiteSpace(input.Notes) ? null : input.Notes.Trim();
        return notes?.Length > SupplierCostPackage.NotesMaxLength
            ? Result.Failure<CostValues>(Error.Validation("cost_notes", "Notes are limited to 300 characters."))
            : Result.Success(new CostValues(supplier, profession, nationality, Math.Round(input.MonthlyCost, 2), method, from, notes));
    }

    private static CostPackageDto Package(SupplierCostPackage p, Dictionary<string, (string Ar, string En)> professions, Dictionary<string, (string Ar, string En)> nationalities, int workers)
    {
        var pr = p.ProfessionCode is null ? default : professions.GetValueOrDefault(p.ProfessionCode);
        var na = p.NationalityCode is null ? default : nationalities.GetValueOrDefault(p.NationalityCode);
        return new CostPackageDto(p.Id, p.Supplier, p.ProfessionCode, pr.Ar, pr.En, p.NationalityCode, na.Ar, na.En, p.MonthlyCost, p.Method.ToString(), p.EffectiveFrom, p.Notes, workers, p.UpdatedBy, p.UpdatedAt);
    }

    private async Task<Dictionary<string, (string Ar, string En)>> Names(string list, CancellationToken cancellationToken) =>
        (await referenceData.ListAllAsync(list, cancellationToken).ConfigureAwait(false))
            .GroupBy(i => i.Code, StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => (g.First().NameAr, g.First().NameEn), StringComparer.OrdinalIgnoreCase);

    private Guid TenantId() => tenant.TenantId ?? throw new InvalidOperationException("A company must be selected.");
}
