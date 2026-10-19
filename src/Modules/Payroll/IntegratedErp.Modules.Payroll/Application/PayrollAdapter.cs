using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

/// <summary>
/// The payroll run as the approval engine sees it: the fields a process can test, the default process (HR reviews,
/// finance approves, then management: 09 §13), and the end: approved ⇒ locked; returned or rejected ⇒ open again.
/// </summary>
internal sealed class PayrollAdapter(PayrollDbContext db, ICurrentUser user, IClock clock) : IApprovalRecordAdapter
{
    public const string ScreenCode = "payroll.run";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly string DefaultDefinition = JsonSerializer.Serialize(
        new
        {
            startCondition = (object?)null,
            steps = new object[]
            {
                new
                {
                    type = "approval", id = "hr-review", label = "مراجعة الموارد البشرية",
                    nameAr = "مراجعة الموارد البشرية", nameEn = "HR review",
                    assignees = new[] { new { kind = "Permission", permission = PayrollPermissions.WorkersReview } }, rule = "Any",
                },
                new
                {
                    type = "approval", id = "finance", label = "الاعتماد المالي",
                    nameAr = "الاعتماد المالي", nameEn = "Finance approval",
                    assignees = new[] { new { kind = "Permission", permission = PayrollPermissions.WorkersFinance } }, rule = "Any",
                },
                new
                {
                    type = "approval", id = "management", label = "اعتماد الإدارة العليا",
                    nameAr = "اعتماد الإدارة العليا", nameEn = "Management approval",
                    assignees = new[] { new { kind = "Permission", permission = PayrollPermissions.WorkersApprove } }, rule = "Any",
                },
            },
        },
        JsonOptions);

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "مسيرات رواتب العمالة",
        "Workers' payroll runs",
        "/payroll/runs/{id}",
        [
            new("legal_entity", "السجل التجاري", "Commercial registration", RecordFieldType.Text, Updatable: false),
            new("from", "بداية الفترة", "Period start", RecordFieldType.Date, Updatable: false),
            new("to", "نهاية الفترة", "Period end", RecordFieldType.Date, Updatable: false),
            new("workers", "عدد العمال", "Number of workers", RecordFieldType.Number, Updatable: false),
            new("excluded", "المستبعدون", "Workers left out", RecordFieldType.Number, Updatable: false),
            new("base", "إجمالي الرواتب الأساسية", "Total basic salaries", RecordFieldType.Money, Updatable: false),
            new("allowances", "إجمالي البدلات", "Total allowances", RecordFieldType.Money, Updatable: false),
            new("deductions", "إجمالي الاستقطاعات", "Total deductions", RecordFieldType.Money, Updatable: false),
            new("net", "صافي الرواتب", "Net pay", RecordFieldType.Money, Updatable: false),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد مسير رواتب العمالة", "Workers' payroll approval", DefaultDefinition));

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var r = await db.Runs.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        return r is null
            ? null
            : new Dictionary<string, string?>
            {
                ["legal_entity"] = r.LegalEntityName,
                ["from"] = r.From.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                ["to"] = r.To.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                ["workers"] = r.Totals.Workers.ToString(CultureInfo.InvariantCulture),
                ["excluded"] = r.Totals.Excluded.ToString(CultureInfo.InvariantCulture),
                ["base"] = r.Totals.Base.ToString(CultureInfo.InvariantCulture),
                ["allowances"] = r.Totals.Allowances.ToString(CultureInfo.InvariantCulture),
                ["deductions"] = r.Totals.Deductions.ToString(CultureInfo.InvariantCulture),
                ["net"] = r.Totals.Net.ToString(CultureInfo.InvariantCulture),
            };
    }

    public Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("payroll_field_not_settable", "A process cannot change a payroll run.")));

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var run = await db.Runs.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (run is null)
        {
            return Result.Failure(PayrollErrors.NotFound);
        }

        if (run.AwaitingApproval)
        {
            return Result.Success();
        }

        // Started by an administrator on an open run: it has to have workers.
        var marked = run.MarkSubmitted(clock.UtcNow);
        if (marked.IsFailure)
        {
            return marked;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        var run = await db.Runs.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (run is null || !run.IsInApproval)
        {
            return;
        }

        if (end == ApprovalEnd.Approved)
        {
            run.Approve(user.DisplayName, comment, clock.UtcNow);
        }
        else
        {
            run.ApprovalEnded(comment);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
