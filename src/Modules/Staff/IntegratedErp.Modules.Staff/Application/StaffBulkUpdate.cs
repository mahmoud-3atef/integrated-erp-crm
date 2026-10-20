using System.Globalization;
using ClosedXML.Excel;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Staff.Domain;
using IntegratedErp.Modules.Staff.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Staff.Application;

public sealed record BulkChangeDto(int Row, Guid EmployeeId, string EmployeeNo, string Name, string Field, string? From, string? To);

public sealed record BulkProblemDto(int Row, string? EmployeeNo, string? Field, string Problem, string? Value);

public sealed record BulkUpdateResult(int Rows, int Employees, int Changes, int Rejected, bool Applied, IReadOnlyList<BulkChangeDto> Items, IReadOnlyList<BulkProblemDto> Problems);

/// <summary>
/// Updating many staff files at once from an Excel sheet (the user's request, 4.8): the template lists the employees
/// with what their files hold; what is written in a cell replaces it, and an empty cell changes nothing. A preview
/// shows every change and every problem first; a row with a problem is left out entirely.
/// </summary>
internal sealed class StaffBulkUpdate(StaffDbContext db, ILegalEntityDirectory legalEntities, IPermissionService permissions)
{
    /// <summary>The template's columns (the key first, the name only for reference), in the file's order.</summary>
    internal static readonly (string Key, string Ar, string En, bool Bank)[] Columns =
    [
        ("employee_no", "رقم الموظف", "Employee no.", false),
        ("name", "الاسم (للمرجعية فقط)", "Name (reference only)", false),
        ("id_number", "رقم الهوية أو الإقامة", "ID or iqama no.", false),
        ("mobile", "الجوال", "Mobile", false),
        ("email", "البريد الإلكتروني", "E-mail", false),
        ("gosi_no", "رقم التأمينات", "GOSI no.", false),
        ("gosi_since", "تاريخ الاشتراك في التأمينات", "GOSI since", true),
        ("legal_entity", "السجل التجاري", "Commercial registration", false),
        ("department", "الإدارة", "Department", false),
        ("bank", "البنك", "Bank", true),
        ("iban", "الآيبان", "IBAN", true),
        ("account_holder", "اسم صاحب الحساب", "Account holder", true),
    ];

    public async Task<byte[]> TemplateAsync(bool arabic, CancellationToken cancellationToken)
    {
        var seeBank = await SeeBankAsync(cancellationToken).ConfigureAwait(false);
        var entities = (await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).ToDictionary(e => e.Id);
        var departments = await db.Departments.AsNoTracking().ToDictionaryAsync(d => d.Id, cancellationToken).ConfigureAwait(false);
        var employees = await db.Employees.AsNoTracking().Where(e => e.Status != StaffStatus.Left).OrderBy(e => e.EmployeeNo).ToListAsync(cancellationToken).ConfigureAwait(false);

        using var book = new XLWorkbook();
        var sheet = book.AddWorksheet(arabic ? "الموظفون" : "Staff");
        sheet.RightToLeft = arabic;
        var columns = Columns.Where(c => seeBank || !c.Bank).ToList();
        for (var c = 0; c < columns.Count; c++)
        {
            var cell = sheet.Cell(1, c + 1);
            cell.Value = arabic ? columns[c].Ar : columns[c].En;
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = c < 2 ? XLColor.FromHtml("#E2E8F0") : XLColor.FromHtml("#DBEAFE");
        }

        var row = 2;
        foreach (var e in employees)
        {
            for (var c = 0; c < columns.Count; c++)
            {
                var value = columns[c].Key switch
                {
                    "employee_no" => e.EmployeeNo,
                    "name" => e.NameAr ?? e.NameEn,
                    "id_number" => e.IdNumber,
                    "mobile" => e.Mobile,
                    "email" => e.Email,
                    "gosi_no" => e.GosiNo,
                    "gosi_since" => e.GosiSince?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    "legal_entity" => e.LegalEntityId is { } le && entities.TryGetValue(le, out var entity) ? entity.NameAr : null,
                    "department" => e.DepartmentId is { } d && departments.TryGetValue(d, out var dept) ? dept.NameAr : null,
                    "bank" => e.BankName,
                    "iban" => e.Iban,
                    "account_holder" => e.AccountHolder,
                    _ => null,
                };
                sheet.Cell(row, c + 1).SetValue(value ?? string.Empty);
                sheet.Cell(row, c + 1).Style.NumberFormat.Format = "@";
            }

            row++;
        }

        sheet.Columns().AdjustToContents(1, Math.Min(row, 200));
        sheet.SheetView.FreezeRows(1);
        using var stream = new MemoryStream();
        book.SaveAs(stream);
        return stream.ToArray();
    }

