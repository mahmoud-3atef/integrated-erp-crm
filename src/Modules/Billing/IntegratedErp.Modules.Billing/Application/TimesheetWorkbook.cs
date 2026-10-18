using System.Globalization;
using ClosedXML.Excel;
using IntegratedErp.Modules.Billing.Domain;

namespace IntegratedErp.Modules.Billing.Application;

/// <summary>A problem in an uploaded timesheet file: the row, the worker, and what is wrong (a code the screen translates).</summary>
public sealed record ExcelProblem(int Row, string? WorkerNo, string Code, string? Column = null);

/// <summary>A worker's total that the file changes.</summary>
public sealed record ExcelChange(Guid WorkerId, string WorkerNo, string Name, string Type, decimal Current, decimal Uploaded, string Reason);

/// <summary>What an uploaded file would do: its problems (nothing is applied while there is one) and its changes.</summary>
public sealed record ExcelPreview(int Rows, IReadOnlyList<ExcelProblem> Problems, IReadOnlyList<ExcelChange> Changes);

/// <summary>
/// The timesheet's Excel channel (docs/02-target-architecture/06 §4): a fixed, versioned template with one row per
/// worker — the system's columns locked, the month's adjustments to fill in (absence, overtime, customer additions,
/// deductions and loans, fee days, other costs, and the reason) — and reading it back with the old system's checks:
/// the file is this timesheet's, every worker of the timesheet is in it once, no other worker, the locked columns
/// unchanged, valid numbers, and a reason for every changed row. The values are totals: uploading again changes nothing.
/// </summary>
internal static class TimesheetWorkbook
{
    public const string Marker = "ERP-TIMESHEET-V1";
    private const string DataSheet = "Timesheet";
    private const string MetaSheet = "meta";
    private const int HeaderRow = 6;
    private const int FirstRow = 7;

    /// <summary>The adjustment columns, in order, after the system's columns (1–8); the reason comes last.</summary>
    private static readonly (AdjustmentType Type, string Ar, string En)[] Inputs =
    [
        (AdjustmentType.Absence, "الغياب (أيام)", "Absence (days)"),
        (AdjustmentType.Overtime, "الإضافي (ساعات)", "Overtime (hours)"),
        (AdjustmentType.ClientAddition, "إضافة من العميل", "Customer addition"),
        (AdjustmentType.ClientDeduction, "خصم يطلبه العميل", "Customer deduction"),
        (AdjustmentType.CustomerLoan, "سلفة صرفها العميل", "Customer loan"),
        (AdjustmentType.FeeDays, "تعديل أيام الرسوم (±)", "Fee days (±)"),
        (AdjustmentType.OtherCost, "تكاليف أخرى", "Other costs"),
        (AdjustmentType.InternalAddition, "إضافة داخلية (للعامل فقط)", "Internal addition (pay only)"),
        (AdjustmentType.InternalDeduction, "خصم داخلي (من العامل فقط)", "Internal deduction (pay only)"),
    ];

    private static readonly (string Ar, string En)[] Fixed =
    [
        ("الرقم الوظيفي", "Worker no."), ("الاسم", "Name"), ("الإقامة", "Iqama"), ("المصدر", "Source"),
        ("من", "From"), ("إلى", "To"), ("أيام العمل", "Work days"), ("السعر الشهري", "Monthly price"),
    ];

    private static int ReasonColumn => Fixed.Length + Inputs.Length + 1;

