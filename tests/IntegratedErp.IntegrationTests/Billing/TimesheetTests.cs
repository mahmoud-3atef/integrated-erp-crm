using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.Billing.Application;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Organization.Application.Settings;
using IntegratedErp.Modules.Workflow.Application;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Billing;

[Collection(DatabaseTestGroup.Name)]
public sealed class TimesheetTests(TestDatabase database)
{
    private static readonly DateTime Created2025 = new(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    [SkippableFact]
    public async Task A_project_timesheet_is_generated_from_the_ledger_adjusted_approved_and_split_into_its_three_outputs()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"ts-{Guid.NewGuid():N}"[..16], "شركة التحضير", "Timesheet Co", default)).Value.Id;
        }

        var crm = new FakeCrm();
        crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        var project = crm.Add("new_project", new() { ["new_name"] = "مشروع الرياض", ["new_code"] = "pro00900", ["new_contracttype"] = 2, ["statecode"] = 0 }, created: Created2025);
        var company = Worker(crm, "BSS0701", 100000000); // Care-Pro: the company's payroll
        var supplier = Worker(crm, "BSS0702", 100000002); // IRC: an internal supplier
        var unknown = Worker(crm, "BSS0703", null); // no sponsor
        WorkStart(crm, company, project, "2026-08-01", 3000m);
        WorkStart(crm, supplier, project, "2026-09-11", 2800m);
        WorkStart(crm, unknown, project, "2026-09-21", 2500m);
        crm.Add("new_invoice", new()
        {
            ["new_invoicenumber"] = "INV00650", ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع الرياض", ["new_invoicetype"] = 100000000,
            ["statecode"] = 0, ["statuscode"] = 279640003, ["new_totalamount"] = 1000m, ["new_totalvatamount"] = 150m, ["new_totalpaidamount"] = 150m,
            ["new_invoicedate"] = "2026-07-31T21:00:00Z", ["new_fromdate"] = "2026-06-30T21:00:00Z", ["new_todate"] = "2026-07-30T21:00:00Z",
        }, created: Created2025);
        await SyncAsync(tenantId, crm);
        var (manager, approver) = await PeopleAsync(tenantId);

        var september = new DateOnly(2026, 9, 1);
        Guid id, projectId, companyId;
        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var service = scope.ServiceProvider.GetRequiredService<TimesheetService>();
            var queries = scope.ServiceProvider.GetRequiredService<TimesheetQueries>();
            var month = await queries.MonthAsync(september, default);
            var row = month.Projects.Single();
            Assert.Equal(("مشروع الرياض", 3, (Guid?)null), (row.ProjectName, row.LedgerWorkers, row.TimesheetId));
            projectId = row.ProjectId!.Value;

            var generated = await service.GenerateAsync(new GenerateInput(projectId, september), default);
            Assert.True(generated.IsSuccess, generated.IsFailure ? generated.Error.Code : null);
            id = generated.Value;
            var sheet = (await queries.GetAsync(id, default))!;
            Assert.Equal((new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30), "Draft"), (sheet.From, sheet.To, sheet.Status));
            Assert.Equal([("BSS0701", 30m), ("BSS0702", 20m), ("BSS0703", 10m)], sheet.Lines.Select(l => (l.WorkerNo, l.WorkDays)));
            companyId = sheet.Lines.Single(l => l.WorkerNo == "BSS0701").WorkerId;

            // Absence and overtime, each with a reason; more absent days than work days are refused.
            Assert.Equal("validation.timesheet_reason", (await service.AdjustAsync(id, new AdjustmentInput(companyId, "Absence", 2, " "), default)).Error.Code);
            Assert.Equal("validation.timesheet_absence_over_days", (await service.AdjustAsync(id, new AdjustmentInput(companyId, "Absence", 31, "غياب"), default)).Error.Code);
            Assert.True((await service.AdjustAsync(id, new AdjustmentInput(companyId, "Absence", 2, "غياب بإفادة المشرف"), default)).IsSuccess);
            Assert.True((await service.AdjustAsync(id, new AdjustmentInput(companyId, "Overtime", 8, "عمل إضافي يوم الجمعة"), default)).IsSuccess);

            // The company's own addition and deduction: the worker's pay only, never the invoice.
            var before = (await queries.GetAsync(id, default))!.Lines.Single(l => l.WorkerNo == "BSS0701");
            Assert.True((await service.AdjustAsync(id, new AdjustmentInput(companyId, "InternalAddition", 200, "مكافأة من الشركة"), default)).IsSuccess);
            Assert.True((await service.AdjustAsync(id, new AdjustmentInput(companyId, "InternalDeduction", 150, "جزاء إداري"), default)).IsSuccess);
            var after = (await queries.GetAsync(id, default))!.Lines.Single(l => l.WorkerNo == "BSS0701");
            Assert.Equal((before.InvoiceAmount, before.WorkerNet + 50), (after.InvoiceAmount, after.WorkerNet));
            Assert.Equal((200m, 150m), (after.InternalAdditions, after.InternalDeductions));
            var internals = (await queries.GetAsync(id, default))!.Adjustments.Where(a => a.Type.StartsWith("Internal", StringComparison.Ordinal)).ToList();
            foreach (var adjustment in internals)
            {
                Assert.True((await service.RemoveAdjustmentAsync(id, adjustment.Id, default)).IsSuccess);
            }

            // Generated again (e.g. after a movement): the adjustments stay on the worker.
            Assert.True((await service.GenerateAsync(new GenerateInput(projectId, september), default)).IsSuccess);
            sheet = (await queries.GetAsync(id, default))!;
            var line = sheet.Lines.Single(l => l.WorkerNo == "BSS0701");
            Assert.Equal((2m, 8m, 1500m, 100m, 50m, 2950m), (line.AbsenceDays, line.OvertimeHours, line.DueSalary, line.AbsenceAmount, line.Overtime, line.InvoiceAmount));
            Assert.Equal(1450m, line.WorkerNet);
            Assert.Equal((1000m, 866.67m, 1866.67m), (sheet.Lines.Single(l => l.WorkerNo == "BSS0702").DueSalary, sheet.Lines.Single(l => l.WorkerNo == "BSS0702").DueFees, sheet.Lines.Single(l => l.WorkerNo == "BSS0702").InvoiceAmount));

            // The three outputs: the invoice, the company's payroll, the supplier's statement — and the worker with no sponsor.
            Assert.Equal(2950m + 1866.67m + 833.33m, sheet.Invoice.Amount);
            Assert.Equal(Math.Round(sheet.Invoice.Amount * 0.15m, 2), sheet.Invoice.Vat, 1);
            Assert.Equal(["BSS0701"], sheet.Payroll.Select(p => p.WorkerNo));
            Assert.Equal(("IRC - 02", 1, 20m), (sheet.Suppliers.Single().SupplierName, sheet.Suppliers.Single().Workers, sheet.Suppliers.Single().WorkDays));
            Assert.Equal(["BSS0703"], sheet.UnknownSource.Select(p => p.WorkerNo));

            // The Excel channel: the template has the adjustments entered so far; the file's values are totals.
            var file = (await service.ExportAsync(id, default))!.Value;
            Assert.EndsWith(".xlsx", file.FileName);
            var filled = Edit(file.Content, ws =>
            {
                Assert.Equal(["BSS0701", "BSS0702", "BSS0703"], Enumerable.Range(7, 3).Select(r => ws.Cell(r, 1).GetString()));
                Assert.Equal(2m, ws.Cell(7, 9).GetValue<decimal>()); // the absence entered on the screen
                ws.Cell(8, 9).Value = 3; // BSS0702: 3 absent days
                ws.Cell(8, 11).Value = 250; // and a customer addition
                ws.Cell(8, 18).Value = "كشف حضور العميل";
                ws.Cell(9, 10).Value = 4; // BSS0703: overtime, but no reason
            });
            var preview = (await service.PreviewAsync(id, new MemoryStream(filled), default)).Value;
            Assert.Equal([("excel_reason_missing", "BSS0703")], preview.Problems.Select(p => (p.Code, p.WorkerNo)));

            // Nothing is applied while the file has a problem.
            Assert.Single((await service.ApplyExcelAsync(id, new MemoryStream(filled), default)).Value.Problems);
            var fixedFile = Edit(filled, ws => ws.Cell(9, 18).Value = "عمل إضافي معتمد");
            var applied = (await service.ApplyExcelAsync(id, new MemoryStream(fixedFile), default)).Value;
            Assert.Equal((0, 3), (applied.Problems.Count, applied.Changes.Count));

            // Uploading the same file again changes nothing.
            Assert.Empty((await service.PreviewAsync(id, new MemoryStream(fixedFile), default)).Value.Changes);
            sheet = (await queries.GetAsync(id, default))!;
            var supplierLine = sheet.Lines.Single(l => l.WorkerNo == "BSS0702");
            Assert.Equal((3m, 250m), (supplierLine.AbsenceDays, supplierLine.ClientAdditions));
            Assert.Equal(4m, sheet.Lines.Single(l => l.WorkerNo == "BSS0703").OvertimeHours);
            Assert.Equal(2m, sheet.Lines.Single(l => l.WorkerNo == "BSS0701").AbsenceDays);

            // The live results: the worker's net pay and the invoice before VAT, as the system computes them, and they move with the cells.
            using (var results = new ClosedXML.Excel.XLWorkbook(new MemoryStream((await service.ExportAsync(id, default))!.Value.Content)))
            {
                var ws = results.Worksheet("Timesheet");
                foreach (var (r, l) in sheet.Lines.OrderBy(x => x.WorkerNo, StringComparer.Ordinal).Select((x, n) => (7 + n, x)))
                {
                    Assert.Equal((l.WorkerNet, l.InvoiceAmount), (Math.Round((decimal)ws.Cell(r, 19).Value.GetNumber(), 2), Math.Round((decimal)ws.Cell(r, 20).Value.GetNumber(), 2)));
                }

                Assert.Equal(sheet.Invoice.Amount, Math.Round((decimal)ws.Cell(10, 20).Value.GetNumber(), 2));
                ws.Unprotect("ERP-TIMESHEET-V1");
                ws.Cell(8, 9).Value = 0; // BSS0702 without the absence: 3 days of 1,500 / 30 come back
                ws.RecalculateAllFormulas();
                Assert.Equal(supplierLine.InvoiceAmount + 150m, Math.Round((decimal)ws.Cell(8, 20).Value.GetNumber(), 2));
            }

            // The old system's checks: a changed locked column, a worker dropped, another timesheet's file.
            Assert.Equal("excel_locked_changed", (await service.PreviewAsync(id, new MemoryStream(Edit(fixedFile, ws => ws.Cell(7, 7).Value = 31)), default)).Value.Problems.Single().Code);
            Assert.Equal("excel_missing_worker", (await service.PreviewAsync(id, new MemoryStream(Edit(fixedFile, ws => ws.Row(9).Clear())), default)).Value.Problems.Single().Code);
            Assert.Equal("excel_not_readable", (await service.PreviewAsync(id, new MemoryStream([1, 2, 3]), default)).Value.Problems.Single().Code);

            Assert.True((await service.SubmitAsync(id, default)).IsSuccess);
        }

        await ApproveNextAsync(tenantId, approver);

        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var sheet = (await scope.ServiceProvider.GetRequiredService<TimesheetQueries>().GetAsync(id, default))!;
            Assert.Equal(("Approved", false), (sheet.Status, sheet.CanEdit));

            // Approved: locked.
            var service = scope.ServiceProvider.GetRequiredService<TimesheetService>();
            Assert.Equal("conflict.timesheet_not_editable", (await service.AdjustAsync(id, new AdjustmentInput(companyId, "Absence", 1, "غياب"), default)).Error.Code);
            Assert.Equal("conflict.timesheet_not_editable", (await service.GenerateAsync(new GenerateInput(projectId, september), default)).Error.Code);
            Assert.Equal(1, (await scope.ServiceProvider.GetRequiredService<TimesheetQueries>().MonthAsync(september, default)).Totals.Approved);
        }

        // The invoice: made from the approved timesheet, its totals the timesheet's to the halala.
        Guid invoiceId;
        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            // Invoice numbers continue after the old system's last one (INV00700).
            Assert.True((await scope.ServiceProvider.GetRequiredService<NumberingService>().UpdateAsync("invoice", new NumberingInput("INV{N:5}", NumberReset.Never, 701), default)).IsSuccess);
            var sheet = (await scope.ServiceProvider.GetRequiredService<TimesheetQueries>().GetAsync(id, default))!;
            Assert.True(sheet.CanInvoice);

            var service = scope.ServiceProvider.GetRequiredService<InvoiceService>();
            var queries = scope.ServiceProvider.GetRequiredService<InvoiceQueries>();
            var made = await service.CreateFromTimesheetAsync(id, default);
            Assert.True(made.IsSuccess, made.IsFailure ? made.Error.Code : null);
            invoiceId = made.Value;
            Assert.Equal("conflict.invoice_exists", (await service.CreateFromTimesheetAsync(id, default)).Error.Code);

            var invoice = (await queries.GetAsync(invoiceId, default))!;
            Assert.Equal(("Draft", (string?)null, new DateOnly(2026, 9, 30)), (invoice.Status, invoice.InvoiceNo, invoice.InvoiceDate));
            Assert.Equal((sheet.Invoice.Amount, sheet.Invoice.Vat, sheet.Invoice.Total), (invoice.Amount, invoice.Vat, invoice.Total));
            Assert.Equal(invoice.Amount, invoice.Items.Sum(i => i.Amount));
            Assert.Equal(sheet.Invoice.DueSalary - sheet.Invoice.AbsenceAmount, invoice.Items.Single(i => i.Component == "Salary").Amount);
            Assert.Equal(sheet.Lines.Count, invoice.Workers.Count);
            Assert.Contains("no_customer_vat", invoice.Warnings);

            // The draft's terms: 30 days to pay.
            Assert.True((await service.EditAsync(invoiceId, new InvoiceEditInput(new DateOnly(2026, 9, 30), 30, "فاتورة شهر سبتمبر"), default)).IsSuccess);
            Assert.Equal(new DateOnly(2026, 10, 30), (await queries.GetAsync(invoiceId, default))!.DueDate);

            // The detailed attachment: a row per worker line and a totals row.
            using (var attachment = new ClosedXML.Excel.XLWorkbook(new MemoryStream((await service.AttachmentAsync(invoiceId, default))!.Value.Content)))
            {
                Assert.Equal(5 + sheet.Lines.Count + 1, attachment.Worksheet("Workers").LastRowUsed()!.RowNumber());
            }

            Assert.True((await service.SubmitAsync(invoiceId, default)).IsSuccess);
            Assert.Equal("conflict.invoice_not_editable", (await service.DeleteAsync(invoiceId, default)).Error.Code);
        }

        // The project's review moves it to finance; finance's approval issues it.
        await ApproveNextAsync(tenantId, approver);
        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            Assert.Equal("FinanceReview", (await scope.ServiceProvider.GetRequiredService<InvoiceQueries>().GetAsync(invoiceId, default))!.Status);
        }

        await ApproveNextAsync(tenantId, approver);
        Guid creditId;
        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var service = scope.ServiceProvider.GetRequiredService<InvoiceService>();
            var queries = scope.ServiceProvider.GetRequiredService<InvoiceQueries>();
            var invoice = (await queries.GetAsync(invoiceId, default))!;
            Assert.Equal(("Issued", "INV00701", false, true), (invoice.Status, invoice.InvoiceNo, invoice.CanEdit, invoice.CanNote));
            Assert.Equal("INV00701", (await scope.ServiceProvider.GetRequiredService<TimesheetQueries>().GetAsync(id, default))!.InvoiceDoc!.InvoiceNo);
            Assert.Equal(1, (await scope.ServiceProvider.GetRequiredService<TimesheetQueries>().MonthAsync(september, default)).Totals.Invoiced);

            // Issued: never changed or deleted — corrected by notes, each with its reason, a credit never above what is left.
            Assert.Equal("conflict.invoice_not_editable", (await service.EditAsync(invoiceId, new InvoiceEditInput(new DateOnly(2026, 9, 30), null, null), default)).Error.Code);
            Assert.Equal("conflict.invoice_not_editable", (await service.DeleteAsync(invoiceId, default)).Error.Code);
            var date = new DateOnly(2026, 10, 15);
            Assert.Equal("validation.invoice_note_reason", (await service.CreateNoteAsync(invoiceId, new NoteInput("CreditNote", date, " ", [new("Overtime", null, 50)]), default)).Error.Code);
            Assert.Equal("validation.invoice_note_over", (await service.CreateNoteAsync(invoiceId, new NoteInput("CreditNote", date, "خصم", [new("Salary", null, invoice.Amount + 1)]), default)).Error.Code);
            Assert.Equal("validation.invoice_note_items", (await service.CreateNoteAsync(invoiceId, new NoteInput("DebitNote", date, "إضافة", [new("Salary", null, 0)]), default)).Error.Code);
            var credit = await service.CreateNoteAsync(invoiceId, new NoteInput("CreditNote", date, "غياب بلغ بعد الإصدار", [new("Salary", "غياب يومين للعامل BSS0701", 100)]), default);
            Assert.True(credit.IsSuccess, credit.IsFailure ? credit.Error.Code : null);
            creditId = credit.Value;
            var note = (await queries.GetAsync(creditId, default))!;
            Assert.Equal(("CreditNote", "INV00701", 100m, 15m, 115m), (note.Kind, note.OriginalInvoiceNo, note.Amount, note.Vat, note.Total));

            // A draft note is simply deleted.
            var debit = await service.CreateNoteAsync(invoiceId, new NoteInput("DebitNote", date, "أيام لم تُفوتر", [new("ServiceFee", null, 40)]), default);
            Assert.True((await service.DeleteAsync(debit.Value, default)).IsSuccess);

            Assert.True((await service.SubmitAsync(creditId, default)).IsSuccess);
        }

        await ApproveNextAsync(tenantId, approver);
        await ApproveNextAsync(tenantId, approver);
        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var queries = scope.ServiceProvider.GetRequiredService<InvoiceQueries>();
            var note = (await queries.GetAsync(creditId, default))!;
            Assert.Equal(("Issued", "CN-2026-00001"), (note.Status, note.InvoiceNo));
            var invoice = (await queries.GetAsync(invoiceId, default))!;
            Assert.Equal((invoice.Amount - 100, invoice.Amount - 100), (invoice.NetAmount, invoice.Creditable));
            Assert.Equal(["CN-2026-00001"], invoice.Notes.Select(n => n.InvoiceNo));
            var list = await queries.ListAsync(september, null, null, null, default);
            Assert.Equal((2, 1, 115m), (list.Rows.Count, list.Totals.Issued, list.Totals.Credits));
        }

        // Collection: the project owes the new invoice (less its credit note) and the old system's open invoice.
        Guid receiptId;
        decimal invoiceTotal;
        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var receipts = scope.ServiceProvider.GetRequiredService<ReceiptService>();
            var queries = scope.ServiceProvider.GetRequiredService<ReceivableQueries>();
            invoiceTotal = (await scope.ServiceProvider.GetRequiredService<InvoiceQueries>().GetAsync(invoiceId, default))!.Total;
            var bank = await receipts.SaveBankAccountAsync(null, new BankAccountInput("مصرف الراجحي", "123456789", "SA03 8000 0000 6080 1016 7519", "الراجحي — الرئيسي", true), default);
            Assert.True(bank.IsSuccess);

            var open = (await queries.OpenAsync(projectId, null, default))!;
            Assert.Equal((2, invoiceTotal - 115 + 1000m), (open.Items.Count, open.Outstanding));
            var opening = open.Items.Single(i => i.Kind == "OpeningBalance");
            Assert.Equal(("INV00650", 1000m, new DateOnly(2026, 8, 1)), (opening.Number, opening.Outstanding, opening.DueDate));
            var invoiceItem = open.Items.Single(i => i.Kind == "Invoice");

            // An allocation above what is left, allocations above the amount, a transfer without its account: refused.
            ReceiptInput Input(decimal amount, string method, Guid? account, params AllocationDto[] allocations) =>
                new(projectId, new DateOnly(2026, 10, 16), amount, method, account, "TRX-7781", null, allocations);
            Assert.Equal("validation.receipt_over_item", (await receipts.CreateAsync(Input(9_000_000, "BankTransfer", bank.Value, new AllocationDto("Invoice", invoiceId, invoiceItem.Outstanding + 1)), default)).Error.Code);
            Assert.Equal("validation.receipt_over_amount", (await receipts.CreateAsync(Input(100, "BankTransfer", bank.Value, new AllocationDto("OpeningBalance", opening.Id, 200)), default)).Error.Code);
            Assert.Equal("validation.receipt_account", (await receipts.CreateAsync(Input(100, "BankTransfer", null), default)).Error.Code);

            // 2,000 received: 1,000 to the old invoice, 500 to the new one, 500 left as the project's credit.
            var made = await receipts.CreateAsync(Input(2000, "BankTransfer", bank.Value, new AllocationDto("OpeningBalance", opening.Id, 1000), new AllocationDto("Invoice", invoiceId, 500)), default);
            Assert.True(made.IsSuccess, made.IsFailure ? made.Error.Code : null);
            receiptId = made.Value;
            Assert.True((await receipts.SubmitAsync(receiptId, default)).IsSuccess);
            Assert.Equal("conflict.receipt_not_editable", (await receipts.DeleteAsync(receiptId, default)).Error.Code);
        }

        await ApproveNextAsync(tenantId, approver);
        await ApproveNextAsync(tenantId, approver);
        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var receipts = scope.ServiceProvider.GetRequiredService<ReceiptService>();
            var queries = scope.ServiceProvider.GetRequiredService<ReceivableQueries>();
            var receipt = (await queries.ReceiptAsync(receiptId, default))!;
            Assert.Equal(("Approved", "RV-2026-00001", 1500m, 500m, true), (receipt.Status, receipt.ReceiptNo, receipt.Allocated, receipt.Unallocated, receipt.CanAllocate));
            var invoice = (await scope.ServiceProvider.GetRequiredService<InvoiceQueries>().GetAsync(invoiceId, default))!;
            Assert.Equal((500m, invoiceTotal - 115 - 500), (invoice.Paid, invoice.Outstanding));
            // The invoice lists the receipt that paid it, with its number and the amount here.
            Assert.Equal([("RV-2026-00001", 500m, "Approved")], invoice.Payments!.Select(x => (x.ReceiptNo!, x.Amount, x.Status)));
            // Each line says what is left on its item: the old invoice settled, the new one still owing.
            var oldLine = receipt.Allocations.Single(x => x.Kind == "OpeningBalance");
            var newLine = receipt.Allocations.Single(x => x.Kind == "Invoice");
            Assert.Equal(((decimal?)1000m, (decimal?)0m), (oldLine.ItemTotal, oldLine.ItemOutstanding));
            Assert.Equal(((decimal?)(invoiceTotal - 115), (decimal?)(invoiceTotal - 115 - 500)), (newLine.ItemTotal, newLine.ItemOutstanding));
            Assert.Equal(500m, (await queries.OpenAsync(projectId, null, default))!.Credit);

            // A draft edited: its allocation replaced, then deleted.
            var draft = await receipts.CreateAsync(new ReceiptInput(projectId, new DateOnly(2026, 10, 17), 100, "Cash", null, null, null, [new AllocationDto("Invoice", invoiceId, 50)]), default);
            Assert.True(draft.IsSuccess, draft.IsFailure ? draft.Error.Code : null);
            Assert.True((await receipts.UpdateAsync(draft.Value, new ReceiptInput(projectId, new DateOnly(2026, 10, 17), 100, "Cash", null, null, null, [new AllocationDto("Invoice", invoiceId, 80)]), default)).IsSuccess);
            Assert.Equal([80m], (await queries.ReceiptAsync(draft.Value, default))!.Allocations.Select(x => x.Amount));
            Assert.True((await receipts.DeleteAsync(draft.Value, default)).IsSuccess);

            // The credit allocated later: by hand (part of it), then the rest oldest due first.
            Assert.Equal("validation.receipt_over_amount", (await receipts.AllocateAsync(receiptId, [new AllocationDto("Invoice", invoiceId, 501)], default)).Error.Code);
            Assert.True((await receipts.AllocateAsync(receiptId, [new AllocationDto("Invoice", invoiceId, 200)], default)).IsSuccess);
            Assert.Equal(300m, (await queries.ReceiptAsync(receiptId, default))!.Unallocated);
            Assert.True((await receipts.AllocateAsync(receiptId, null, default)).IsSuccess);
            Assert.Equal(0m, (await queries.ReceiptAsync(receiptId, default))!.Unallocated);

            // The debts' ages and the project's statement agree.
            var aging = await queries.AgingAsync(new DateOnly(2026, 10, 18), default);
            var row = aging.Rows.Single();
            Assert.Equal((invoiceTotal - 1115, 0m, invoiceTotal - 1115), (row.Total, row.Credit, row.Net));
            Assert.Equal((row.Total, 0m), (row.Current, row.Days30)); // due 2026-10-30 (30 days to pay): not late yet
            var statement = (await queries.StatementAsync(row.ProjectCrmId, new DateOnly(2026, 1, 1), new DateOnly(2026, 12, 31), default))!;
            Assert.Equal(["OpeningBalance", "Invoice", "CreditNote", "Receipt"], statement.Entries.Select(e => e.Kind));
            Assert.Equal((0m, row.Net), (statement.Opening, statement.Closing));
        }
    }

    /// <summary>The approver takes their one open task and approves it.</summary>
    private async Task ApproveNextAsync(Guid tenantId, Guid approver)
    {
        using var scope = database.Scope(tenantId, user: approver.ToString());
        var workflow = scope.ServiceProvider.GetRequiredService<WorkflowDbContext>();
        var task = await workflow.WorkItems.SingleAsync(w => w.AssigneeUserId == approver && w.Status == WorkItemStatus.Pending);
        Assert.True((await scope.ServiceProvider.GetRequiredService<ApprovalEngine>().DecideAsync(task.Id, Decision.Approve, "معتمد", null, default)).IsSuccess);
    }

    /// <summary>Changes the timesheet sheet of an Excel file, as a supervisor would.</summary>
    private static byte[] Edit(byte[] file, Action<ClosedXML.Excel.IXLWorksheet> change)
    {
        using var workbook = new ClosedXML.Excel.XLWorkbook(new MemoryStream(file));
        var ws = workbook.Worksheet("Timesheet");
        ws.Unprotect("ERP-TIMESHEET-V1");
        change(ws);
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private async Task<(Guid Manager, Guid Approver)> PeopleAsync(Guid tenantId)
    {
        using var scope = database.Scope(tenantId, user: "setup");
        var identity = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var catalog = scope.ServiceProvider.GetRequiredService<PermissionCatalog>();
        async Task<Guid> PersonAsync(string name, params string[] permissions)
        {
            var user = UserAccount.Create(name, null);
            identity.Users.Add(user);
            var membership = new Membership(user.Id, tenantId);
            identity.Memberships.Add(membership);
            var role = Role.Create($"r-{Guid.NewGuid():N}"[..20], name, name, ["billing.timesheets.view", "billing.invoices.view", "billing.receipts.view", .. permissions], catalog).Value;
            identity.Roles.Add(role);
            identity.RoleAssignments.Add(new RoleAssignment(membership.Id, role.Id, null, tenantId));
            await identity.SaveChangesAsync();
            return user.Id;
        }

        return (
            await PersonAsync("مشرف المشروع", "billing.timesheets.manage", "billing.invoices.manage", "billing.receipts.manage", "billing.bank_accounts.manage"),
            await PersonAsync("مدير العمليات", "billing.timesheets.approve", "billing.invoices.review", "billing.invoices.approve", "billing.receipts.review", "billing.receipts.approve"));
    }

    private static Guid Worker(FakeCrm crm, string number, int? sponsor) =>
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = $"WORKER {number}", ["new_empidnumber"] = number, ["new_idnumber"] = $"2{number[3..]}00000", ["statuscode"] = 100000000, ["new_employeetype"] = 2,
            ["new_totalsalary"] = 1500m, ["new_basicsalary"] = 1000m, ["new_sponseredby"] = sponsor,
        }, created: Created2025);

    private static void WorkStart(FakeCrm crm, Guid worker, Guid project, string on, decimal price) =>
        crm.Add("new_empwork", new()
        {
            ["new_employeeid"] = worker.ToString(), ["new_projectid"] = project.ToString(), ["new_projectidname"] = "مشروع الرياض",
            ["new_startdate"] = $"{on}T09:00:00Z", ["new_serviceprice"] = price, ["statecode"] = 0, ["new_number"] = $"SW{Guid.NewGuid():N}"[..8],
        }, created: Created2025);

    private async Task SyncAsync(Guid tenantId, FakeCrm crm)
    {
        using var scope = database.Scope(tenantId, user: "crm-sync");
        var db = scope.ServiceProvider.GetRequiredService<CrmSyncDbContext>();
        var sync = ActivatorUtilities.CreateInstance<CrmSyncService>(scope.ServiceProvider, (ICrmSource)crm, Options.Create(new CrmSyncOptions()));
        db.Runs.Add(new SyncRun(SyncMode.Incremental, "test", DateTimeOffset.UtcNow));
        await db.SaveChangesAsync();
        var consumers = scope.ServiceProvider.GetServices<ICrmStagingConsumer>().ToList();
        Assert.True(await sync.RunNextAsync(scope.ServiceProvider.GetRequiredService<ReferenceImportService>(), consumers, default));
    }
}