    public async Task<BulkUpdateResult> RunAsync(Stream file, bool apply, CancellationToken cancellationToken)
    {
        var seeBank = await SeeBankAsync(cancellationToken).ConfigureAwait(false);
        var entities = (await legalEntities.ListAsync(cancellationToken).ConfigureAwait(false)).Where(e => e.IsActive).ToList();
        var departments = await db.Departments.Where(d => d.IsActive).ToListAsync(cancellationToken).ConfigureAwait(false);
        var employees = await db.Employees.ToDictionaryAsync(e => e.EmployeeNo, StringComparer.OrdinalIgnoreCase, cancellationToken).ConfigureAwait(false);
        var changes = new List<BulkChangeDto>();
        var problems = new List<BulkProblemDto>();
        var rows = 0;
        var touched = new HashSet<Guid>();

        XLWorkbook book;
        try
        {
            book = new XLWorkbook(file);
        }
        catch (Exception ex) when (ex is InvalidDataException or ArgumentException or FormatException or IOException)
        {
            return new BulkUpdateResult(0, 0, 0, 0, false, [], [new BulkProblemDto(0, null, null, "bad_file", null)]);
        }

        using (book)
        {
            var sheet = book.Worksheets.First();
            var header = sheet.Row(1);
            var map = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var cell in header.CellsUsed())
            {
                var title = cell.GetString().Trim();
                var column = Columns.FirstOrDefault(c => string.Equals(c.Ar, title, StringComparison.Ordinal) || string.Equals(c.En, title, StringComparison.OrdinalIgnoreCase));
                if (column.Key is not null)
                {
                    map[column.Key] = cell.Address.ColumnNumber;
                }
            }

            if (!map.ContainsKey("employee_no"))
            {
                return new BulkUpdateResult(0, 0, 0, 0, false, [], [new BulkProblemDto(1, null, "employee_no", "no_key_column", null)]);
            }

            var last = sheet.LastRowUsed()?.RowNumber() ?? 1;
            for (var r = 2; r <= last; r++)
            {
                string Cell(string key) => map.TryGetValue(key, out var c) ? Text(sheet.Cell(r, c)) : string.Empty;
                var no = Cell("employee_no");
                if (no.Length == 0 && map.Keys.All(k => Cell(k).Length == 0))
                {
                    continue;
                }

                rows++;
                if (!employees.TryGetValue(no, out var e))
                {
                    problems.Add(new BulkProblemDto(r, no, "employee_no", "unknown_employee", no));
                    continue;
                }

                var mine = new List<BulkChangeDto>();
                var rowProblems = new List<BulkProblemDto>();
                void Change(string field, string? from, string? to)
                {
                    if (!string.Equals(from ?? string.Empty, to ?? string.Empty, StringComparison.Ordinal))
                    {
                        mine.Add(new BulkChangeDto(r, e.Id, e.EmployeeNo, e.NameAr ?? e.NameEn, field, from, to));
                    }
                }

                string? idNumber = e.IdNumber, mobile = e.Mobile, email = e.Email, gosiNo = e.GosiNo, bank = e.BankName, iban = e.Iban, holder = e.AccountHolder;
                DateOnly? gosiSince = e.GosiSince;
                Guid? legalEntity = e.LegalEntityId, department = e.DepartmentId;

                Text1("id_number", 30, ref idNumber);
                Text1("mobile", 30, ref mobile);
                Text1("email", 200, ref email);
                Text1("gosi_no", 30, ref gosiNo);
                if (Cell("legal_entity") is { Length: > 0 } leText)
                {
                    var found = entities.FirstOrDefault(x => Same(x.NameAr, leText) || Same(x.NameEn, leText) || Same(x.Code, leText) || Same(x.CommercialRegistrationNo, leText));
                    if (found is null)
                    {
                        rowProblems.Add(new BulkProblemDto(r, no, "legal_entity", "unknown_legal_entity", leText));
                    }
                    else
                    {
                        Change("legal_entity", entities.FirstOrDefault(x => x.Id == e.LegalEntityId)?.NameAr, found.NameAr);
                        legalEntity = found.Id;
                    }
                }

                if (Cell("department") is { Length: > 0 } depText)
                {
                    var found = departments.FirstOrDefault(x => Same(x.NameAr, depText) || Same(x.NameEn, depText));
                    if (found is null)
                    {
                        rowProblems.Add(new BulkProblemDto(r, no, "department", "unknown_department", depText));
                    }
                    else
                    {
                        Change("department", departments.FirstOrDefault(x => x.Id == e.DepartmentId)?.NameAr, found.NameAr);
                        department = found.Id;
                    }
                }

                if (seeBank)
                {
                    Text1("bank", 100, ref bank);
                    Text1("account_holder", 200, ref holder);
                    if (Cell("iban") is { Length: > 0 } ibanText)
                    {
                        var cleaned = Ibans.Normalize(ibanText)!;
                        if (!Ibans.Valid(cleaned))
                        {
                            rowProblems.Add(new BulkProblemDto(r, no, "iban", "bad_iban", ibanText));
                        }
                        else
                        {
                            Change("iban", e.Iban, cleaned);
                            iban = cleaned;
                        }
                    }

                    if (map.TryGetValue("gosi_since", out var gc) && !sheet.Cell(r, gc).IsEmpty())
                    {
                        if (DateOf(sheet.Cell(r, gc)) is { } date)
                        {
                            Change("gosi_since", e.GosiSince?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                            gosiSince = date;
                        }
                        else
                        {
                            rowProblems.Add(new BulkProblemDto(r, no, "gosi_since", "bad_date", Text(sheet.Cell(r, gc))));
                        }
                    }
                }

                if (rowProblems.Count > 0)
                {
                    problems.AddRange(rowProblems);
                    continue;
                }

                if (mine.Count == 0)
                {
                    continue;
                }

                changes.AddRange(mine);
                touched.Add(e.Id);
                if (apply)
                {
                    e.SetPersonal(e.NameAr, e.NameEn, idNumber, e.NationalityCode, e.NationalityAr, e.NationalityEn, e.BirthDate, mobile, email, gosiNo);
                    e.Place(legalEntity, department, department == e.DepartmentId ? e.PositionId : null);
                    if (seeBank)
                    {
                        e.SetBank(bank, iban, holder);
                        e.SetGosiSince(gosiSince);
                    }
                }

                void Text1(string key, int max, ref string? target)
                {
                    var value = Cell(key);
                    if (value.Length == 0)
                    {
                        return;
                    }

                    if (value.Length > max)
                    {
                        rowProblems.Add(new BulkProblemDto(r, no, key, "too_long", value));
                        return;
                    }

                    Change(key, target, value);
                    target = value;
                }
            }
        }

        var rejected = problems.Where(p => p.Row > 0).Select(p => p.Row).Distinct().Count();
        if (apply && touched.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return new BulkUpdateResult(rows, touched.Count, changes.Count, rejected, apply && touched.Count > 0, changes.Take(2000).ToList(), problems.Take(500).ToList());
    }

    private async Task<bool> SeeBankAsync(CancellationToken cancellationToken) =>
        (await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(StaffPermissions.BankManage);

    private static bool Same(string? a, string b) => a is not null && string.Equals(a.Trim(), b.Trim(), StringComparison.OrdinalIgnoreCase);

    private static string Text(IXLCell cell) => cell.IsEmpty() ? string.Empty : cell.GetFormattedString().Trim();

    private static DateOnly? DateOf(IXLCell cell)
    {
        if (cell.DataType == XLDataType.DateTime)
        {
            return DateOnly.FromDateTime(cell.GetDateTime());
        }

        var text = Text(cell);
        return DateOnly.TryParseExact(text, ["yyyy-MM-dd", "yyyy/MM/dd", "d/M/yyyy", "dd/MM/yyyy"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;
    }
}
