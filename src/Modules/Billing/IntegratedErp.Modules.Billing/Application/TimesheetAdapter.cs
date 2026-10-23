using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Billing.Application;

/// <summary>
/// The timesheet as the approval engine sees it: the fields a process can test, the default process (the operations
/// manager approves), the action «إنشاء الفاتورة» a process can run at any stage, and the end of the approval:
/// approved ⇒ locked for the invoice, the payroll and the statements.
/// </summary>
internal sealed class TimesheetAdapter(BillingDbContext db, ICurrentUser user, IClock clock, IServiceProvider services) : IApprovalRecordAdapter
{
    public const string ScreenCode = "billing.timesheet";

    /// <summary>Makes the timesheet's invoice (a draft) where the process puts it (the user's request, 2026-10-23).</summary>
    public const string CreateInvoice = "create_invoice";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly string DefaultDefinition = JsonSerializer.Serialize(
        new
        {
            startCondition = (object?)null,
            steps = new object[]
            {
                new
                {
                    type = "approval", id = "approve", label = "اعتماد التحضير",
                    nameAr = "اعتماد التحضير الشهري", nameEn = "Timesheet approval",
                    assignees = new[] { new { kind = "Permission", permission = BillingPermissions.TimesheetsApprove } }, rule = "Any",
                },
            },
        },
        JsonOptions);

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "التحضير الشهري",
        "Monthly timesheets",
        "/billing/timesheets/{id}",
        [
            new("project", "المشروع", "Project", RecordFieldType.Text, Updatable: false),
            new("customer", "العميل", "Customer", RecordFieldType.Text, Updatable: false),
            new("contract_type", "نوع العقد", "Contract type", RecordFieldType.Text, Updatable: false),
            new("month", "الشهر", "Month", RecordFieldType.Date, Updatable: false),
            new("workers", "عدد العمالة", "Number of workers", RecordFieldType.Number, Updatable: false),
            new("invoice_total", "إجمالي الفاتورة قبل الضريبة", "Invoice before VAT", RecordFieldType.Money, Updatable: false),
            new("adjustments", "عدد التعديلات", "Number of adjustments", RecordFieldType.Number, Updatable: false),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد التحضير الشهري", "Timesheet approval", DefaultDefinition),
        Actions:
        [
            new(
                CreateInvoice,
                "إنشاء الفاتورة",
                "Create the invoice",
                "يُنشئ فاتورة التحضير مسودةً بأرقامه (لا تتغير أرقامه وهو قيد الاعتماد)، لتُراجع وتُرسل للاعتماد من صفحتها. إن أُعيد التحضير للتعديل تتبع المسودة تعديلاته.",
                "Makes the timesheet's invoice as a draft with its figures (they cannot change while it is in approval), to be reviewed and sent for approval from its page. If the timesheet is returned for changes, the draft follows them."),
        ]);

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var t = await db.Timesheets.AsNoTracking().Include(x => x.Lines).Include(x => x.Adjustments).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        return t is null
            ? null
            : new Dictionary<string, string?>
            {
                ["project"] = t.ProjectName,
                ["customer"] = t.CustomerName,
                ["contract_type"] = t.ContractType,
                ["month"] = t.Month.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                ["workers"] = t.Lines.Select(l => l.WorkerId).Distinct().Count().ToString(CultureInfo.InvariantCulture),
                ["invoice_total"] = t.Lines.Sum(l => l.InvoiceAmount).ToString(CultureInfo.InvariantCulture),
                ["adjustments"] = t.Adjustments.Count.ToString(CultureInfo.InvariantCulture),
            };
    }

    public Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("timesheet_field_not_settable", "A process cannot change a timesheet.")));

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var timesheet = await db.Timesheets.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (timesheet is null)
        {
            return Result.Failure(TimesheetErrors.NotFound);
        }

        if (timesheet.AwaitingApproval)
        {
            return Result.Success();
        }

        var marked = timesheet.MarkSubmitted(clock.UtcNow);
        if (marked.IsFailure)
        {
            return marked;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>
    /// «إنشاء الفاتورة»: the draft invoice from the timesheet's figures. Idempotent: a timesheet that already has its
    /// invoice (or whose old-system invoice was already sent to the customer) is left as it is.
    /// </summary>
    public async Task<RecordActionResult> RunAsync(Guid recordId, string action, CancellationToken cancellationToken)
    {
        if (action != CreateInvoice)
        {
            return RecordActionResult.Failed($"A timesheet has no action \"{action}\".");
        }

        var timesheet = await db.Timesheets.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (timesheet is null)
        {
            return RecordActionResult.Failed("The timesheet no longer exists.");
        }

        if (timesheet.LegacyIssued || await db.Invoices.AnyAsync(i => i.TimesheetId == recordId, cancellationToken).ConfigureAwait(false))
        {
            return RecordActionResult.Done;
        }

        // Resolved here, not injected: the invoice service starts approvals, and the approval engine holds the adapters.
        var made = await services.GetRequiredService<InvoiceService>().CreateFromTimesheetAsync(recordId, cancellationToken, duringApproval: true).ConfigureAwait(false);
        return made.IsSuccess || made.Error == InvoiceErrors.Exists ? RecordActionResult.Done : RecordActionResult.Failed($"The invoice could not be made: {made.Error.Message}");
    }

    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        var timesheet = await db.Timesheets.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (timesheet is null || !timesheet.IsInApproval)
        {
            return;
        }

        if (end == ApprovalEnd.Approved)
        {
            timesheet.Approve(user.DisplayName, comment, clock.UtcNow);
        }
        else
        {
            // A draft invoice the process made stays: it follows the timesheet's changes until it is sent again.
            timesheet.ApprovalEnded(comment);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
