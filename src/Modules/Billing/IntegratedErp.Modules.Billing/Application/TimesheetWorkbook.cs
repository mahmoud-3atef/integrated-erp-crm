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

    /// <summary>The live results after the reason: the worker's net pay and the invoice before VAT, recalculated as the row is filled.</summary>
    private static int PayColumn => ReasonColumn + 1;

    private static int InvoiceColumn => ReasonColumn + 2;

    /// <summary>
    /// Hidden helpers the two formulas use, per worker: the invoice and the pay without any adjustment, the day rates of
    /// the salary billed and paid, the overtime rate per hour, the fee per day, and the first line's days and fees (the
    /// adjustments go to the worker's first line, as the system applies them).
    /// </summary>
    private static readonly string[] Helpers = ["base_invoice", "base_pay", "bill_day", "pay_day", "overtime_hour", "fee_day", "first_days", "first_fees"];

    private static int HelperColumn(string name) => InvoiceColumn + 1 + Array.IndexOf(Helpers, name);

    public static byte[] Build(Timesheet t, BillingRules rules, decimal maxOvertimeHours)
    {
        ArgumentNullException.ThrowIfNull(t);
        ArgumentNullException.ThrowIfNull(rules);
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
            WriteResults(ws, row, t.Lines.Where(l => l.WorkerId == worker.WorkerId).OrderBy(l => l.LineFrom).ToList(), rules);
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

        // The results: a band, headers, a totals row, and the helpers hidden.
        ws.Range(5, PayColumn, 5, InvoiceColumn).Merge().Value = "النتيجة (تُحسب تلقائيًا) — Result (calculated)";
        ws.Range(5, PayColumn, 5, InvoiceColumn).Style.Font.SetBold().Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center).Fill.SetBackgroundColor(XLColor.FromHtml("#dcefe2"));
        foreach (var (column, ar, en) in new[] { (PayColumn, "صافي راتب العامل", "Worker's net pay"), (InvoiceColumn, "قيمة الفاتورة قبل الضريبة", "Invoice before VAT") })
        {
            var cell = ws.Cell(HeaderRow, column);
            cell.Value = $"{ar}\n{en}";
            cell.Style.Font.SetBold().Font.SetFontColor(XLColor.White).Fill.SetBackgroundColor(XLColor.FromHtml("#1f7a4d"))
                .Alignment.SetWrapText(true).Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center).Alignment.SetVertical(XLAlignmentVerticalValues.Center);
            ws.Column(column).Width = 18;
        }

        var results = ws.Range(FirstRow, PayColumn, last, InvoiceColumn);
        results.Style.NumberFormat.SetFormat("#,##0.00").Font.SetBold().Fill.SetBackgroundColor(XLColor.FromHtml("#f0f9f3"));
        results.Style.Border.SetInsideBorder(XLBorderStyleValues.Thin).Border.SetOutsideBorder(XLBorderStyleValues.Thin)
            .Border.SetInsideBorderColor(XLColor.FromHtml("#c9d5de")).Border.SetOutsideBorderColor(XLColor.FromHtml("#c9d5de"));

        // The totals (the worker number stays empty, so reading the file stops before this row).
        if (row > FirstRow)
        {
            var totals = row;
            ws.Cell(totals, 2).Value = "الإجمالي — Total";
            for (var c = 7; c <= InvoiceColumn; c++)
            {
                if (c == 8 || c == ReasonColumn)
                {
                    continue;
                }

                ws.Cell(totals, c).FormulaA1 = $"SUM({ws.Cell(FirstRow, c).Address}:{ws.Cell(last, c).Address})";
            }

            ws.Range(totals, 1, totals, InvoiceColumn).Style.Font.SetBold().Fill.SetBackgroundColor(XLColor.FromHtml("#e3ebf2")).NumberFormat.SetFormat("#,##0.##");
            ws.Range(totals, PayColumn, totals, InvoiceColumn).Style.NumberFormat.SetFormat("#,##0.00");
        }

        ws.Columns(HelperColumn(Helpers[0]), HelperColumn(Helpers[^1])).Hide();
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

    /// <summary>
    /// The row's two results as formulas of its yellow cells, with the system's rounding: the invoice and the pay without
    /// adjustments, less the absence at the day rate, plus the overtime at the hour rate, the customer's additions,
    /// deductions and loans, the fee days on the first line's fees, other costs (the invoice only) and the internal
    /// additions and deductions (the pay only).
    /// </summary>
    private static void WriteResults(IXLWorksheet ws, int row, List<TimesheetLine> lines, BillingRules rules)
    {
        LineAmounts Bare(TimesheetLine l) => TimesheetMath.Calculate(
            new LineInputs(l.WorkDays, l.DayDivisor, l.BillSalary, l.TotalPrice, l.Housing, l.Transport, l.PaySalary, l.BasicSalary, 0, 0, 0, 0, 0, 0, 0), rules);

        var first = lines[0];
        var q = first.DayDivisor <= 0 ? 30 : first.DayDivisor;
        var bare = lines.Select(Bare).ToList();
        var hour = rules.OvertimeHourlyRate
            ?? (first.BasicSalary > 0 ? first.BasicSalary : first.PaySalary) / (rules.MonthlyHours <= 0 ? 240 : rules.MonthlyHours) * rules.OvertimeMultiplier;
        var helpers = new Dictionary<string, decimal>
        {
            ["base_invoice"] = bare.Sum(a => a.InvoiceAmount),
            ["base_pay"] = bare.Sum(a => a.WorkerNet),
            ["bill_day"] = first.BillSalary / q,
            ["pay_day"] = first.PaySalary / q,
            ["overtime_hour"] = hour,
            ["fee_day"] = Math.Abs(first.TotalPrice - first.BillSalary) / q,
            ["first_days"] = first.WorkDays,
            ["first_fees"] = bare[0].DueFees,
        };
        foreach (var (name, value) in helpers)
        {
            ws.Cell(row, HelperColumn(name)).Value = value;
        }

        string Input(AdjustmentType type) => ws.Cell(row, Fixed.Length + 1 + Array.FindIndex(Inputs, i => i.Type == type)).Address.ToStringRelative();
        string Helper(string name) => ws.Cell(row, HelperColumn(name)).Address.ToStringRelative();
        var overtime = $"ROUND({Helper("overtime_hour")}*{Input(AdjustmentType.Overtime)},2)";
        var customer = $"{Input(AdjustmentType.ClientAddition)}-{Input(AdjustmentType.ClientDeduction)}-{Input(AdjustmentType.CustomerLoan)}";
        var fees = $"ROUND(MAX(0,{Helper("first_days")}+{Input(AdjustmentType.FeeDays)})*{Helper("fee_day")},2)-{Helper("first_fees")}";
        ws.Cell(row, InvoiceColumn).FormulaA1 =
            $"{Helper("base_invoice")}-ROUND({Helper("bill_day")}*{Input(AdjustmentType.Absence)},2)+{overtime}+{customer}+{fees}+{Input(AdjustmentType.OtherCost)}";
        ws.Cell(row, PayColumn).FormulaA1 =
            $"{Helper("base_pay")}-ROUND({Helper("pay_day")}*{Input(AdjustmentType.Absence)},2)+{overtime}+{customer}+{Input(AdjustmentType.InternalAddition)}-{Input(AdjustmentType.InternalDeduction)}";
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