    public static byte[] Build(Timesheet t, decimal maxOvertimeHours)
    {
        ArgumentNullException.ThrowIfNull(t);
        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add(DataSheet);
        ws.RightToLeft = true;
        ws.Style.Font.FontName = "Arial";
        ws.Style.Font.FontSize = 10;

        ws.Cell(1, 1).Value = $"تحضير {t.ProjectName} — {t.Month:yyyy-MM}";
        ws.Cell(1, 1).Style.Font.SetBold().Font.SetFontSize(14);
        ws.Cell(2, 1).Value = $"{t.TimesheetNo} · {t.From:yyyy-MM-dd} → {t.To:yyyy-MM-dd} · {t.CustomerName}";
        ws.Cell(3, 1).Value = "عبّئ الأعمدة الصفراء فقط (القيمة الإجمالية للشهر لكل عامل) واكتب السبب لكل صف عدّلته. لا تحذف صفوفًا ولا تضف عمالًا ولا تغيّر الأعمدة الرمادية.";
        ws.Cell(4, 1).Value = "Fill in the yellow columns only (the month's total per worker) and give the reason on every row you change. Do not delete rows, add workers or change the grey columns.";
        ws.Range(3, 1, 3, ReasonColumn).Merge().Style.Alignment.SetWrapText(true);
        ws.Range(4, 1, 4, ReasonColumn).Merge().Style.Alignment.SetWrapText(true);
        ws.Row(3).Height = 30;
        ws.Row(4).Height = 30;
        ws.Range(5, 1, 5, Fixed.Length).Merge().Value = "من النظام (مقفلة) — From the system (locked)";
        ws.Range(5, Fixed.Length + 1, 5, ReasonColumn).Merge().Value = "متغيرات الشهر (للتعبئة) — The month's adjustments (to fill in)";
        ws.Range(5, 1, 5, ReasonColumn).Style.Font.SetBold().Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
        ws.Range(5, 1, 5, Fixed.Length).Style.Fill.SetBackgroundColor(XLColor.FromHtml("#d6e8f1"));
        ws.Range(5, Fixed.Length + 1, 5, ReasonColumn).Style.Fill.SetBackgroundColor(XLColor.FromHtml("#fff2cc"));

        List<(string Ar, string En)> headers = [.. Fixed, .. Inputs.Select(i => (i.Ar, i.En)), ("السبب", "Reason")];
        for (var c = 0; c < headers.Count; c++)
        {
            var cell = ws.Cell(HeaderRow, c + 1);
            cell.Value = $"{headers[c].Ar}\n{headers[c].En}";
            cell.Style.Font.SetBold().Alignment.SetWrapText(true).Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center).Alignment.SetVertical(XLAlignmentVerticalValues.Center);
            cell.Style.Fill.SetBackgroundColor(XLColor.FromHtml(c < Fixed.Length ? "#0d4a6c" : "#b38a0f"));
            cell.Style.Font.SetFontColor(XLColor.White);
        }

        ws.Row(HeaderRow).Height = 34;
        var row = FirstRow;
        foreach (var worker in Workers(t))
        {
            ws.Cell(row, 1).Value = worker.WorkerNo;
            ws.Cell(row, 2).Value = worker.Name;
            ws.Cell(row, 3).Value = worker.IqamaNo ?? string.Empty;
            ws.Cell(row, 4).Value = worker.Source;
            ws.Cell(row, 5).Value = worker.From.ToDateTime(TimeOnly.MinValue);
            ws.Cell(row, 6).Value = worker.To.ToDateTime(TimeOnly.MinValue);
            ws.Cell(row, 7).Value = worker.Days;
            ws.Cell(row, 8).Value = worker.Price;
            for (var i = 0; i < Inputs.Length; i++)
            {
                var total = t.TotalOf(worker.WorkerId, Inputs[i].Type);
                if (total != 0)
                {
                    ws.Cell(row, Fixed.Length + 1 + i).Value = total;
                }
            }

            ws.Cell(row, ReasonColumn).Value = worker.Reason ?? string.Empty;
            row++;
        }

        var last = Math.Max(FirstRow, row - 1);
        var system = ws.Range(FirstRow, 1, last, Fixed.Length);
        system.Style.Fill.SetBackgroundColor(XLColor.FromHtml("#f1f4f7"));
        ws.Range(FirstRow, 5, last, 6).Style.DateFormat.Format = "yyyy-mm-dd";
        ws.Range(FirstRow, 7, last, 8).Style.NumberFormat.Format = "#,##0.##";
        var inputs = ws.Range(FirstRow, Fixed.Length + 1, last, ReasonColumn);
        inputs.Style.Fill.SetBackgroundColor(XLColor.FromHtml("#fffbe6")).Protection.SetLocked(false);
        ws.Range(FirstRow, Fixed.Length + 1, last, ReasonColumn - 1).Style.NumberFormat.Format = "#,##0.##";
        ws.Range(HeaderRow, 1, last, ReasonColumn).Style.Border.SetInsideBorder(XLBorderStyleValues.Thin).Border.SetOutsideBorder(XLBorderStyleValues.Thin)
            .Border.SetInsideBorderColor(XLColor.FromHtml("#c9d5de")).Border.SetOutsideBorderColor(XLColor.FromHtml("#c9d5de"));

