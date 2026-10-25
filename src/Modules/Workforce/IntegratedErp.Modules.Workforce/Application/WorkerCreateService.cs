using System.Globalization;
using ClosedXML.Excel;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.Modules.Workforce.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workforce.Application;

/// <summary>
/// One new worker, as the form or a sheet row gives it. The nationality, the professions and the supplier may be a code
/// or a name (a sheet's text is matched to the lists); everything is checked before anything is created.
/// </summary>
public sealed record NewWorkerInput(
    string? NameEn,
    string? NameAr,
    string? Nationality,
    string? Profession,
    string? IqamaProfession,
    string? Sponsor,
    string? Iqama,
    DateOnly? IqamaExpiresOn,
    string? BorderNumber,
    string? Passport,
    DateOnly? ArrivedOn,
    string? RecruitmentAgent,
    decimal? Basic,
    decimal? Housing,
    decimal? Food,
    decimal? Transport,
    decimal? Other,
    decimal? SupplierMonthlyCost,
    string? CostMethod);

/// <summary>A problem of a row: the field and a code the page shows in words (workforce.create.issues.*).</summary>
public sealed record RowIssue(string Field, string Code);

/// <summary>A checked row: the input with its lists resolved to codes (or left as typed), and what is wrong with it.</summary>
public sealed record CheckedRow(int Row, NewWorkerInput Input, bool IsSupplier, IReadOnlyList<RowIssue> Issues);

public sealed record CreateOptionDto(string Code, string NameAr, string NameEn);

/// <summary>What the form and the sheet pick from.</summary>
public sealed record CreateOptionsDto(IReadOnlyList<CreateOptionDto> Nationalities, IReadOnlyList<CreateOptionDto> Professions, IReadOnlyList<string> Sponsors, string NextNumber);

public sealed record CreatedWorkerDto(Guid Id, string WorkerNo, string Name);

/// <summary>The result of creating: the workers, or the rows to fix (nothing is created then).</summary>
public sealed record CreateResultDto(IReadOnlyList<CreatedWorkerDto> Created, IReadOnlyList<CheckedRow> Rows);

