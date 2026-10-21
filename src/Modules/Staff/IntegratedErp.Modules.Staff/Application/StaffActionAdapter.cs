using System.Globalization;
using System.Text.Json;
using IntegratedErp.Modules.Staff.Domain;
using IntegratedErp.Modules.Staff.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Staff.Application;

/// <summary>
/// The employment action as the approval engine sees it: the fields a process can test (the kind among them, so a
/// process can route a promotion differently from a probation decision), the default process (HR reviews, management
/// approves: 08 §4), and the end: approved ⇒ applied to the file; returned or rejected ⇒ the file unchanged.
/// </summary>
internal sealed class StaffActionAdapter(StaffDbContext db, StaffActionApplier applier) : IApprovalRecordAdapter
{
    public const string ScreenCode = "staff.action";

    /// <summary>The action's code: it is applied to the employee's file.</summary>
    public const string ApplyAction = "apply_action";

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
                    assignees = new[] { new { kind = "Permission", permission = StaffPermissions.ActionsReview } }, rule = "Any",
                },
                new
                {
                    type = "approval", id = "management", label = "اعتماد الإدارة العليا",
                    nameAr = "اعتماد الإدارة العليا", nameEn = "Management approval",
                    assignees = new[] { new { kind = "Permission", permission = StaffPermissions.ActionsApprove } }, rule = "Any",
                    onApprove = new object[]
                    {
                        new { type = "action", id = "apply-action", label = "تطبيق الإجراء على ملف الموظف", action = ApplyAction },
                    },
                },
            },
        },
        JsonOptions);

    private static readonly RecordFieldOption[] Kinds =
    [
        new(nameof(StaffActionKind.Promotion), "ترقية", "Promotion", Settable: false),
        new(nameof(StaffActionKind.Transfer), "نقل", "Transfer", Settable: false),
        new(nameof(StaffActionKind.SalaryChange), "تعديل راتب", "Salary change", Settable: false),
        new(nameof(StaffActionKind.Acting), "تكليف", "Acting", Settable: false),
        new(nameof(StaffActionKind.ConfirmProbation), "تثبيت بعد التجربة", "Confirm after probation", Settable: false),
        new(nameof(StaffActionKind.ExtendProbation), "تمديد التجربة", "Extend probation", Settable: false),
        new(nameof(StaffActionKind.EndProbation), "إنهاء خلال التجربة", "End during probation", Settable: false),
        new(nameof(StaffActionKind.RenewContract), "تجديد العقد", "Contract renewal", Settable: false),
        new(nameof(StaffActionKind.NotRenew), "عدم تجديد العقد", "Contract not renewed", Settable: false),
    ];

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "الإجراءات الوظيفية",
        "Employment actions",
        "/hr/actions/{id}",
        [
            new("kind", "نوع الإجراء", "Action", RecordFieldType.Choice, Updatable: false, Kinds),
            new("employee", "الموظف", "Employee", RecordFieldType.Text, Updatable: false),
            new("effective_from", "تاريخ السريان", "Effective from", RecordFieldType.Date, Updatable: false),
            new("new_salary", "الراتب الجديد", "New salary", RecordFieldType.Money, Updatable: false),
            new("old_salary", "الراتب الحالي", "Current salary", RecordFieldType.Money, Updatable: false),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد الإجراءات الوظيفية", "Employment actions approval", DefaultDefinition),
        Actions:
        [
            new(
                ApplyAction,
                "تطبيق الإجراء على ملف الموظف",
                "Apply the action to the employee's file",
                "يتغيّر ملف الموظف بما في الإجراء (الوظيفة والإدارة، أو الراتب من تاريخ السريان، أو التكليف، أو التجربة، أو العقد، أو انتهاء الخدمة)، ويُحفظ ما كان عليه قبله، وتصبح حالة الإجراء «مطبَّق».",
                "The employee's file changes as the action says (job and department, salary from its effective day, acting, probation, contract, or the end of employment); the file before it is kept, and the action is «applied».",
                Required: true),
        ]);

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var a = await db.Actions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        return a is null
            ? null
            : new Dictionary<string, string?>
            {
                ["kind"] = a.Kind.ToString(),
                ["employee"] = a.EmployeeName,
                ["effective_from"] = a.EffectiveFrom.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                ["new_salary"] = a.NewSalary is { } s ? (s.Basic + s.Housing + s.Food + s.Transport + s.Mobile + s.Project + s.Other).ToString(CultureInfo.InvariantCulture) : null,
                ["old_salary"] = a.OldSalaryTotal?.ToString(CultureInfo.InvariantCulture),
            };
    }

    public Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("staff_action_field_not_settable", "A process cannot change an employment action.")));

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var action = await db.Actions.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (action is null)
        {
            return Result.Failure(StaffErrors.ActionNotFound);
        }

        if (action.AwaitingApproval)
        {
            return Result.Success();
        }

        var marked = action.MarkSubmitted(DateTimeOffset.UtcNow);
        if (marked.IsFailure)
        {
            return marked;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>«Apply the action» (the process runs it, by default on management's approval). Run again on an applied one, it does nothing.</summary>
    public async Task<RecordActionResult> RunAsync(Guid recordId, string action, CancellationToken cancellationToken)
    {
        if (action != ApplyAction)
        {
            return RecordActionResult.Failed($"An employment action has no action \"{action}\".");
        }

        var record = await db.Actions.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (record is null)
        {
            return RecordActionResult.Failed("The employment action no longer exists.");
        }

        if (record.Status == StaffActionStatus.Applied)
        {
            return RecordActionResult.Done;
        }

        if (!record.IsInApproval)
        {
            return RecordActionResult.Failed("The employment action is not in approval.");
        }

        await applier.ApplyAsync(record, null, cancellationToken).ConfigureAwait(false);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return RecordActionResult.Done;
    }

    /// <summary>The approval ended: a rejection or return sets the state; approved, its code already applied it.</summary>
    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        var action = await db.Actions.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (action is null || !action.IsInApproval)
        {
            return;
        }

        action.Ended(end == ApprovalEnd.Rejected, end == ApprovalEnd.Approved ? "انتهى الاعتماد دون تطبيق الإجراء؛ أعد إرساله." : comment);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
