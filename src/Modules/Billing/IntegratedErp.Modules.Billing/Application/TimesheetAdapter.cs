using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Billing.Domain;
using IntegratedErp.Modules.Billing.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Billing.Application;

/// <summary>
/// The timesheet as the approval engine sees it: the fields a process can test, the default process (the operations
/// manager approves), and the end of the approval: approved ⇒ locked for the invoice, the payroll and the statements.
/// </summary>
internal sealed class TimesheetAdapter(BillingDbContext db, ICurrentUser user, IClock clock) : IApprovalRecordAdapter
{
    public const string ScreenCode = "billing.timesheet";

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
        DefaultProcess: new DefaultApprovalProcess("اعتماد التحضير الشهري", "Timesheet approval", DefaultDefinition));

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
            timesheet.ApprovalEnded(comment);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
