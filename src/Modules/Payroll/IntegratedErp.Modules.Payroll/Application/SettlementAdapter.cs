using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Deductions.Contracts;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

/// <summary>
/// A settlement as the approval engine sees it: HR, then payroll, then finance (docs/03-migration-plan/18). Approved: it
/// is locked; what it took of the advances, penalties and deductions is recorded on them; an end of service closes the
/// employee's file on its last day.
/// </summary>
internal sealed class SettlementAdapter(PayrollDbContext db, IStaffDeductions deductions, IStaffPayroll staff, ICurrentUser user, IClock clock) : IApprovalRecordAdapter
{
    public const string ScreenCode = "payroll.settlement";

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
                Stage("hr", "الموارد البشرية", "HR", PayrollPermissions.SettlementsApproveHr),
                Stage("payroll", "الرواتب", "Payroll", PayrollPermissions.SettlementsApprovePayroll),
                Stage("finance", "المالية", "Finance", PayrollPermissions.SettlementsApproveFinance),
            },
        },
        JsonOptions);

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "المخالصات",
        "Settlements",
        "/hr/settlements/{id}",
        [
            new("kind", "نوع المخالصة", "Settlement kind", RecordFieldType.Text, Updatable: false),
            new("employee", "الموظف", "Employee", RecordFieldType.Text, Updatable: false),
            new("additions", "إجمالي المستحقات", "Total due", RecordFieldType.Money, Updatable: false),
            new("deductions", "إجمالي المستقطعات", "Total deductions", RecordFieldType.Money, Updatable: false),
            new("net", "الصافي", "Net", RecordFieldType.Money, Updatable: false),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد المخالصات", "Settlement approval", DefaultDefinition));

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var s = await db.Settlements.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        return s is null
            ? null
            : new Dictionary<string, string?>
            {
                ["kind"] = s.Kind == SettlementKind.Vacation ? "مخالصة إجازة سنوية" : "مخالصة نهاية خدمة",
                ["employee"] = $"{s.PersonNo} — {s.Name}",
                ["additions"] = s.TotalAdditions.ToString(CultureInfo.InvariantCulture),
                ["deductions"] = s.TotalDeductions.ToString(CultureInfo.InvariantCulture),
                ["net"] = s.Net.ToString(CultureInfo.InvariantCulture),
            };
    }

    public Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("settlement_field_not_settable", "A process cannot change a settlement.")));

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var s = await db.Settlements.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (s is null)
        {
            return Result.Failure(SettlementErrors.NotFound);
        }

        if (s.AwaitingApproval)
        {
            return Result.Success();
        }

        var marked = s.MarkSubmitted(clock.UtcNow);
        if (marked.IsFailure)
        {
            return marked;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        var s = await db.Settlements.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (s is null || !s.IsInApproval)
        {
            return;
        }

        if (end != ApprovalEnd.Approved)
        {
            s.ApprovalEnded(comment);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return;
        }

        s.Approve(user.DisplayName, comment, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await deductions.RecordAsync(
            s.SettlementNo,
            s.Lines.Where(l => l.SourceId is not null && l.SourceKind is not null)
                .Select(l => new DeductionSettlement(l.SourceId!.Value, l.SourceKind!.Value, l.Amount, false)).ToList(),
            cancellationToken).ConfigureAwait(false);
        if (s.Kind == SettlementKind.EndOfService && s.Party == SettlementParty.Staff)
        {
            await staff.EndEmploymentAsync(s.PersonId, s.LastDay, cancellationToken).ConfigureAwait(false);
        }
    }
}
