using System.Globalization;
using ClosedXML.Excel;
using IntegratedErp.Modules.Billing.Domain;

namespace IntegratedErp.Modules.Billing.Application;

/// <summary>
/// The invoice's detailed attachment (docs/02-target-architecture/07 §2.2): every worker with their days and the parts
/// of their amount — the tax invoice itself carries the totals only. Bilingual headers, right to left, a totals row.
/// </summary>
internal static class InvoiceWorkbook
{
    private static readonly (string Ar, string En, Func<InvoiceWorkerLine, object?> Value, bool Money)[] Columns =
    [
        ("الرقم الوظيفي", "Worker no.", l => l.WorkerNo, false),
        ("الاسم", "Name", l => l.Name, false),
        ("رقم الإقامة", "Iqama no.", l => l.IqamaNo, false),
        ("من", "From", l => l.LineFrom.ToDateTime(TimeOnly.MinValue), false),
        ("إلى", "To", l => l.LineTo.ToDateTime(TimeOnly.MinValue), false),
        ("أيام العمل", "Work days", l => l.WorkDays, true),
        ("السعر الشهري", "Monthly price", l => l.MonthlyPrice, true),
        ("الراتب المستحق", "Salary due", l => l.DueSalary, true),
        ("أيام الغياب", "Absent days", l => l.AbsenceDays, true),
        ("خصم الغياب", "Absence", l => -l.AbsenceAmount, true),
        ("رسوم الخدمة", "Service fees", l => l.DueFees, true),
        ("ساعات الإضافي", "Overtime hours", l => l.OvertimeHours, true),
        ("الإضافي", "Overtime", l => l.Overtime, true),
        ("إضافات العميل", "Customer additions", l => l.ClientAdditions, true),
        ("خصومات العميل", "Customer deductions", l => -l.ClientDeductions, true),
        ("سلف العميل", "Customer loans", l => -l.CustomerLoans, true),
        ("تكاليف أخرى", "Other costs", l => l.OtherCosts, true),
        ("التأمينات", "GOSI", l => l.Gosi, true),
        ("قبل الضريبة", "Before VAT", l => l.Amount, true),
        ("الضريبة", "VAT", l => l.Vat, true),
        ("الإجمالي", "Total", l => l.Total, true),
    ];

    public static string FileName(Invoice i) =>
        $"{i.InvoiceNo ?? "DRAFT"}-{i.ProjectCode}-{i.Month.ToString("yyyy-MM", CultureInfo.InvariantCulture)}.xlsx".Replace('/', '-');

    public static byte[] Build(Invoice invoice)
    {
        ArgumentNullException.ThrowIfNull(invoice);
        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Workers");
        ws.RightToLeft = true;
        ws.Cell(1, 1).Value = $"المرفق التفصيلي للفاتورة {invoice.InvoiceNo ?? "(مسودة)"} — Invoice attachment";
        ws.Cell(1, 1).Style.Font.SetBold().Font.SetFontSize(14);
        ws.Cell(2, 1).Value = $"{invoice.ProjectName} · {invoice.CustomerName}";
        ws.Cell(3, 1).Value = $"{invoice.PeriodFrom:yyyy-MM-dd} — {invoice.PeriodTo:yyyy-MM-dd}";

        const int header = 5;
        for (var c = 0; c < Columns.Length; c++)
        {
            var cell = ws.Cell(header, c + 1);
            cell.Value = $"{Columns[c].Ar}\n{Columns[c].En}";
            cell.Style.Alignment.SetWrapText().Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center).Alignment.SetVertical(XLAlignmentVerticalValues.Center);
            cell.Style.Font.SetBold().Font.SetFontColor(XLColor.White).Fill.SetBackgroundColor(XLColor.FromHtml("#1F3A5F"));
        }

        ws.Row(header).Height = 32;
        var row = header + 1;
        foreach (var line in invoice.Workers.OrderBy(l => l.WorkerNo, StringComparer.Ordinal).ThenBy(l => l.LineFrom))
        {
            for (var c = 0; c < Columns.Length; c++)
            {
                var cell = ws.Cell(row, c + 1);
                switch (Columns[c].Value(line))
                {
                    case decimal d:
                        cell.Value = d;
                        cell.Style.NumberFormat.Format = "#,##0.00";
                        break;
                    case DateTime t:
                        cell.Value = t;
                        cell.Style.DateFormat.Format = "yyyy-mm-dd";
                        break;
                    case string s:
                        cell.Value = s;
                        break;
                }
            }

            row++;
        }

        // Totals of the money columns.
        ws.Cell(row, 1).Value = $"الإجمالي — Total ({invoice.Workers.Select(w => w.WorkerId).Distinct().Count()})";
        for (var c = 0; c < Columns.Length; c++)
        {
            if (Columns[c].Money && c >= 5 && row > header + 1)
            {
                var cell = ws.Cell(row, c + 1);
                cell.FormulaA1 = $"SUM({ws.Cell(header + 1, c + 1).Address}:{ws.Cell(row - 1, c + 1).Address})";
                cell.Style.NumberFormat.Format = "#,##0.00";
            }
        }

        ws.Row(row).Style.Font.SetBold().Fill.SetBackgroundColor(XLColor.FromHtml("#E8EEF6"));
        ws.Columns(1, Columns.Length).AdjustToContents(header, row);
        ws.Column(2).Width = Math.Min(ws.Column(2).Width, 40);
        ws.SheetView.FreezeRows(header);
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}
