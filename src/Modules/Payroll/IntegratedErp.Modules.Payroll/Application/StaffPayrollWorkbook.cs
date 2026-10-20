using ClosedXML.Excel;
using IntegratedErp.Modules.Payroll.Domain;

namespace IntegratedErp.Modules.Payroll.Application;

/// <summary>The staff payroll register as an Excel file: the run's heading, one row per employee of the exported scope, and its total.</summary>
internal static class StaffPayrollWorkbook
{
    private static readonly string[] Heads =
    [
        "#", "رقم الموظف", "اسم الموظف", "الإدارة", "الوظيفة", "الأيام المستحقة", "الراتب الأساسي", "بدل السكن", "بدلات أخرى", "الإضافي", "الإضافات",
        "إجمالي البدلات", "الغياب وبدون راتب", "الجزاءات", "أقساط السلف", "خصومات أخرى", "التأمينات (حصة الموظف)", "إجمالي الاستقطاعات", "المؤجَّل", "الصافي",
    ];

    public static byte[] Build(StaffPayrollRun run, IReadOnlyList<StaffLineDto> lines, bool filtered)
    {
        ArgumentNullException.ThrowIfNull(run);
        ArgumentNullException.ThrowIfNull(lines);
        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Payroll");
        ws.RightToLeft = true;
        ws.Cell(1, 1).Value = $"مسير رواتب الموظفين {run.RunNo} — {run.LegalEntityName}";
        ws.Cell(1, 1).Style.Font.SetBold().Font.SetFontSize(14);
        ws.Cell(2, 1).Value = $"شهر الحضور {run.Period} ({run.From:yyyy/MM/dd} – {run.To:yyyy/MM/dd}) · {(filtered ? "النطاق المصفّى" : "المسير كله")} · {lines.Count} موظفًا";

        const int head = 4;
        for (var c = 0; c < Heads.Length; c++)
        {
            ws.Cell(head, c + 1).Value = Heads[c];
        }

        ws.Range(head, 1, head, Heads.Length).Style.Font.SetBold().Font.SetFontColor(XLColor.White).Fill.SetBackgroundColor(XLColor.FromHtml("#0F2747"));
        var row = head + 1;
        var n = 1;
        foreach (var l in lines)
        {
            object?[] values =
            [
                n++, l.EmployeeNo, l.Name, l.DepartmentAr, l.JobTitleAr, l.PaidDays, l.Basic, l.Housing, l.OtherAllowances, l.Overtime, l.Additions,
                l.Allowances, l.Absence, l.Penalties, l.Advances, l.OtherDeductions, l.GosiEmployee, l.Deductions, l.Deferred, l.Net,
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
        Func<StaffLineDto, decimal>[] sums =
        [
            l => l.PaidDays, l => l.Basic, l => l.Housing, l => l.OtherAllowances, l => l.Overtime, l => l.Additions, l => l.Allowances, l => l.Absence,
            l => l.Penalties, l => l.Advances, l => l.OtherDeductions, l => l.GosiEmployee, l => l.Deductions, l => l.Deferred, l => l.Net,
        ];
        for (var i = 0; i < sums.Length; i++)
        {
            ws.Cell(row, 6 + i).Value = lines.Sum(sums[i]);
        }

        ws.Range(row, 1, row, Heads.Length).Style.Font.SetBold().Fill.SetBackgroundColor(XLColor.FromHtml("#F1F5F9"));
        ws.Range(head + 1, 6, row, Heads.Length).Style.NumberFormat.Format = "#,##0.00";
        ws.SheetView.FreezeRows(head);
        ws.Columns().AdjustToContents(head, row);
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}
