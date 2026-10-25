using System.Globalization;
using ClosedXML.Excel;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Staff.Domain;
using IntegratedErp.Modules.Staff.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Staff.Application;

/// <summary>
/// One new employee, as the form or a sheet row gives it. The nationality, the registration, the department and the
/// position may be an id or code (the form) or a name (a sheet's text, matched to the lists).
/// </summary>
public sealed record NewEmployeeInput(
    string? NameEn,
    string? NameAr,
    string? Nationality,
    string? IdNumber,
    DateOnly? HireDate,
    int? ProbationDays,
    string? LegalEntity,
    string? Department,
    string? Position,
    decimal? Basic,
    decimal? Housing,
    decimal? Food,
    decimal? Transport,
    decimal? Mobile,
    decimal? Project,
    decimal? Other,
    string? MobileNumber,
    string? Email);

public sealed record EmployeeRowIssue(string Field, string Code);

/// <summary>A checked row: the lists resolved to ids and codes (or left as typed), and what is wrong with it.</summary>
public sealed record CheckedEmployeeRow(int Row, NewEmployeeInput Input, IReadOnlyList<EmployeeRowIssue> Issues);

public sealed record NewPositionOption(Guid Id, string JobTitleAr, string JobTitleEn, int Free);

public sealed record NewDepartmentOption(Guid Id, string NameAr, string NameEn, IReadOnlyList<NewPositionOption> Positions);

public sealed record NewNamedOption(string Id, string NameAr, string NameEn);

public sealed record NewEmployeeOptionsDto(
    IReadOnlyList<NewNamedOption> Nationalities,
    IReadOnlyList<NewNamedOption> LegalEntities,
    IReadOnlyList<NewDepartmentOption> Departments,
    string NextNumber);

public sealed record CreatedEmployeeDto(Guid Id, string EmployeeNo, string Name);

public sealed record CreateEmployeesResultDto(IReadOnlyList<CreatedEmployeeDto> Created, IReadOnlyList<CheckedEmployeeRow> Rows);