/// <summary>
/// Adding workers here (the user's request, 2026-10-25), one by one or from a sheet: the sheet is read and checked
/// first, the page shows each wrong value to fix (or the corrected sheet is read again), and only a clean set is
/// created, all of it or none. Required: the English name, the nationality, the profession, the supplier (sponsor), the
/// iqama or border number, the arrival date, and the supplier's monthly cost for a worker not on the company's
/// sponsorship. Numbers follow the old system's series (BSS…), after the highest one already used.
/// </summary>
internal sealed class WorkerCreateService(
    WorkforceDbContext db,
    IReferenceData reference,
    NumberSequenceService numbering,
    ITenantContext tenant,
    ICurrentUser user,
    IClock clock)
{
    public const int MaxRows = 500;
    private const decimal MaxCost = 100_000;

    // The sheet's columns, in order (the template writes them; reading matches them by header, so a moved column still reads).
    private static readonly (string Key, string Header)[] Columns =
    [
        ("nameEn", "الاسم بالإنجليزية *"),
        ("nameAr", "الاسم بالعربية"),
        ("nationality", "الجنسية *"),
        ("profession", "المهنة *"),
        ("iqamaProfession", "المهنة في الإقامة"),
        ("sponsor", "المورد / الكفيل *"),
        ("iqama", "رقم الإقامة"),
        ("iqamaExpiresOn", "انتهاء الإقامة"),
        ("borderNumber", "رقم الحدود"),
        ("passport", "رقم الجواز"),
        ("arrivedOn", "تاريخ الوصول *"),
        ("agent", "وكيل الاستقدام"),
        ("basic", "الراتب الأساسي"),
        ("housing", "بدل السكن"),
        ("food", "بدل الطعام"),
        ("transport", "بدل المواصلات"),
        ("other", "بدلات أخرى"),
        ("cost", "تكلفة المورد الشهرية"),
        ("method", "طريقة حساب التكلفة (شهري / بالأيام)"),
    ];

    public async Task<CreateOptionsDto> OptionsAsync(CancellationToken cancellationToken)
    {
        var lists = await ListsAsync(cancellationToken).ConfigureAwait(false);
        return new CreateOptionsDto(
            lists.Nationalities.Select(i => new CreateOptionDto(i.Code, i.NameAr, i.NameEn)).ToList(),
            lists.Professions.Select(i => new CreateOptionDto(i.Code, i.NameAr, i.NameEn)).ToList(),
            Sponsors(),
            await PeekNumberAsync(cancellationToken).ConfigureAwait(false));
    }

    /// <summary>Checks rows without creating anything (the form's «check», and the sheet's preview after a fix).</summary>
    public async Task<IReadOnlyList<CheckedRow>> CheckAsync(IReadOnlyList<NewWorkerInput> rows, CancellationToken cancellationToken)
    {
        var lists = await ListsAsync(cancellationToken).ConfigureAwait(false);
        var numbers = rows.SelectMany(r => new[] { Clean(r.Iqama), Clean(r.BorderNumber), Clean(r.Passport) }).OfType<string>().Distinct().ToList();
        var taken = await db.Identifiers.AsNoTracking().Where(i => i.IsCurrent && numbers.Contains(i.Number)).Select(i => new { i.Type, i.Number })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var used = taken.Select(t => (t.Type, t.Number)).ToHashSet();
        return rows.Select((r, i) => Check(i + 1, r, lists, used, rows)).ToList();
    }

    /// <summary>Reads a sheet (the template, or any sheet with its headers) and checks it; nothing is created.</summary>
    public async Task<Result<IReadOnlyList<CheckedRow>>> ReadAsync(Stream content, CancellationToken cancellationToken)
    {
        XLWorkbook book;
        try
        {
            book = new XLWorkbook(content);
        }
        catch (Exception ex) when (ex is InvalidDataException or ArgumentException or FormatException or IOException or InvalidOperationException)
        {
            return Result.Failure<IReadOnlyList<CheckedRow>>(WorkforceErrors.Sheet);
        }

        using (book)
        {
            var ws = book.Worksheets.First();
            var header = ws.Row(1);
            var at = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var cell in header.CellsUsed())
            {
                var text = cell.GetString().Trim();
                var match = Columns.FirstOrDefault(c => string.Equals(Plain(c.Header), Plain(text), StringComparison.OrdinalIgnoreCase));
                if (match.Key is not null)
                {
                    at.TryAdd(match.Key, cell.Address.ColumnNumber);
                }
            }

            if (!at.ContainsKey("nameEn"))
            {
                return Result.Failure<IReadOnlyList<CheckedRow>>(WorkforceErrors.Sheet);
            }

            var rows = new List<NewWorkerInput>();
            var last = ws.LastRowUsed()?.RowNumber() ?? 1;
            for (var r = 2; r <= last; r++)
            {
                var row = ws.Row(r);
                string? S(string key) => at.TryGetValue(key, out var c) ? Clean(row.Cell(c).GetFormattedString()) : null;
                DateOnly? D(string key) => at.TryGetValue(key, out var c) ? DateOf(row.Cell(c)) : null;
                decimal? M(string key) => at.TryGetValue(key, out var c) ? NumberOf(row.Cell(c)) : null;
                var input = new NewWorkerInput(
                    S("nameEn"), S("nameAr"), S("nationality"), S("profession"), S("iqamaProfession"), S("sponsor"), S("iqama"), D("iqamaExpiresOn"),
                    S("borderNumber"), S("passport"), D("arrivedOn"), S("agent"), M("basic"), M("housing"), M("food"), M("transport"), M("other"), M("cost"), Method(S("method")));
                if (input.NameEn is null && input.Nationality is null && input.Iqama is null && input.BorderNumber is null && input.Sponsor is null)
                {
                    continue; // an empty row
                }

                rows.Add(input);
                if (rows.Count > MaxRows)
                {
                    return Result.Failure<IReadOnlyList<CheckedRow>>(WorkforceErrors.TooManyRows);
                }
            }

            return rows.Count == 0
                ? Result.Failure<IReadOnlyList<CheckedRow>>(WorkforceErrors.Sheet)
                : Result.Success(await CheckAsync(rows, cancellationToken).ConfigureAwait(false));
        }
    }

    /// <summary>Creates the workers when every row is clean (all of them or none); otherwise returns the rows to fix.</summary>
    public async Task<Result<CreateResultDto>> CreateAsync(IReadOnlyList<NewWorkerInput> rows, CancellationToken cancellationToken)
    {
        if (rows.Count is 0 or > MaxRows)
        {
            return Result.Failure<CreateResultDto>(WorkforceErrors.TooManyRows);
        }

        var checkedRows = await CheckAsync(rows, cancellationToken).ConfigureAwait(false);
        if (checkedRows.Any(r => r.Issues.Count > 0))
        {
            return Result.Success(new CreateResultDto([], checkedRows));
        }

        var tenantId = tenant.TenantId ?? throw new InvalidOperationException("A company must be selected.");
        var created = new List<CreatedWorkerDto>();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var minimum = await HighestNumberAsync(cancellationToken).ConfigureAwait(false) + 1;
        var existing = (await db.Workers.Select(w => w.WorkerNo).ToListAsync(cancellationToken).ConfigureAwait(false)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var row in checkedRows)
        {
            var x = row.Input;
            string number;
            do
            {
                number = await numbering.NextNumberAsync(db, WorkforceModule.WorkerSequence, clock.Today, cancellationToken, minimum).ConfigureAwait(false);
            }
            while (!existing.Add(number));

            var person = new Person(x.NameEn!, x.NameAr);
            person.Edit(x.NameEn!, x.NameAr, x.Nationality);
            person.SetIdentifier(IdentifierType.Iqama, x.Iqama, x.IqamaExpiresOn, usable: true);
            person.SetIdentifier(IdentifierType.BorderNumber, x.BorderNumber, null, usable: true);
            person.SetIdentifier(IdentifierType.Passport, x.Passport, null, usable: true);
            db.People.Add(person);

            var salary = Worker.Totalled(new Salary(x.Basic ?? 0, x.Housing ?? 0, x.Food ?? 0, x.Transport ?? 0, 0, x.Other ?? 0, 0, 0, 0));
            var worker = Worker.CreateHere(person.Id, new WorkerSnapshot(
                number, WorkerKind.Worker, null, x.Profession, null, x.IqamaProfession, CrmStatus: 1, x.Sponsor, x.RecruitmentAgent,
                null, null, null, x.ArrivedOn, salary, new ContractTerms(null, null, null), new LeaveBalance(null, null, null, null, null), clock.UtcNow));
            db.Workers.Add(worker);

            if (row.IsSupplier)
            {
                var method = Enum.TryParse<CostMethod>(x.CostMethod, out var m) ? m : CostMethod.MonthlyFixed;
                var from = x.ArrivedOn is { } arrived && arrived > CostEarliest ? arrived : CostEarliest;
                db.CostCards.Add(new WorkerCostCard(tenantId, worker.Id, new CostValues(x.Sponsor!, null, null, Math.Round(x.SupplierMonthlyCost!.Value, 2), method, from, null), user.DisplayName, clock.UtcNow));
            }

            created.Add(new CreatedWorkerDto(worker.Id, number, x.NameEn!));
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(new CreateResultDto(created, checkedRows));
    }

    /// <summary>The sheet to fill: the columns, an example-free header, and drop-down lists for the nationality, professions, supplier and method.</summary>
    public async Task<byte[]> TemplateAsync(CancellationToken cancellationToken)
    {
        var lists = await ListsAsync(cancellationToken).ConfigureAwait(false);
        using var book = new XLWorkbook();
        var ws = book.Worksheets.Add("عمالة جديدة");
        ws.RightToLeft = true;
        var values = book.Worksheets.Add("القوائم");
        values.RightToLeft = true;
        string[] nationalities = [.. lists.Nationalities.Select(n => n.NameAr)];
        string[] professions = [.. lists.Professions.Select(p => p.NameAr)];
        string[] sponsors = [.. Sponsors()];
        string[] methods = ["شهري", "بالأيام"];
        var list = 1;
        string Range(string title, string[] items)
        {
            values.Cell(1, list).Value = title;
            for (var i = 0; i < items.Length; i++)
            {
                values.Cell(i + 2, list).Value = items[i];
            }

            var letter = XLHelper.GetColumnLetterFromNumber(list++);
            return $"'القوائم'!${letter}$2:${letter}${Math.Max(2, items.Length + 1)}";
        }

        var lookups = new Dictionary<string, string>
        {
            ["nationality"] = Range("الجنسيات", nationalities),
            ["profession"] = Range("المهن", professions),
            ["iqamaProfession"] = Range("المهن", professions),
            ["sponsor"] = Range("الموردون", sponsors),
            ["method"] = Range("طريقة الحساب", methods),
        };
        values.Columns().AdjustToContents();
        values.Hide();

        for (var c = 0; c < Columns.Length; c++)
        {
            var (key, header) = Columns[c];
            ws.Cell(1, c + 1).Value = header;
            var body = ws.Range(2, c + 1, MaxRows + 1, c + 1);
            if (lookups.TryGetValue(key, out var source))
            {
                var rule = body.CreateDataValidation();
                rule.List(source, true);
                rule.ErrorTitle = "قيمة غير موجودة";
                rule.ErrorMessage = "اختر من القائمة.";
            }
            else if (key is "iqamaExpiresOn" or "arrivedOn")
            {
                body.Style.DateFormat.Format = "yyyy/mm/dd";
            }
            else if (key is "iqama" or "borderNumber" or "passport")
            {
                body.Style.NumberFormat.Format = "@"; // kept as text: no lost leading zeros or 1E+09
            }
        }

        var head = ws.Range(1, 1, 1, Columns.Length);
        head.Style.Font.Bold = true;
        head.Style.Fill.BackgroundColor = XLColor.FromHtml("#14263D");
        head.Style.Font.FontColor = XLColor.White;
        head.Style.Alignment.WrapText = true;
        ws.Row(1).Height = 32;
        ws.SheetView.FreezeRows(1);
        ws.Columns().Width = 18;
        using var stream = new MemoryStream();
        book.SaveAs(stream);
        return stream.ToArray();
    }

    private CheckedRow Check(int index, NewWorkerInput r, Lists lists, HashSet<(IdentifierType, string)> used, IReadOnlyList<NewWorkerInput> all)
    {
        var issues = new List<RowIssue>();
        void Issue(string field, string code) => issues.Add(new RowIssue(field, code));

        var nameEn = Clean(r.NameEn);
        if (nameEn is null)
        {
            Issue("nameEn", "required");
        }
        else if (nameEn.Length > Person.NameMaxLength)
        {
            Issue("nameEn", "too_long");
        }

        var nameAr = Clean(r.NameAr);
        if (nameAr?.Length > Person.NameMaxLength)
        {
            Issue("nameAr", "too_long");
        }

        string? Pick(string field, string? value, IReadOnlyList<ReferenceItemInfo> items, bool required)
        {
            var text = Clean(value);
            if (text is null)
            {
                if (required)
                {
                    Issue(field, "required");
                }

                return null;
            }

            var found = items.FirstOrDefault(i => Same(i.Code, text) || Same(i.NameAr, text) || Same(i.NameEn, text));
            if (found is null)
            {
                Issue(field, "unknown");
                return text;
            }

            return found.Code;
        }

        var nationality = Pick("nationality", r.Nationality, lists.Nationalities, true);
        var profession = Pick("profession", r.Profession, lists.Professions, true);
        var iqamaProfession = Pick("iqamaProfession", r.IqamaProfession, lists.Professions, false);

        var sponsorText = Clean(r.Sponsor);
        var sponsor = sponsorText is null ? null : Sponsors().FirstOrDefault(s => Same(s, sponsorText));
        if (sponsorText is null)
        {
            Issue("sponsor", "required");
        }
        else if (sponsor is null)
        {
            Issue("sponsor", "unknown");
        }

        var iqama = Clean(r.Iqama)?.ToUpperInvariant();
        var border = Clean(r.BorderNumber)?.ToUpperInvariant();
        var passport = Clean(r.Passport)?.ToUpperInvariant();
        if (iqama is null && border is null)
        {
            Issue("iqama", "identity_required");
        }

        void Identity(string field, IdentifierType type, string? number, Func<NewWorkerInput, string?> of)
        {
            if (number is null)
            {
                return;
            }

            if (number.Length > 50)
            {
                Issue(field, "too_long");
            }
            else if (used.Contains((type, number)))
            {
                Issue(field, "taken");
            }
            else if (all.Count(x => string.Equals(Clean(of(x))?.ToUpperInvariant(), number, StringComparison.Ordinal)) > 1)
            {
                Issue(field, "duplicate");
            }
        }

        Identity("iqama", IdentifierType.Iqama, iqama, x => x.Iqama);
        Identity("borderNumber", IdentifierType.BorderNumber, border, x => x.BorderNumber);
        Identity("passport", IdentifierType.Passport, passport, x => x.Passport);

        if (r.ArrivedOn is not { } arrived)
        {
            Issue("arrivedOn", "required");
        }
        else if (arrived > clock.Today)
        {
            Issue("arrivedOn", "future");
        }

        foreach (var (field, value) in new[] { ("basic", r.Basic), ("housing", r.Housing), ("food", r.Food), ("transport", r.Transport), ("other", r.Other) })
        {
            if (value is < 0 or > MaxCost)
            {
                Issue(field, "amount");
            }
        }

        var isSupplier = sponsor is not null && WorkerSources.Of(sponsor) == WorkerSource.Supplier;
        if (isSupplier && r.SupplierMonthlyCost is not (> 0 and <= MaxCost))
        {
            Issue("cost", r.SupplierMonthlyCost is null ? "cost_required" : "amount");
        }

        var agent = Clean(r.RecruitmentAgent);
        if (agent?.Length > 200)
        {
            Issue("agent", "too_long");
        }

        var input = new NewWorkerInput(
            nameEn, nameAr, nationality, profession, iqamaProfession, sponsor ?? sponsorText, iqama, r.IqamaExpiresOn, border, passport, r.ArrivedOn, agent,
            r.Basic, r.Housing, r.Food, r.Transport, r.Other, isSupplier ? r.SupplierMonthlyCost : null, isSupplier ? Method(r.CostMethod) ?? nameof(CostMethod.MonthlyFixed) : null);
        return new CheckedRow(index, input, isSupplier, issues);
    }

    private static readonly DateOnly CostEarliest = new(2025, 1, 1);

    private static List<string> Sponsors() => [.. CrmSponsors.All.Order(StringComparer.OrdinalIgnoreCase)];

    private async Task<Lists> ListsAsync(CancellationToken cancellationToken) =>
        new(await reference.ListAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false),
            await reference.ListAsync(ReferenceListCodes.Professions, cancellationToken).ConfigureAwait(false));

    /// <summary>The highest number of the BSS series already used (the old system's or one given here).</summary>
    private async Task<long> HighestNumberAsync(CancellationToken cancellationToken)
    {
        var numbers = await db.Workers.Where(w => w.WorkerNo.StartsWith("BSS")).Select(w => w.WorkerNo).ToListAsync(cancellationToken).ConfigureAwait(false);
        return numbers.Select(n => long.TryParse(n.AsSpan(3), NumberStyles.None, CultureInfo.InvariantCulture, out var v) ? v : 0).DefaultIfEmpty(0).Max();
    }

    /// <summary>The number the next new worker should get (shown in the form; the save takes the real one).</summary>
    private async Task<string> PeekNumberAsync(CancellationToken cancellationToken) =>
        $"BSS{(await HighestNumberAsync(cancellationToken).ConfigureAwait(false)) + 1:000000}";

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string Plain(string value) => value.Replace("*", string.Empty, StringComparison.Ordinal).Replace(" ", string.Empty, StringComparison.Ordinal).Trim();

    private static bool Same(string? a, string b) =>
        a is not null && string.Equals(Plain(a).Replace("-", string.Empty, StringComparison.Ordinal), Plain(b).Replace("-", string.Empty, StringComparison.Ordinal), StringComparison.OrdinalIgnoreCase);

    private static string? Method(string? value) => Clean(value) switch
    {
        null => null,
        "بالأيام" or "بالايام" or "أيام" or "ايام" => nameof(CostMethod.ByWorkingDays),
        var v when string.Equals(v, nameof(CostMethod.ByWorkingDays), StringComparison.OrdinalIgnoreCase) => nameof(CostMethod.ByWorkingDays),
        _ => nameof(CostMethod.MonthlyFixed),
    };

    private static DateOnly? DateOf(IXLCell cell)
    {
        if (cell.IsEmpty())
        {
            return null;
        }

        if (cell.DataType == XLDataType.DateTime)
        {
            return DateOnly.FromDateTime(cell.GetDateTime());
        }

        if (cell.DataType == XLDataType.Number && cell.GetDouble() is > 20000 and < 80000)
        {
            return DateOnly.FromDateTime(DateTime.FromOADate(cell.GetDouble()));
        }

        var text = cell.GetString().Trim();
        string[] formats = ["yyyy/MM/dd", "yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy", "yyyy/M/d"];
        return DateOnly.TryParseExact(text, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;
    }

    private static decimal? NumberOf(IXLCell cell)
    {
        if (cell.IsEmpty())
        {
            return null;
        }

        if (cell.DataType == XLDataType.Number)
        {
            return (decimal)cell.GetDouble();
        }

        return decimal.TryParse(cell.GetString().Replace(",", string.Empty, StringComparison.Ordinal), NumberStyles.Number, CultureInfo.InvariantCulture, out var v) ? v : -1;
    }

    private sealed record Lists(IReadOnlyList<ReferenceItemInfo> Nationalities, IReadOnlyList<ReferenceItemInfo> Professions);
}