        // Numbers only in the adjustment columns: no negatives (but fee days), absence up to the work days.
        for (var i = 0; i < Inputs.Length; i++)
        {
            var column = ws.Range(FirstRow, Fixed.Length + 1 + i, last, Fixed.Length + 1 + i);
            var rule = column.CreateDataValidation();
            if (Inputs[i].Type == AdjustmentType.FeeDays)
            {
                rule.Decimal.Between(-31, 31);
            }
            else if (Inputs[i].Type == AdjustmentType.Overtime)
            {
                rule.Decimal.Between(0, (double)maxOvertimeHours);
            }
            else
            {
                rule.Decimal.EqualOrGreaterThan(0);
            }

            rule.ErrorTitle = "قيمة غير صحيحة";
            rule.ErrorMessage = "أدخل رقمًا صحيحًا لهذا العمود.";
        }

        ws.Columns(1, Fixed.Length).AdjustToContents();
        ws.Column(2).Width = Math.Min(ws.Column(2).Width, 36);
        for (var c = Fixed.Length + 1; c < ReasonColumn; c++)
        {
            ws.Column(c).Width = 15;
        }

        ws.Column(ReasonColumn).Width = 40;
        ws.SheetView.FreezeRows(HeaderRow);
        ws.SheetView.FreezeColumns(2);
        ws.Protect(Marker).AllowElement(XLSheetProtectionElements.FormatColumns).AllowElement(XLSheetProtectionElements.AutoFilter);

        // Which timesheet the file belongs to.
        var meta = workbook.Worksheets.Add(MetaSheet);
        meta.Cell(1, 1).Value = Marker;
        meta.Cell(2, 1).Value = t.Id.ToString();
        meta.Cell(3, 1).Value = t.TimesheetNo;
        meta.Visibility = XLWorksheetVisibility.VeryHidden;

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    /// <summary>Reads an uploaded file against the timesheet: its problems, and the totals it changes.</summary>
    public static (ExcelPreview Preview, IReadOnlyList<AdjustmentTotal> Totals) Read(Stream content, Timesheet t, decimal maxOvertimeHours)
    {
        ArgumentNullException.ThrowIfNull(t);
        var problems = new List<ExcelProblem>();
        var changes = new List<ExcelChange>();
        var totals = new List<AdjustmentTotal>();
        XLWorkbook workbook;
        try
        {
            workbook = new XLWorkbook(content);
        }
        catch (Exception exception) when (exception is InvalidDataException or IOException or ArgumentException or InvalidOperationException or FormatException)
        {
            return (new ExcelPreview(0, [new ExcelProblem(0, null, "excel_not_readable")], []), []);
        }

        using (workbook)
        {
            if (!workbook.TryGetWorksheet(MetaSheet, out var meta) || meta.Cell(1, 1).GetString() != Marker || !workbook.TryGetWorksheet(DataSheet, out var ws))
            {
                return (new ExcelPreview(0, [new ExcelProblem(0, null, "excel_not_template")], []), []);
            }

            if (meta.Cell(2, 1).GetString() != t.Id.ToString())
            {
                return (new ExcelPreview(0, [new ExcelProblem(0, null, "excel_other_timesheet")], []), []);
            }

            var workers = Workers(t).ToDictionary(w => w.WorkerNo, StringComparer.OrdinalIgnoreCase);
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var rows = 0;
            for (var r = FirstRow; !ws.Cell(r, 1).IsEmpty() || !ws.Cell(r + 1, 1).IsEmpty(); r++)
            {
                var number = ws.Cell(r, 1).GetString().Trim();
                if (number.Length == 0)
                {
                    continue;
                }

                rows++;
                if (!workers.TryGetValue(number, out var worker))
                {
                    problems.Add(new ExcelProblem(r, number, "excel_unknown_worker"));
                    continue;
                }

                if (!seen.Add(number))
                {
                    problems.Add(new ExcelProblem(r, number, "excel_duplicate_worker"));
                    continue;
                }

                if (!Number(ws.Cell(r, 7), out var days) || days != worker.Days)
                {
                    problems.Add(new ExcelProblem(r, number, "excel_locked_changed", "7"));
                    continue;
                }

                var reason = ws.Cell(r, ReasonColumn).GetString().Trim();
                var rowChanges = new List<(AdjustmentType Type, decimal Current, decimal Value)>();
                var valid = true;
                for (var i = 0; i < Inputs.Length; i++)
                {
                    var cell = ws.Cell(r, Fixed.Length + 1 + i);
                    if (!Number(cell, out var value))
                    {
                        problems.Add(new ExcelProblem(r, number, "excel_not_a_number", (Fixed.Length + 1 + i).ToString(CultureInfo.InvariantCulture)));
                        valid = false;
                        continue;
                    }

                    var type = Inputs[i].Type;
                    var code = type != AdjustmentType.FeeDays && value < 0 ? "excel_negative"
                        : type == AdjustmentType.Absence && value > days ? "excel_absence_over_days"
                        : type == AdjustmentType.Overtime && value > maxOvertimeHours ? "excel_overtime_limit"
                        : null;
                    if (code is not null)
                    {
                        problems.Add(new ExcelProblem(r, number, code, (Fixed.Length + 1 + i).ToString(CultureInfo.InvariantCulture)));
                        valid = false;
                        continue;
                    }

                    var current = t.TotalOf(worker.WorkerId, type);
                    if (value != current)
                    {
                        rowChanges.Add((type, current, value));
                    }
                }

                if (!valid || rowChanges.Count == 0)
                {
                    continue;
                }

                if (reason.Length == 0)
                {
                    problems.Add(new ExcelProblem(r, number, "excel_reason_missing", ReasonColumn.ToString(CultureInfo.InvariantCulture)));
                    continue;
                }

                foreach (var (type, current, value) in rowChanges)
                {
                    changes.Add(new ExcelChange(worker.WorkerId, worker.WorkerNo, worker.Name, type.ToString(), current, value, reason));
                    totals.Add(new AdjustmentTotal(worker.WorkerId, type, value, reason));
                }
            }

            // No worker of the timesheet may be dropped from the file.
            problems.AddRange(workers.Keys.Where(no => !seen.Contains(no) && !problems.Any(p => p.WorkerNo == no)).Select(no => new ExcelProblem(0, no, "excel_missing_worker")));
            return (new ExcelPreview(rows, problems, changes), problems.Count == 0 ? totals : []);
        }
    }

