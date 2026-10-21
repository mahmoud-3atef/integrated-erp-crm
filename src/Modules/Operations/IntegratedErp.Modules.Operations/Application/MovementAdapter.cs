using System.Globalization;
using System.Text.Json;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Housing.Contracts;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

/// <summary>
/// Worker movements as the approval engine sees them: the fields a process can test (the movement's type among them,
/// so a company can give each type its own path), the default process (the operations manager approves), and the end:
/// approved ⇒ executed — the worker's period changes in the ledger; when it cannot (the worker moved meanwhile), the
/// movement goes back with the reason.
/// </summary>
internal sealed class MovementAdapter(OperationsDbContext db, IPeriodLedger ledger, IHousingRooms housing, ICurrentUser user, IClock clock) : IApprovalRecordAdapter
{
    public const string ScreenCode = "operations.movement";
    public const string SourceType = "worker_movement";

    /// <summary>The movement's code: the worker's period changes (the movement means nothing without it).</summary>
    public const string Execute = "execute_movement";

    private static readonly (MovementType Type, string Ar, string En)[] Types =
    [
        (MovementType.Arrival, "تأكيد الوصول", "Arrival"),
        (MovementType.VacationDeparture, "مغادرة إجازة", "Vacation departure"),
        (MovementType.VacationReturn, "العودة من الإجازة", "Return from vacation"),
        (MovementType.Absconding, "بلاغ انقطاع", "Absconding report"),
        (MovementType.AbscondingReturn, "عودة بعد انقطاع", "Return after absconding"),
        (MovementType.Suspension, "إيقاف", "Suspension"),
        (MovementType.SuspensionLift, "رفع الإيقاف", "Suspension lifted"),
        (MovementType.FinalExit, "خروج نهائي", "Final exit"),
    ];

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly string DefaultDefinition = JsonSerializer.Serialize(
        new
        {
            startCondition = (object?)null,
            steps = new object[]
            {
                new
                {
                    type = "approval", id = "operations-manager", label = "اعتماد مدير العمليات",
                    nameAr = "اعتماد مدير العمليات", nameEn = "Operations manager's approval",
                    assignees = new[] { new { kind = "Permission", permission = OperationsPermissions.MovementsApprove } }, rule = "Any",
                    onApprove = new object[]
                    {
                        new { type = "action", id = "execute", label = "تنفيذ الإجراء على سجل العامل", action = Execute },
                    },
                },
            },
        },
        JsonOptions);

    public ApprovalScreen Screen { get; } = new(
        ScreenCode,
        "إجراءات العمالة",
        "Worker actions",
        "/operations/movements/{id}",
        [
            new("type", "نوع الإجراء", "Action", RecordFieldType.Choice, Updatable: false, Types.Select(t => new RecordFieldOption(t.Type.ToString(), t.Ar, t.En, Settable: false)).ToList()),
            new("worker_no", "الرقم الوظيفي", "Worker no.", RecordFieldType.Text, Updatable: false),
            new("from_project", "المشروع الحالي", "Current project", RecordFieldType.Text, Updatable: false),
            new("to_project", "المشروع الجديد", "New project", RecordFieldType.Text, Updatable: false),
            new("effective_on", "تاريخ الإجراء", "Action date", RecordFieldType.Date, Updatable: false),
            new("client_vacation", "إجازة على العميل", "Vacation on the customer", RecordFieldType.Boolean, Updatable: false),
            new("special_price", "سعر خاص", "Special price", RecordFieldType.Boolean, Updatable: false),
            new("late", "مسجلة متأخرة", "Registered late", RecordFieldType.Boolean, Updatable: false),
            new("requested_by", "منشئ الإجراء", "Created by", RecordFieldType.User, Updatable: false),
        ],
        DefaultProcess: new DefaultApprovalProcess("اعتماد إجراءات العمالة", "Worker action approval", DefaultDefinition),
        Actions:
        [
            new(
                Execute,
                "تنفيذ الإجراء على سجل العامل",
                "Apply the action to the worker's timeline",
                "تنتهي فترة العامل الحالية وتبدأ فترة الإجراء من تاريخه (سكن، إجازة، انقطاع، إيقاف، خروج، أو عمل على مشروع)، ويخرج من غرفته في السكن إن انقطع أو خرج أو عاد للعمل، وتصبح حالة الإجراء «منفذ». إن تغيّر وضع العامل أو تداخل التاريخ مع فترة أخرى يعود الإجراء لمنشئه.",
                "The worker's current period ends and the action's opens on its date (housing, vacation, absconding, suspension, exit or work on a project); the worker leaves their housing room when absconding, leaving or back to work, and the action is «executed». A changed placement or an overlapping date sends it back to its creator.",
                Required: true),
        ]);

    public static string Title(WorkerMovement m) =>
        $"{m.MovementNo} — {Types.First(t => t.Type == m.Type).Ar} — {m.WorkerNo} {m.WorkerName}";

