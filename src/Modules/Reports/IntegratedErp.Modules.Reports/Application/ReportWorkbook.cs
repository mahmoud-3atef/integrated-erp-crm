using ClosedXML.Excel;

namespace IntegratedErp.Modules.Reports.Application;

/// <summary>A clicked figure's list as an Excel sheet (right to left, Arabic headers, amounts as numbers).</summary>
internal static class ReportWorkbook
{
    public static byte[] Invoices(IReadOnlyList<InvoiceRowDto> rows) => Build("الفواتير", ["الفاتورة", "المشروع", "مدير المشروع", "العمالة", "شامل الضريبة", "المحصّل", "المتبقي", "التحصيل %", "الحالة", "نهاية الفترة", "عمر الدين (يوم)"],
        rows.Select(r => new object?[] { r.No, r.ProjectName, r.Manager, r.Workers, r.Total, r.Collected, r.Remaining, r.Rate, r.StatusAr, r.To.ToDateTime(TimeOnly.MinValue), r.AgeDays }).ToList());

    public static byte[] Moves(IReadOnlyList<MoveRowDto> rows) => Build("الحركة", ["رقم العامل", "العامل", "الحركة", "التاريخ", "المشروع", "مدير المشروع"],
        rows.Select(r => new object?[] { r.WorkerNo, r.Name, r.Kind == "Work" ? "مباشرة مشروع" : "رجوع للسكن", r.On.ToDateTime(TimeOnly.MinValue), r.Project, r.Manager }).ToList());

    private static byte[] Build(string sheet, string[] headers, List<object?[]> rows)
    {
        using var book = new XLWorkbook();
        var ws = book.Worksheets.Add(sheet);
        ws.RightToLeft = true;
        for (var c = 0; c < headers.Length; c++)
        {
            ws.Cell(1, c + 1).Value = headers[c];
        }

        for (var r = 0; r < rows.Count; r++)
        {
            for (var c = 0; c < headers.Length; c++)
            {
                var cell = ws.Cell(r + 2, c + 1);
                switch (rows[r][c])
                {
                    case decimal d:
                        cell.Value = d;
                        cell.Style.NumberFormat.Format = "#,##0.00";
                        break;
                    case int i:
                        cell.Value = i;
                        break;
                    case DateTime dt:
                        cell.Value = dt;
                        cell.Style.DateFormat.Format = "yyyy/mm/dd";
                        break;
                    case string s:
                        cell.Value = s;
                        break;
                    default:
                        break;
                }
            }
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
}