    /// <summary>A file name for the download.</summary>
    public static string FileName(Timesheet t) => $"{t.TimesheetNo}-{t.Month:yyyy-MM}.xlsx";

    private static bool Number(IXLCell cell, out decimal value)
    {
        value = 0;
        if (cell.IsEmpty())
        {
            return true;
        }

        if (cell.Value.IsNumber)
        {
            value = Math.Round((decimal)cell.Value.GetNumber(), 2);
            return true;
        }

        return decimal.TryParse(cell.GetString().Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out value);
    }

    /// <summary>One row per worker: their lines together (days summed, the latest price), and the reason of their last adjustment.</summary>
    private static IEnumerable<(Guid WorkerId, string WorkerNo, string Name, string? IqamaNo, string Source, DateOnly From, DateOnly To, decimal Days, decimal Price, string? Reason)> Workers(Timesheet t) =>
        t.Lines.GroupBy(l => l.WorkerId)
            .Select(g =>
            {
                var lines = g.OrderBy(l => l.LineFrom).ToList();
                var source = lines[0].Source switch
                {
                    WorkerSource.Company => "كفالة الشركة",
                    WorkerSource.Supplier => lines[0].SupplierName ?? "مورد",
                    _ => "غير محدد",
                };
                var reason = t.Adjustments.Where(a => a.WorkerId == g.Key).OrderBy(a => a.CreatedAt).LastOrDefault()?.Reason;
                return (g.Key, lines[0].WorkerNo, lines[0].Name, lines[0].IqamaNo, source, lines[0].LineFrom, lines[^1].LineTo, lines.Sum(l => l.WorkDays), lines[^1].TotalPrice, reason);
            })
            .OrderBy(w => w.Item2, StringComparer.Ordinal);
}
