using System.Globalization;
using ClosedXML.Excel;
using IntegratedErp.Modules.Attendance.Domain;

namespace IntegratedErp.Modules.Attendance.Application;

/// <summary>The fields a fingerprint file can carry.</summary>
public static class FileField
{
    public const string Key = "key";
    public const string Name = "name";
    public const string Date = "date";
    public const string Status = "status";
    public const string In = "in";
    public const string Out = "out";
    public const string Permission = "permission";
    public const string Late = "late";
    public const string Early = "early";

    public static readonly string[] All = [Key, Name, Date, Status, In, Out, Permission, Late, Early];
}

public sealed record FileColumn(string Header, IReadOnlyList<string> Samples);

internal sealed record FileRow(int RowNo, string Key, string? Name, DateOnly Date, TimeOnly? In, TimeOnly? Out, string? Status, int PermissionMinutes, int? LateMinutes, int? EarlyMinutes, bool BadTime, bool NoData);

internal sealed record ParsedFile(IReadOnlyList<FileColumn> Columns, IReadOnlyDictionary<string, string> Mapping, IReadOnlyList<FileRow> Rows);

/// <summary>
/// Reads the fingerprint system's export (FingerTec, the online system): finds the header row, matches the columns to the
/// fields by their usual names (or by the mapping given), and reads one row per employee and day. Rows without an
/// employee number or a readable date (titles, totals, blank lines) are passed over.
/// </summary>
internal static class AttendanceFile
{
    private static readonly Dictionary<string, string[]> Known = new()
    {
        [FileField.Key] = ["الرقم الوظيفي", "رقم الموظف", "رقم الهوية", "رقم البصمة", "no", "no.", "id", "employeeid", "employeeno", "ac-no.", "acno", "idnumber"],
        [FileField.Name] = ["الإسم", "الاسم", "اسم الموظف", "name", "employeename"],
        [FileField.Date] = ["التاريخ", "date", "workdate"],
        [FileField.Status] = ["حالة التحضير", "الحالة", "status", "exception"],
        [FileField.In] = ["وقت الحضور", "الحضور", "دخول", "clockin", "checkin", "in", "timein"],
        [FileField.Out] = ["وقت الانصراف", "الانصراف", "خروج", "clockout", "checkout", "out", "timeout"],
        [FileField.Permission] = ["المغادرات", "الاستئذان", "permission", "leaveminutes"],
        [FileField.Late] = ["تأخير حضور", "تاخير حضور", "التأخير", "تأخير", "late", "lateminutes", "attlate"],
        [FileField.Early] = ["انصراف مبكر", "انصراف باكر", "الخروج المبكر", "earlyleave", "early", "earlyminutes", "attleave"],
    };

    public static ParsedFile Read(Stream content, IReadOnlyDictionary<string, string>? mapping)
    {
        using var workbook = new XLWorkbook(content);
        var sheet = workbook.Worksheets.First();
        var used = sheet.RangeUsed();
        if (used is null)
        {
            return new ParsedFile([], new Dictionary<string, string>(), []);
        }

        var lastRow = used.LastRow().RowNumber();
        var lastCol = used.LastColumn().ColumnNumber();

        // The header row: the first of the top 30 that names a key and a date column.
        int headerRow = 0;
        Dictionary<string, int> fields = [];
        for (var r = 1; r <= Math.Min(30, lastRow) && headerRow == 0; r++)
        {
            var headers = Enumerable.Range(1, lastCol).ToDictionary(c => c, c => sheet.Cell(r, c).GetString().Trim());
            var found = Match(headers, mapping);
            if (found.ContainsKey(FileField.Key) && found.ContainsKey(FileField.Date))
            {
                headerRow = r;
                fields = found;
            }
        }

        if (headerRow == 0)
        {
            return new ParsedFile([], new Dictionary<string, string>(), []);
        }

        var columns = new List<FileColumn>();
        for (var c = 1; c <= lastCol; c++)
        {
            var header = sheet.Cell(headerRow, c).GetString().Trim();
            if (header.Length == 0)
            {
                continue;
            }

            var samples = new List<string>();
            for (var r = headerRow + 1; r <= lastRow && samples.Count < 3; r++)
            {
                // Only the data rows (not titles or totals).
                if (Text(sheet.Cell(r, fields[FileField.Key])).Length == 0 || !TryDate(sheet.Cell(r, fields[FileField.Date]), out _))
                {
                    continue;
                }

                var v = Text(sheet.Cell(r, c));
                if (v.Length > 0 && !samples.Contains(v))
                {
                    samples.Add(v.Length > 40 ? v[..40] : v);
                }
            }

            columns.Add(new FileColumn(header, samples));
        }

        var rows = new List<FileRow>();
        for (var r = headerRow + 1; r <= lastRow; r++)
        {
            var key = Text(sheet.Cell(r, fields[FileField.Key]));
            if (key.Length == 0 || !TryDate(sheet.Cell(r, fields[FileField.Date]), out var date))
            {
                continue;
            }

            string? Get(string field) => fields.TryGetValue(field, out var c) ? Text(sheet.Cell(r, c)) : null;
            var status = Get(FileField.Status);
            var badTime = false;
            TimeOnly? Time(string field)
            {
                if (!fields.TryGetValue(field, out var c))
                {
                    return null;
                }

                var cell = sheet.Cell(r, c);
                if (TryTime(cell, out var t))
                {
                    return t;
                }

                var text = Text(cell);
                badTime |= text.Length > 0 && text.Trim('-', '_', ' ').Length > 0;
                return null;
            }

            var @in = Time(FileField.In);
            var @out = Time(FileField.Out);
            int? Duration(string field) => fields.TryGetValue(field, out var c) && TryTime(sheet.Cell(r, c), out var d) ? (d.Hour * 60) + d.Minute : null;
            var permission = Duration(FileField.Permission) ?? 0;

            // "_ -": the fingerprint system has nothing for the day (before the employee was added to it).
            var noData = @in is null && @out is null && (status ?? string.Empty).Trim().StartsWith('_');
            rows.Add(new FileRow(r, key, Get(FileField.Name), date, @in, @out, status, permission, Duration(FileField.Late), Duration(FileField.Early), badTime, noData));
        }

        var map = fields.ToDictionary(f => f.Key, f => sheet.Cell(headerRow, f.Value).GetString().Trim());
        return new ParsedFile(columns, map, rows);
    }