    public async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var m = await db.Movements.AsNoTracking().FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        return m is null
            ? null
            : new Dictionary<string, string?>
            {
                ["type"] = m.Type.ToString(),
                ["worker_no"] = m.WorkerNo,
                ["from_project"] = m.FromProjectName,
                ["to_project"] = m.ProjectName,
                ["effective_on"] = m.EffectiveOn.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                ["client_vacation"] = m.VacationKind == VacationKind.Client ? "true" : "false",
                ["special_price"] = m.IsSpecialPrice ? "true" : "false",
                ["late"] = m.DelayReason is null ? "false" : "true",
                ["requested_by"] = m.CreatedBy?.ToString(),
            };
    }

    public Task<Result> ApplyAsync(Guid recordId, string? relation, IReadOnlyDictionary<string, string?> changes, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Failure(Error.Validation("movement_field_not_settable", "A process cannot change a worker movement.")));

    public async Task<Result> StartingAsync(Guid recordId, CancellationToken cancellationToken)
    {
        var movement = await db.Movements.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (movement is null)
        {
            return Result.Failure(MovementErrors.NotFound);
        }

        if (movement.AwaitingApproval)
        {
            return Result.Success();
        }

        var marked = movement.MarkSubmitted();
        if (marked.IsFailure)
        {
            return marked;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>
    /// «Apply the action» (the process runs it, by default after the operations manager's approval): the worker's period
    /// changes in the ledger and the movement is executed. Run again on an executed movement, it does nothing; when the
    /// period cannot change (the worker moved meanwhile, or the date overlaps), the movement goes back with the reason.
    /// </summary>
    public async Task<RecordActionResult> RunAsync(Guid recordId, string action, CancellationToken cancellationToken)
    {
        if (action != Execute)
        {
            return RecordActionResult.Failed($"A worker movement has no action \"{action}\".");
        }

        var m = await db.Movements.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (m is null)
        {
            return RecordActionResult.Failed("The movement no longer exists.");
        }

        if (m.Status == MovementStatus.Executed)
        {
            return RecordActionResult.Done;
        }

        if (m.Status != MovementStatus.InApproval)
        {
            return RecordActionResult.Failed("The movement is not in approval.");
        }

        // Executed: the worker's current period closes and the movement's opens on its date.
        var applied = m.OpensPeriod == "Work"
            ? await ledger.StartWorkAsync(
                [new WorkStartRequest(
                    m.WorkerId, m.ProjectId!.Value, m.ProjectCrmId!.Value, m.ProjectName!, m.EffectiveOn, SourceType, m.Id, m.Id, m.MovementNo,
                    m.PackageId, m.PackageNo, m.Salary, m.ServiceFee, m.Housing, m.HousingBillable, m.Transport, m.TransportBillable, m.TotalPrice, m.IsSpecialPrice)],
                cancellationToken).ConfigureAwait(false)
            : await ledger.StartPeriodAsync(
                new PeriodStartRequest(m.WorkerId, m.OpensPeriod, m.EffectiveOn, m.PaySalary, m.Place, SourceType, m.Id, m.MovementNo), cancellationToken).ConfigureAwait(false);
        if (applied.IsFailure)
        {
            return RecordActionResult.SendBack(applied.Error.Code switch
            {
                "conflict.period_overlap" => "لم تُنفَّذ الحركة: للعامل فترة في هذا التاريخ أو بعده في سجل فتراته. عدّل التاريخ وأعد الإرسال.",
                "conflict.period_transition" or "conflict.period_not_work" => "لم تُنفَّذ الحركة: تغيّر وضع العامل منذ إنشائها فلم تعد ممكنة. ألغها وأنشئ الحركة المناسبة.",
                _ => $"لم تُنفَّذ الحركة: {applied.Error.Message}",
            });
        }

        // Out of the company's housing: an absconding worker, a worker leaving for good, or one going back to work.
        if (LeavesHousing(m))
        {
            await housing.ReleaseAsync([m.WorkerId], m.EffectiveOn, cancellationToken).ConfigureAwait(false);
        }

        m.Execute(user.DisplayName, null, clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return RecordActionResult.Done;
    }

    /// <summary>Out of the company's housing from the movement's date: an absconding worker, one leaving for good, or one back to work.</summary>
    internal static bool LeavesHousing(WorkerMovement m) => m.Type is MovementType.Absconding or MovementType.FinalExit || m.OpensPeriod == "Work";

    /// <summary>
    /// The approval ended: a rejection or return sets the movement's state. Approved, the movement was already executed
    /// by its «apply the action» code (the engine runs a required code an older process version lacks before it ends).
    /// </summary>
    public async Task EndedAsync(Guid recordId, ApprovalEnd end, string? comment, CancellationToken cancellationToken)
    {
        var m = await db.Movements.FirstOrDefaultAsync(x => x.Id == recordId, cancellationToken).ConfigureAwait(false);
        if (m is null || m.Status != MovementStatus.InApproval)
        {
            return;
        }

        m.ApprovalEnded(
            end switch
            {
                ApprovalEnd.Rejected => MovementStatus.Rejected,
                _ => MovementStatus.Returned,
            },
            end == ApprovalEnd.Approved ? "انتهى الاعتماد دون تنفيذ الإجراء؛ أعد إرساله." : comment);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
