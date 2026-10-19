using ClosedXML.Excel;
using IntegratedErp.Modules.Payroll.Domain;

namespace IntegratedErp.Modules.Payroll.Application;

/// <summary>The payroll register as an Excel file: the run's heading, then one row per worker of the exported scope, and the scope's total.</summary>
internal static class PayrollWorkbook
{
    private static readonly string[] Heads =
    [
        "#", "رقم العامل", "اسم العامل", "المهنة", "المشروع", "الحالة", "الأيام المدفوعة", "أيام الغياب", "الراتب الأساسي",
        "بدل السكن", "بدل الطعام", "بدل النقل", "بدلات أخرى", "الإضافي", "الإضافات", "إجمالي البدلات", "الاستقطاعات", "الصافي",
    ];

    public static byte[] Build(PayrollRun run, IReadOnlyList<PayrollLineDto> lines, bool filtered)
    {
        ArgumentNullException.ThrowIfNull(run);
        ArgumentNullException.ThrowIfNull(lines);
        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Payroll");
        ws.RightToLeft = true;
        ws.Cell(1, 1).Value = $"مسير رواتب {run.RunNo} — {run.LegalEntityName}";
        ws.Cell(1, 1).Style.Font.SetBold().Font.SetFontSize(14);
        ws.Cell(2, 1).Value = $"الفترة {run.From:yyyy/MM/dd} – {run.To:yyyy/MM/dd} · {(filtered ? "النطاق المصفّى" : "المسير كله")} · {lines.Count} عاملًا";

        const int head = 4;
        for (var c = 0; c < Heads.Length; c++)
        {
            ws.Cell(head, c + 1).Value = Heads[c];
        }

        var headRow = ws.Range(head, 1, head, Heads.Length);
        headRow.Style.Font.SetBold().Font.SetFontColor(XLColor.White).Fill.SetBackgroundColor(XLColor.FromHtml("#0F2747"));

        var row = head + 1;
        var n = 1;
        foreach (var l in lines)
        {
            object?[] values =
            [
                n++, l.WorkerNo, l.Name, l.ProfessionAr ?? l.ProfessionCode, l.ProjectName, l.StatusAr, l.PaidDays, l.AbsenceDays, l.Base,
                l.Housing, l.Food, l.Transport, l.OtherAllowances, l.Overtime, l.Additions, l.Allowances, l.Deductions, l.Net,
            ];
            for (var c = 0; c < values.Length; c++)
            {
                ws.Cell(row, c + 1).Value = values[c] switch
                {
                    null => Blank.Value,
                    decimal d => d,
                    int i => i,
                    var v => v.ToString(),
                };
            }

            row++;
        }

        ws.Cell(row, 3).Value = "الإجمالي";
        for (var c = 7; c <= Heads.Length; c++)
        {
            ws.Cell(row, c).Value = lines.Sum(l => c switch
            {
                7 => l.PaidDays, 8 => l.AbsenceDays, 9 => l.Base, 10 => l.Housing, 11 => l.Food, 12 => l.Transport, 13 => l.OtherAllowances,
                14 => l.Overtime, 15 => l.Additions, 16 => l.Allowances, 17 => l.Deductions, _ => l.Net,
            });
        }

        ws.Range(row, 1, row, Heads.Length).Style.Font.SetBold().Fill.SetBackgroundColor(XLColor.FromHtml("#F1F5F9"));
        ws.Range(head + 1, 7, row, Heads.Length).Style.NumberFormat.Format = "#,##0.00";
        ws.SheetView.FreezeRows(head);
        ws.Columns().AdjustToContents(head, row);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}
