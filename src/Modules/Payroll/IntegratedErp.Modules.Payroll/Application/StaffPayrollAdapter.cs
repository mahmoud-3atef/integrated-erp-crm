using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

/// <summary>
/// The staff payroll run as the approval engine sees it: HR, then finance, then management (09 §13). Approved: the run
/// is locked, and what it deducted of the advances, penalties and deductions (and what it deferred) is recorded on them.
/// </summary>
internal sealed class StaffPayrollAdapter(PayrollDbContext db, IStaffDeductions deductions, ICurrentUser user, IClock clock) : IApprovalRecordAdapter
{
    public const string ScreenCode = "payroll.staff";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static object Stage(string id, string ar, string en, string permission) => new
    {
        type = "approval", id, label = ar, nameAr = ar, nameEn = en,
        assignees = new[] { new { kind = "Permission", permission } }, rule = "Any",
    };

    private static readonly string DefaultDefinition = JsonSerializer.Serialize(
        new
        {
            startCondition = (object?)null,
            steps = new[]
            {
                Stage("hr", "الموارد البشرية", "HR", PayrollPermissions.StaffApproveHr),
                Stage("finance", "المالية", "Finance", PayrollPermissions.StaffApproveFinance),
                Stage("management", "الإدارة العليا", "Senior management", PayrollPermissions.StaffApproveManagement),
            },
        },
        JsonOptions);

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "مسيرات رواتب الموظفين",
        "Staff payroll runs",
        "/payroll/staff/{id}",
        [
            new("legal_entity", "السجل التجاري", "Commercial registration", RecordFieldType.Text, Updatable: false),
            new("period", "شهر الحضور", "Attendance month", RecordFieldType.Text, Updatable: false),
            new("employees", "عدد الموظفين", "Number of employees", RecordFieldType.Number, Updatable: false),
            new("basic", "إجمالي الرواتب الأساسية", "Total basic salaries", RecordFieldType.Money, Updatable: false),
            new("deductions", "إجمالي الاستقطاعات", "Total deductions", RecordFieldType.Money, Updatable: false),
            new("net", "صافي الرواتب", "Net pay", RecordFieldType.Money, Updatable: false),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد مسير رواتب الموظفين", "Staff payroll approval", DefaultDefinition));

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var r = await db.StaffRuns.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        return r is null
            ? null
            : new Dictionary<string, string?>
            {
                ["legal_entity"] = r.LegalEntityName,
                ["period"] = r.Period,
                ["employees"] = r.Totals.Employees.ToString(CultureInfo.InvariantCulture),
                ["basic"] = r.Totals.Basic.ToString(CultureInfo.InvariantCulture),
                ["deductions"] = r.Totals.Deductions.ToString(CultureInfo.InvariantCulture),
                ["net"] = r.Totals.Net.ToString(CultureInfo.InvariantCulture),
            };
    }

    public Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("payroll_field_not_settable", "A process cannot change a payroll run.")));

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var run = await db.StaffRuns.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (run is null)
        {
            return Result.Failure(PayrollErrors.NotFound);
        }

        if (run.AwaitingApproval)
        {
            return Result.Success();
        }

        await db.Entry(run).Collection(r => r.Lines).LoadAsync(cancellationToken).ConfigureAwait(false);
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
        var run = await db.StaffRuns.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (run is null || !run.IsInApproval)
        {
            return;
        }

        if (end != ApprovalEnd.Approved)
        {
            run.ApprovalEnded(comment);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return;
        }

        run.Approve(user.DisplayName, comment, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var settlements = await db.StaffItems.AsNoTracking()
            .Where(i => i.RunId == run.Id && i.Kind != StaffItemKind.Addition && i.Kind != StaffItemKind.Deduction)
            .Select(i => new { i.SourceId, i.Kind, i.Deducted, i.Deferred })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        await deductions.RecordAsync(
            run.RunNo,
            settlements.Select(s => new DeductionSettlement(s.SourceId, s.Kind switch
            {
                StaffItemKind.Installment => DeductionItemKind.Installment,
                StaffItemKind.PenaltyDays => DeductionItemKind.PenaltyDays,
                StaffItemKind.PenaltyAmount => DeductionItemKind.PenaltyAmount,
                StaffItemKind.Suspension => DeductionItemKind.Suspension,
                _ => DeductionItemKind.Other,
            }, s.Deducted, s.Deferred)).ToList(),
            cancellationToken).ConfigureAwait(false);
    }
}