/// <summary>
/// Adding employees (the user's request, 2026-10-25), one by one or from a sheet, like the workers but with an employee's
/// data: no sponsor and no border number; what matters is the job (department and position), the nationality and the
/// salary. Required: the name, the nationality, the hire date, the commercial registration, the department, the position
/// (with a free seat) and the basic salary. A sheet is checked first; only a clean set is created, all of it or none.
/// </summary>
internal sealed class StaffCreateService(
    StaffDbContext db,
    IReferenceData reference,
    ILegalEntityDirectory legalEntities,
    NumberSequenceService numbering,
    ICurrentUser user,
    IClock clock)
{
    public const int MaxRows = 500;
    private const decimal MaxAmount = 1_000_000;

    private static readonly (string Key, string Header)[] Columns =
    [
        ("nameEn", "الاسم بالإنجليزية *"),
        ("nameAr", "الاسم بالعربية"),
        ("nationality", "الجنسية *"),
        ("idNumber", "رقم الهوية / الإقامة"),
        ("hireDate", "تاريخ التعيين *"),
        ("probationDays", "أيام التجربة"),
        ("legalEntity", "السجل التجاري *"),
        ("department", "الإدارة *"),
        ("position", "الوظيفة (المسمى) *"),
        ("basic", "الراتب الأساسي *"),
        ("housing", "بدل السكن"),
        ("food", "بدل الطعام"),
        ("transport", "بدل المواصلات"),
        ("mobile", "بدل الجوال"),
        ("project", "بدل ثابت / مشروع"),
        ("other", "بدلات أخرى"),
        ("mobileNumber", "الجوال"),
        ("email", "البريد الإلكتروني"),
    ];

    public async Task<NewEmployeeOptionsDto> OptionsAsync(CancellationToken cancellationToken)
    {
        var lists = await ListsAsync(cancellationToken).ConfigureAwait(false);
        return new NewEmployeeOptionsDto(
            lists.Nationalities.Select(n => new NewNamedOption(n.Code, n.NameAr, n.NameEn)).ToList(),
            lists.Entities.Select(e => new NewNamedOption(e.Id.ToString(), e.NameAr, e.NameEn)).ToList(),
            lists.Departments.Select(d => new NewDepartmentOption(d.Id, d.NameAr, d.NameEn, lists.Positions.Where(p => p.DepartmentId == d.Id)
                .Select(p => new NewPositionOption(p.Id, p.JobTitleAr, p.JobTitleEn, p.Free)).ToList())).ToList(),
            await PeekNumberAsync(cancellationToken).ConfigureAwait(false));
    }

    public async Task<IReadOnlyList<CheckedEmployeeRow>> CheckAsync(IReadOnlyList<NewEmployeeInput> rows, CancellationToken cancellationToken)
    {
        var lists = await ListsAsync(cancellationToken).ConfigureAwait(false);
        var ids = rows.Select(r => Clean(r.IdNumber)?.ToUpperInvariant()).OfType<string>().Distinct().ToList();
        var taken = (await db.Employees.AsNoTracking().Where(e => e.IdNumber != null && ids.Contains(e.IdNumber) && e.Status != StaffStatus.Left)
            .Select(e => e.IdNumber!).ToListAsync(cancellationToken).ConfigureAwait(false)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var seats = lists.Positions.ToDictionary(p => p.Id, p => p.Free);
        var checkedRows = new List<CheckedEmployeeRow>();
        for (var i = 0; i < rows.Count; i++)
        {
            checkedRows.Add(Check(i + 1, rows[i], lists, taken, rows, seats));
        }

        return checkedRows;
    }

    public async Task<Result<IReadOnlyList<CheckedEmployeeRow>>> ReadAsync(Stream content, CancellationToken cancellationToken)
    {
        XLWorkbook book;
        try
        {
            book = new XLWorkbook(content);
        }
        catch (Exception ex) when (ex is InvalidDataException or ArgumentException or FormatException or IOException or InvalidOperationException)
        {
            return Result.Failure<IReadOnlyList<CheckedEmployeeRow>>(StaffErrors.Sheet);
        }

        using (book)
        {
            var ws = book.Worksheets.First();
            var at = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var cell in ws.Row(1).CellsUsed())
            {
                var match = Columns.FirstOrDefault(c => string.Equals(Plain(c.Header), Plain(cell.GetString()), StringComparison.OrdinalIgnoreCase));
                if (match.Key is not null)
                {
                    at.TryAdd(match.Key, cell.Address.ColumnNumber);
                }
            }

            if (!at.ContainsKey("nameEn") && !at.ContainsKey("nameAr"))
            {
                return Result.Failure<IReadOnlyList<CheckedEmployeeRow>>(StaffErrors.Sheet);
            }

            var rows = new List<NewEmployeeInput>();
            var last = ws.LastRowUsed()?.RowNumber() ?? 1;
            for (var r = 2; r <= last; r++)
            {
                var row = ws.Row(r);
                string? S(string key) => at.TryGetValue(key, out var c) ? Clean(row.Cell(c).GetFormattedString()) : null;
                DateOnly? D(string key) => at.TryGetValue(key, out var c) ? DateOf(row.Cell(c)) : null;
                decimal? M(string key) => at.TryGetValue(key, out var c) ? NumberOf(row.Cell(c)) : null;
                var input = new NewEmployeeInput(
                    S("nameEn"), S("nameAr"), S("nationality"), S("idNumber"), D("hireDate"), M("probationDays") is { } p ? (int)p : null, S("legalEntity"),
                    S("department"), S("position"), M("basic"), M("housing"), M("food"), M("transport"), M("mobile"), M("project"), M("other"), S("mobileNumber"), S("email"));
                if (input.NameEn is null && input.NameAr is null && input.Department is null && input.Position is null)
                {
                    continue;
                }

                rows.Add(input);
                if (rows.Count > MaxRows)
                {
                    return Result.Failure<IReadOnlyList<CheckedEmployeeRow>>(StaffErrors.TooManyRows);
                }
            }

            return rows.Count == 0
                ? Result.Failure<IReadOnlyList<CheckedEmployeeRow>>(StaffErrors.Sheet)
                : Result.Success(await CheckAsync(rows, cancellationToken).ConfigureAwait(false));
        }
    }

    public async Task<Result<CreateEmployeesResultDto>> CreateAsync(IReadOnlyList<NewEmployeeInput> rows, CancellationToken cancellationToken)
    {
        if (rows.Count is 0 or > MaxRows)
        {
            return Result.Failure<CreateEmployeesResultDto>(StaffErrors.TooManyRows);
        }

        var checkedRows = await CheckAsync(rows, cancellationToken).ConfigureAwait(false);
        if (checkedRows.Any(r => r.Issues.Count > 0))
        {
            return Result.Success(new CreateEmployeesResultDto([], checkedRows));
        }

        var nationalities = (await reference.ListAllAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false)).ToDictionary(n => n.Code, StringComparer.OrdinalIgnoreCase);
        var created = new List<CreatedEmployeeDto>();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var existing = (await db.Employees.Select(e => e.EmployeeNo).ToListAsync(cancellationToken).ConfigureAwait(false)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var row in checkedRows)
        {
            var x = row.Input;
            var hired = x.HireDate!.Value;
            string number;
            do
            {
                number = await numbering.NextNumberAsync(db, "staff", hired, cancellationToken).ConfigureAwait(false);
            }
            while (!existing.Add(number));

            var nameEn = x.NameEn ?? x.NameAr!;
            var employee = StaffEmployee.Hire(number, x.NameAr, nameEn, hired, x.ProbationDays ?? 90, user.DisplayName, clock.UtcNow);
            employee.SetJob(Guid.Parse(x.LegalEntity!), null, Guid.Parse(x.Department!), Guid.Parse(x.Position!), hired, employee.ProbationEndsOn, employee.Status);
            var nationality = nationalities[x.Nationality!];
            employee.SetPersonal(x.NameAr, nameEn, x.IdNumber, nationality.Code, nationality.NameAr, nationality.NameEn, null, x.MobileNumber, x.Email, null);
            db.Employees.Add(employee);
            var salary = StaffSalary.Create(employee.Id, hired, new SalaryValues(x.Basic ?? 0, x.Housing ?? 0, x.Food ?? 0, x.Transport ?? 0, x.Mobile ?? 0, x.Project ?? 0, x.Other ?? 0), SalarySource.Hire, null, user.DisplayName, clock.UtcNow);
            db.Salaries.Add(salary.Value);
            created.Add(new CreatedEmployeeDto(employee.Id, number, nameEn));
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(new CreateEmployeesResultDto(created, checkedRows));
    }

    /// <summary>The sheet to fill, with drop-down lists for the nationality, the registration, the department and the position.</summary>
    public async Task<byte[]> TemplateAsync(CancellationToken cancellationToken)
    {
        var lists = await ListsAsync(cancellationToken).ConfigureAwait(false);
        using var book = new XLWorkbook();
        var ws = book.Worksheets.Add("موظفون جدد");
        ws.RightToLeft = true;
        var values = book.Worksheets.Add("القوائم");
        values.RightToLeft = true;
        var list = 1;
        string Range(string title, IReadOnlyList<string> items)
        {
            values.Cell(1, list).Value = title;
            for (var i = 0; i < items.Count; i++)
            {
                values.Cell(i + 2, list).Value = items[i];
            }

            var letter = XLHelper.GetColumnLetterFromNumber(list++);
            return $"'القوائم'!${letter}$2:${letter}${Math.Max(2, items.Count + 1)}";
        }

        var lookups = new Dictionary<string, string>
        {
            ["nationality"] = Range("الجنسيات", [.. lists.Nationalities.Select(n => n.NameAr)]),
            ["legalEntity"] = Range("السجلات التجارية", [.. lists.Entities.Select(e => e.NameAr)]),
            ["department"] = Range("الإدارات", [.. lists.Departments.Select(d => d.NameAr)]),
            ["position"] = Range("الوظائف", [.. lists.Positions.Select(p => p.JobTitleAr).Distinct()]),
        };

        // Which positions each department has (for those who fill the sheet).
        values.Cell(1, list).Value = "الإدارة";
        values.Cell(1, list + 1).Value = "وظائفها (المقاعد الشاغرة)";
        var r = 2;
        foreach (var d in lists.Departments)
        {
            foreach (var p in lists.Positions.Where(p => p.DepartmentId == d.Id))
            {
                values.Cell(r, list).Value = d.NameAr;
                values.Cell(r, list + 1).Value = $"{p.JobTitleAr} ({p.Free})";
                r++;
            }
        }

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
            else if (key == "hireDate")
            {
                body.Style.DateFormat.Format = "yyyy/mm/dd";
            }
            else if (key is "idNumber" or "mobileNumber")
            {
                body.Style.NumberFormat.Format = "@";
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

    private static CheckedEmployeeRow Check(int index, NewEmployeeInput r, Lists lists, HashSet<string> taken, IReadOnlyList<NewEmployeeInput> all, Dictionary<Guid, int> seats)
    {
        var issues = new List<EmployeeRowIssue>();
        void Issue(string field, string code) => issues.Add(new EmployeeRowIssue(field, code));

        var nameEn = Clean(r.NameEn);
        var nameAr = Clean(r.NameAr);
        if (nameEn is null && nameAr is null)
        {
            Issue("nameEn", "required");
        }
        else if (nameEn?.Length > 300 || nameAr?.Length > 300)
        {
            Issue(nameEn?.Length > 300 ? "nameEn" : "nameAr", "too_long");
        }

        string? Pick(string field, string? value, IEnumerable<(string Id, string Ar, string En, string? Code)> items)
        {
            var text = Clean(value);
            if (text is null)
            {
                Issue(field, "required");
                return null;
            }

            var found = items.FirstOrDefault(i => Same(i.Id, text) || Same(i.Ar, text) || Same(i.En, text) || (i.Code is not null && Same(i.Code, text)));
            if (found.Id is null)
            {
                Issue(field, "unknown");
                return text;
            }

            return found.Id;
        }

        var nationality = Pick("nationality", r.Nationality, lists.Nationalities.Select(n => (n.Code, n.NameAr, n.NameEn, (string?)null)));
        var entity = Pick("legalEntity", r.LegalEntity, lists.Entities.Select(e => (e.Id.ToString(), e.NameAr, e.NameEn, (string?)e.Code)));
        var department = Pick("department", r.Department, lists.Departments.Select(d => (d.Id.ToString(), d.NameAr, d.NameEn, (string?)null)));

        // The position: one of the department's, matched by its id or its job title; it needs a free seat.
        string? position = Clean(r.Position);
        if (position is null)
        {
            Issue("position", "required");
        }
        else if (department is not null && Guid.TryParse(department, out var departmentId))
        {
            var match = lists.Positions.FirstOrDefault(p => p.DepartmentId == departmentId && (Same(p.Id.ToString(), position) || Same(p.JobTitleAr, position) || Same(p.JobTitleEn, position)));
            if (match is null)
            {
                Issue("position", lists.Positions.Any(p => Same(p.Id.ToString(), position) || Same(p.JobTitleAr, position) || Same(p.JobTitleEn, position)) ? "other_department" : "unknown");
            }
            else if (seats[match.Id] <= 0)
            {
                Issue("position", "full");
                position = match.Id.ToString();
            }
            else
            {
                seats[match.Id]--;
                position = match.Id.ToString();
            }
        }

        var idNumber = Clean(r.IdNumber)?.ToUpperInvariant();
        if (idNumber is not null)
        {
            if (idNumber.Length > 50)
            {
                Issue("idNumber", "too_long");
            }
            else if (taken.Contains(idNumber))
            {
                Issue("idNumber", "taken");
            }
            else if (all.Count(x => string.Equals(Clean(x.IdNumber)?.ToUpperInvariant(), idNumber, StringComparison.Ordinal)) > 1)
            {
                Issue("idNumber", "duplicate");
            }
        }

        if (r.HireDate is null)
        {
            Issue("hireDate", "required");
        }

        if (r.ProbationDays is < 0 or > 180)
        {
            Issue("probationDays", "amount");
        }

        if (r.Basic is not (> 0))
        {
            Issue("basic", r.Basic is null ? "required" : "amount");
        }

        foreach (var (field, value) in new[] { ("basic", r.Basic), ("housing", r.Housing), ("food", r.Food), ("transport", r.Transport), ("mobile", r.Mobile), ("project", r.Project), ("other", r.Other) })
        {
            if (value is < 0 or > MaxAmount && !issues.Any(i => i.Field == field))
            {
                Issue(field, "amount");
            }
        }

        var email = Clean(r.Email);
        if (email is not null && (email.Length > 200 || !email.Contains('@', StringComparison.Ordinal)))
        {
            Issue("email", "invalid");
        }

        var mobile = Clean(r.MobileNumber);
        if (mobile?.Length > 30)
        {
            Issue("mobileNumber", "too_long");
        }

        var input = new NewEmployeeInput(
            nameEn, nameAr, nationality, idNumber, r.HireDate, r.ProbationDays, entity, department, position,
            r.Basic, r.Housing, r.Food, r.Transport, r.Mobile, r.Project, r.Other, mobile, email);
        return new CheckedEmployeeRow(index, input, issues);
    }

    private async Task<Lists> ListsAsync(CancellationToken cancellationToken)
    {
        var nationalities = await reference.ListAsync(ReferenceListCodes.Nationalities, cancellationToken).ConfigureAwait(false);
        var entities = (await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).Where(e => e.IsActive).ToList();
        var departments = await db.Departments.AsNoTracking().OrderBy(d => d.SortOrder).ThenBy(d => d.NameAr)
            .Select(d => new DepartmentRef(d.Id, d.NameAr, d.NameEn)).ToListAsync(cancellationToken).ConfigureAwait(false);
        var positions = await db.Positions.AsNoTracking().Where(p => p.IsActive)
            .Join(db.JobTitles.AsNoTracking(), p => p.JobTitleId, j => j.Id, (p, j) => new { p.Id, p.DepartmentId, p.Seats, j.NameAr, j.NameEn })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var ids = positions.Select(p => p.Id).ToList();
        var occupied = await db.Employees.AsNoTracking().Where(e => e.PositionId != null && ids.Contains(e.PositionId.Value) && e.Status != StaffStatus.Left)
            .GroupBy(e => e.PositionId!.Value).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken).ConfigureAwait(false);
        return new Lists(
            nationalities,
            entities,
            departments,
            positions.Select(p => new PositionRef(p.Id, p.DepartmentId, p.NameAr, p.NameEn, Math.Max(0, p.Seats - occupied.GetValueOrDefault(p.Id)))).OrderBy(p => p.JobTitleAr).ToList());
    }

    /// <summary>The number the next employee should get (the save takes the real one, skipping numbers already held).</summary>
    private async Task<string> PeekNumberAsync(CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, "staff", clock.Today, cancellationToken).ConfigureAwait(false);
        await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
        return number;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string Plain(string value) => value.Replace("*", string.Empty, StringComparison.Ordinal).Replace(" ", string.Empty, StringComparison.Ordinal).Trim();

    private static bool Same(string? a, string b) =>
        a is not null && string.Equals(Plain(a).Replace("-", string.Empty, StringComparison.Ordinal), Plain(b).Replace("-", string.Empty, StringComparison.Ordinal), StringComparison.OrdinalIgnoreCase);

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

        string[] formats = ["yyyy/MM/dd", "yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy", "yyyy/M/d"];
        return DateOnly.TryParseExact(cell.GetString().Trim(), formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;
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

    private sealed record DepartmentRef(Guid Id, string NameAr, string NameEn);

    private sealed record PositionRef(Guid Id, Guid DepartmentId, string JobTitleAr, string JobTitleEn, int Free);

    private sealed record Lists(IReadOnlyList<ReferenceItemInfo> Nationalities, IReadOnlyList<LegalEntityInfo> Entities, IReadOnlyList<DepartmentRef> Departments, IReadOnlyList<PositionRef> Positions);
}