    /// <summary>The fingerprint system's words for a leave, a permission or a work mission.</summary>
    public static DeviceMark Mark(string? status)
    {
        var s = (status ?? string.Empty).ToLowerInvariant();
        if (s.Contains("مهمة", StringComparison.Ordinal) || s.Contains("انتداب", StringComparison.Ordinal) || s.Contains("mission", StringComparison.Ordinal))
        {
            return DeviceMark.Mission;
        }

        if (s.Contains("استئذان", StringComparison.Ordinal) || s.Contains("permission", StringComparison.Ordinal))
        {
            return DeviceMark.Permission;
        }

        if (s.Contains("اجازة", StringComparison.Ordinal) || s.Contains("إجازة", StringComparison.Ordinal) || s.Contains("leave", StringComparison.Ordinal))
        {
            return DeviceMark.Leave;
        }

        return DeviceMark.None;
    }

    private static Dictionary<string, int> Match(Dictionary<int, string> headers, IReadOnlyDictionary<string, string>? mapping)
    {
        var found = new Dictionary<string, int>();
        foreach (var field in FileField.All)
        {
            if (mapping is not null && mapping.TryGetValue(field, out var wanted))
            {
                if (string.IsNullOrWhiteSpace(wanted))
                {
                    continue;
                }

                var hit = headers.FirstOrDefault(h => string.Equals(h.Value, wanted.Trim(), StringComparison.OrdinalIgnoreCase));
                if (hit.Key != 0)
                {
                    found[field] = hit.Key;
                    continue;
                }
            }

            var known = Known[field];
            var match = headers.FirstOrDefault(h => !found.ContainsValue(h.Key) && known.Contains(Compact(h.Value)));
            if (match.Key != 0)
            {
                found[field] = match.Key;
            }
        }

        return found;
    }

    private static string Compact(string header) => header.Trim().Replace(" ", string.Empty, StringComparison.Ordinal).Replace("_", string.Empty, StringComparison.Ordinal).ToLowerInvariant() is var c && c.Length > 0 && char.IsAsciiLetter(c[0])
        ? c
        : header.Trim();

    private static string Text(IXLCell cell) => cell.GetFormattedString().Trim();

    private static bool TryDate(IXLCell cell, out DateOnly date)
    {
        date = default;
        if (cell.DataType == XLDataType.DateTime)
        {
            date = DateOnly.FromDateTime(cell.GetDateTime());
            return true;
        }

        if (cell.DataType == XLDataType.Number)
        {
            var n = cell.GetDouble();
            if (n is > 20000 and < 80000)
            {
                date = DateOnly.FromDateTime(DateTime.FromOADate(n));
                return true;
            }

            return false;
        }

        var text = cell.GetString().Trim();
        string[] formats = ["yyyy/MM/dd", "yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy", "yyyy/M/d", "dd-MM-yyyy"];
        return DateOnly.TryParseExact(text, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
    }

    private static bool TryTime(IXLCell cell, out TimeOnly time)
    {
        time = default;
        switch (cell.DataType)
        {
            case XLDataType.DateTime:
                time = TimeOnly.FromDateTime(cell.GetDateTime());
                return true;
            case XLDataType.TimeSpan:
                var span = cell.GetTimeSpan();
                if (span < TimeSpan.FromDays(1) && span >= TimeSpan.Zero)
                {
                    time = TimeOnly.FromTimeSpan(span);
                    return true;
                }

                return false;
            case XLDataType.Number:
                var n = cell.GetDouble();
                if (n is >= 0 and < 1)
                {
                    time = TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(Math.Round(n * 1440)));
                    return true;
                }

                return false;
        }

        var text = cell.GetString().Trim();
        return TimeOnly.TryParseExact(text, ["HH:mm", "H:mm", "HH:mm:ss", "H:mm:ss"], CultureInfo.InvariantCulture, DateTimeStyles.None, out time);
    }
}
