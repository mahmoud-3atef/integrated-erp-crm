using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Housing.Contracts;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Numbering;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Operations.Domain;
using IntegratedErp.Modules.Operations.Infrastructure;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Operations.Application;

public sealed record MovementInput(
    string Type,
    Guid WorkerId,
    DateOnly EffectiveOn,
    DateOnly? ExpectedReturnOn,
    string? VacationKind,
    string? ReturnTo,
    Guid? ProjectId,
    decimal? SpecialPrice,
    string? SpecialReason,
    bool PaySalary,
    string? SuspensionReason,
    string? ExitKind,
    string? Place,
    string? DelayReason,
    string? Notes);

public sealed record SavedMovementDto(Guid Id, string? SubmitError);

/// <summary>What may change on an executed movement: its date, the expected return (a vacation), the place and notes, with the reason.</summary>
public sealed record MovementAmendInput(DateOnly EffectiveOn, DateOnly? ExpectedReturnOn, string? Place, string? Notes, string AmendReason);

/// <summary>The movements a worker can have now, from where they are, and what a return to work would cost.</summary>
public sealed record MovementOptionsDto(
    WorkerCard Worker,
    IReadOnlyList<string> Allowed,
    string? BusyWith,
    Guid? PreviousProjectId,
    string? PreviousProjectName,
    decimal? PreviousPrice);

/// <summary>A project's price for a worker back from vacation: the package of their profession and nationality.</summary>
public sealed record MovementQuoteDto(Guid ProjectId, string ProjectName, string? PackageNo, decimal Salary, decimal ServiceFee, decimal Housing, decimal Transport, decimal? TotalPrice);

/// <summary>
/// Worker movements (docs/02-target-architecture/05 §2): arrival, vacation and return, absconding and return,
/// suspension and its lifting, final exit. Each is checked against where the worker is (the period opened here, else
/// the old system's status), numbered per type, and sent through the company's approval process at once.
/// </summary>
internal sealed class MovementService(
    OperationsDbContext db,
    IWorkforceDirectory workforce,
    IPeriodLedger ledger,
    IProjectDirectory projects,
    DeliveryOrderService delivery,
    IApprovalService approvals,
    NumberSequenceService numbering,
    IHousingRooms housing,
    IPermissionService permissions,
    ICurrentUser user,
    IClock clock)
{
    /// <summary>Where a worker must be for each movement (the worker card's placement).</summary>
    internal static readonly Dictionary<MovementType, string[]> AllowedFrom = new()
    {
        [MovementType.Arrival] = ["New"],
        [MovementType.VacationDeparture] = ["Working", "Housing"],
        [MovementType.VacationReturn] = ["Vacation"],
        [MovementType.Absconding] = ["Working", "Housing", "Vacation"],
        [MovementType.AbscondingReturn] = ["Absconded"],
        [MovementType.Suspension] = ["Working", "Housing"],
        [MovementType.SuspensionLift] = ["Suspended"],
        [MovementType.FinalExit] = ["Working", "Housing", "Vacation", "Absconded", "Suspended", "New", "Other"],
    };

    /// <summary>Each type's number series on the numbering screen.</summary>
    internal static string SequenceOf(MovementType type) => type switch
    {
        MovementType.Arrival => "movement_arrival",
        MovementType.VacationDeparture => "movement_vacation_departure",
        MovementType.VacationReturn => "movement_vacation_return",
        MovementType.Absconding => "movement_absconding",
        MovementType.AbscondingReturn => "movement_absconding_return",
        MovementType.Suspension => "movement_suspension",
        MovementType.SuspensionLift => "movement_suspension_lift",
        _ => "movement_exit",
    };

    public async Task<MovementOptionsDto?> OptionsAsync(Guid workerId, Guid? exceptMovementId, CancellationToken cancellationToken)
    {
        var card = await workforce.CardsAsync([workerId], cancellationToken).ConfigureAwait(false) is [var c, ..] ? c : null;
        if (card is null)
        {
            return null;
        }

        var allowed = AllowedFrom.Where(a => a.Value.Contains(card.Placement)).Select(a => a.Key.ToString()).ToList();
        var busy = await BusyAsync(workerId, exceptMovementId, cancellationToken).ConfigureAwait(false);
        var previous = await PreviousWorkAsync(workerId, cancellationToken).ConfigureAwait(false);
        return new MovementOptionsDto(card, allowed, busy, previous?.Project.Id, previous?.Project.Name, previous?.Price);
    }

    public async Task<Result<MovementQuoteDto>> QuoteAsync(Guid workerId, Guid projectId, DateOnly on, CancellationToken cancellationToken)
    {
        var priced = await delivery.PriceAsync(projectId, [workerId], on, null, cancellationToken).ConfigureAwait(false);
        if (priced.IsFailure || priced.Value.Count == 0)
        {
            return Result.Failure<MovementQuoteDto>(MovementErrors.Project);
        }

        var q = priced.Value[0];
        var project = (await projects.FindAsync([projectId], [], cancellationToken).ConfigureAwait(false))[0];
        return Result.Success(new MovementQuoteDto(projectId, project.Name, q.PackageNo, q.Salary, q.ServiceFee, q.Housing, q.Transport, q.TotalPrice));
    }

    public async Task<Result<SavedMovementDto>> CreateAsync(MovementInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!Enum.TryParse<MovementType>(input.Type, out var type))
        {
            return Result.Failure<SavedMovementDto>(MovementErrors.Type);
        }

        var built = await BuildAsync(null, type, input, cancellationToken).ConfigureAwait(false);
        if (built.IsFailure)
        {
            return Result.Failure<SavedMovementDto>(built.Error);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var number = await numbering.NextNumberAsync(db, SequenceOf(type), clock.Today, cancellationToken).ConfigureAwait(false);
        var movement = WorkerMovement.Create(number, type, built.Value.Worker, built.Value.Details, Guid.TryParse(user.UserId, out var by) ? by : null, user.DisplayName, clock.UtcNow);
        db.Movements.Add(movement);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        var started = await SubmitAsync(movement.Id, cancellationToken).ConfigureAwait(false);
        return Result.Success(new SavedMovementDto(movement.Id, started.IsFailure ? started.Error.Code : null));
    }

    /// <summary>Changes a returned movement and sends it again.</summary>
    public async Task<Result<SavedMovementDto>> UpdateAsync(Guid id, MovementInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var movement = await db.Movements.FirstOrDefaultAsync(m => m.Id == id, cancellationToken).ConfigureAwait(false);
        if (movement is null)
        {
            return Result.Failure<SavedMovementDto>(MovementErrors.NotFound);
        }

        if (input.WorkerId != movement.WorkerId)
        {
            return Result.Failure<SavedMovementDto>(MovementErrors.Worker);
        }

        var built = await BuildAsync(id, movement.Type, input, cancellationToken).ConfigureAwait(false);
        if (built.IsFailure)
        {
            return Result.Failure<SavedMovementDto>(built.Error);
        }

        var updated = movement.Update(built.Value.Details);
        if (updated.IsFailure)
        {
            return Result.Failure<SavedMovementDto>(updated.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var started = await SubmitAsync(movement.Id, cancellationToken).ConfigureAwait(false);
        return Result.Success(new SavedMovementDto(movement.Id, started.IsFailure ? started.Error.Code : null));
    }

    public async Task<Result> SubmitAsync(Guid id, CancellationToken cancellationToken)
    {
        var movement = await db.Movements.FirstOrDefaultAsync(m => m.Id == id, cancellationToken).ConfigureAwait(false);
        if (movement is null)
        {
            return Result.Failure(MovementErrors.NotFound);
        }

        var marked = movement.MarkSubmitted();
        if (marked.IsFailure)
        {
            return marked;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var started = await approvals.SubmitAsync(new ApprovalSubmission(MovementAdapter.ScreenCode, movement.Id, MovementAdapter.Title(movement)), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            movement.SubmissionFailed();
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure(started.Error);
        }

        return Result.Success();
    }

    /// <summary>
    /// Changes an executed movement (its type's own permission and a reason): its date (the period it opened moves, the
    /// one before it ends that day, never overlapping), the expected return of a vacation, the place and the notes.
    /// </summary>
    public async Task<Result> AmendAsync(Guid id, MovementAmendInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        var m = await db.Movements.FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);
        if (m is null)
        {
            return Result.Failure(MovementErrors.NotFound);
        }

        if (!(await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(OperationsPermissions.MovementAmend(m.Type)))
        {
            return Result.Failure(MovementErrors.TypeForbidden);
        }

        if (!m.IsAmendable)
        {
            return Result.Failure(MovementErrors.NotAmendable);
        }

        if (string.IsNullOrWhiteSpace(input.AmendReason))
        {
            return Result.Failure(MovementErrors.AmendReason);
        }

        var place = m.OpensPeriod == "Work" ? null : input.Place;
        if (input.EffectiveOn != m.EffectiveOn || place != m.Place)
        {
            var moved = await ledger.AmendAsync(new PeriodAmendRequest(m.WorkerId, m.Id, input.EffectiveOn, m.PaySalary, place, m.MovementNo), cancellationToken).ConfigureAwait(false);
            if (moved.IsFailure)
            {
                return Result.Failure(moved.Error.Code == "conflict.period_locked" ? MovementErrors.PeriodLocked : moved.Error.Code == "conflict.period_overlap" ? MovementErrors.PeriodOverlap : moved.Error);
            }
        }

        var amended = m.Amend(input.EffectiveOn, input.ExpectedReturnOn, input.Place, input.Notes, input.AmendReason, user.DisplayName, clock.UtcNow);
        if (amended.IsFailure)
        {
            return amended;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>
    /// Cancels an executed movement (its type's own permission and a reason): the period it opened is taken back — only
    /// when the worker has no action after it — the one before it is open again, and a worker who left their housing room
    /// with it goes back to it.
    /// </summary>
    public async Task<Result> CancelApprovedAsync(Guid id, string? reason, CancellationToken cancellationToken)
    {
        var m = await db.Movements.FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);
        if (m is null)
        {
            return Result.Failure(MovementErrors.NotFound);
        }

        if (!(await permissions.GetCurrentAsync(cancellationToken).ConfigureAwait(false)).Has(OperationsPermissions.MovementCancelApproved(m.Type)))
        {
            return Result.Failure(MovementErrors.TypeForbidden);
        }

        if (!m.IsAmendable)
        {
            return Result.Failure(MovementErrors.NotAmendable);
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            return Result.Failure(MovementErrors.AmendReason);
        }

        var undone = await ledger.UndoAsync(m.WorkerId, m.Id, cancellationToken).ConfigureAwait(false);
        if (undone.IsFailure)
        {
            return Result.Failure(undone.Error.Code == "conflict.period_locked" ? MovementErrors.PeriodLocked : undone.Error.Code == "conflict.period_not_last" ? MovementErrors.LaterPeriod : undone.Error);
        }

        if (MovementAdapter.LeavesHousing(m))
        {
            await housing.ReopenAsync([m.WorkerId], m.EffectiveOn, cancellationToken).ConfigureAwait(false);
        }

        var canceled = m.CancelApproved(reason, user.DisplayName, clock.UtcNow);
        if (canceled.IsFailure)
        {
            return canceled;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<Result> CancelAsync(Guid id, string? comment, CancellationToken cancellationToken)
    {
        var movement = await db.Movements.FirstOrDefaultAsync(m => m.Id == id, cancellationToken).ConfigureAwait(false);
        if (movement is null)
        {
            return Result.Failure(MovementErrors.NotFound);
        }

        var canceled = movement.Cancel(comment);
        if (canceled.IsFailure)
        {
            return canceled;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    /// <summary>The open movement or order already holding the worker (its number), if any: a worker moves once at a time.</summary>
    internal async Task<string?> BusyAsync(Guid workerId, Guid? exceptMovementId, CancellationToken cancellationToken)
    {
        var movement = await db.Movements.AsNoTracking()
            .Where(m => m.WorkerId == workerId && m.Id != exceptMovementId && (m.Status == MovementStatus.InApproval || m.Status == MovementStatus.Returned))
            .Select(m => m.MovementNo).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        return movement ?? (await TransferOrderService.BusyAsync(db, null, [workerId], cancellationToken).ConfigureAwait(false)).GetValueOrDefault(workerId);
    }

    /// <summary>The worker's last project (work or a vacation on the customer), here or in the old system, and its price.</summary>
    private async Task<(ProjectInfo Project, decimal? Price)?> PreviousWorkAsync(Guid workerId, CancellationToken cancellationToken)
    {
        var periods = await ledger.PeriodsAsync(workerId, cancellationToken).ConfigureAwait(false);
        var last = periods.FirstOrDefault(p => p.Kind is "Work" or "ClientVacation" && p.ProjectCrmId is not null);
        if (last is null)
        {
            return null;
        }

        var project = await projects.FindAsync([], [last.ProjectCrmId!.Value], cancellationToken).ConfigureAwait(false) is [var p, ..] ? p : null;
        return project is null ? null : (project, last.TotalPrice);
    }

    private async Task<Result<(MovementWorker Worker, MovementDetails Details)>> BuildAsync(Guid? movementId, MovementType type, MovementInput input, CancellationToken cancellationToken)
    {
        var options = await OptionsAsync(input.WorkerId, movementId, cancellationToken).ConfigureAwait(false);
        if (options is null)
        {
            return Fail(MovementErrors.Worker);
        }

        var card = options.Worker;

        // A returned movement was valid when made: the worker has not moved since (they could not: it held them).
        var editing = movementId is not null;
        if (!editing && !options.Allowed.Contains(type.ToString()))
        {
            return Fail(MovementErrors.NotAllowed);
        }

        if (options.BusyWith is not null)
        {
            return Fail(MovementErrors.Busy);
        }

        if (input.EffectiveOn < clock.Today.AddDays(-DeliveryOrderService.DelayDays) && string.IsNullOrWhiteSpace(input.DelayReason))
        {
            return Fail(MovementErrors.DelayReason);
        }

        if (await PeriodRules.EarliestStartAsync(ledger, input.WorkerId, movementId, cancellationToken).ConfigureAwait(false) is { } earliest && input.EffectiveOn < earliest)
        {
            return Fail(MovementErrors.BeforeLastPeriod);
        }

        VacationKind? vacation = null;
        ReturnTarget? returnTo = null;
        MovementWork? work = null;
        SuspensionReason? suspension = null;
        ExitKind? exit = null;
        DateOnly? expected = null;
        switch (type)
        {
            case MovementType.VacationDeparture:
                if (!Enum.TryParse<VacationKind>(input.VacationKind, out var v))
                {
                    return Fail(MovementErrors.Reason);
                }

                if (v == VacationKind.Client && card.Placement != "Working" && !editing)
                {
                    return Fail(MovementErrors.ClientVacationNotWorking);
                }

                if (input.ExpectedReturnOn is { } back && back <= input.EffectiveOn)
                {
                    return Fail(MovementErrors.ExpectedReturn);
                }

                (vacation, expected) = (v, input.ExpectedReturnOn);
                break;
            case MovementType.VacationReturn:
                if (!Enum.TryParse<ReturnTarget>(input.ReturnTo, out var target))
                {
                    return Fail(MovementErrors.ReturnTo);
                }

                returnTo = target;
                if (target != ReturnTarget.Housing)
                {
                    var projectId = target == ReturnTarget.SameProject ? options.PreviousProjectId : input.ProjectId;
                    if (projectId is null)
                    {
                        return Fail(target == ReturnTarget.SameProject ? MovementErrors.NoPreviousProject : MovementErrors.Project);
                    }

                    // Back to the same project: at the price they had there, unless a special price is given.
                    var keep = target == ReturnTarget.SameProject ? options.PreviousPrice : null;
                    var priced = await PriceAsync(projectId.Value, input, keep, cancellationToken).ConfigureAwait(false);
                    if (priced.IsFailure)
                    {
                        return Fail(priced.Error);
                    }

                    work = priced.Value;
                }

                break;
            case MovementType.Suspension:
                if (!Enum.TryParse<SuspensionReason>(input.SuspensionReason, out var s))
                {
                    return Fail(MovementErrors.Reason);
                }

                suspension = s;
                break;
            case MovementType.FinalExit:
                if (!Enum.TryParse<ExitKind>(input.ExitKind, out var e))
                {
                    return Fail(MovementErrors.Reason);
                }

                exit = e;
                break;
        }

        // Pay in housing is a choice only where the movement opens a housing period.
        var housing = type is MovementType.Arrival or MovementType.AbscondingReturn or MovementType.SuspensionLift
                      || (type == MovementType.VacationReturn && returnTo == ReturnTarget.Housing);
        var worker = new MovementWorker(card.Id, card.WorkerNo, card.Name, card.IqamaNo, card.Placement, card.ProjectCrmId, card.ProjectName);
        var details = new MovementDetails(
            input.EffectiveOn, expected, vacation, returnTo, work, housing && input.PaySalary, suspension, exit, input.Place, input.DelayReason, input.Notes);
        return Result.Success((worker, details));

        static Result<(MovementWorker, MovementDetails)> Fail(Error error) => Result.Failure<(MovementWorker, MovementDetails)>(error);
    }

    /// <summary>
    /// The worker's price on the project: a special price with its reason, else the price kept from before (back to the
    /// same project), else the package's — as on a delivery order.
    /// </summary>
    private async Task<Result<MovementWork>> PriceAsync(Guid projectId, MovementInput input, decimal? keep, CancellationToken cancellationToken)
    {
        var project = await projects.FindAsync([projectId], [], cancellationToken).ConfigureAwait(false) is [var p, ..] ? p : null;
        if (project is null || !project.IsActive)
        {
            return Result.Failure<MovementWork>(MovementErrors.Project);
        }

        var priced = await delivery.PriceAsync(project.Id, [input.WorkerId], input.EffectiveOn, null, cancellationToken).ConfigureAwait(false);
        if (priced.IsFailure || priced.Value.Count == 0)
        {
            return Result.Failure<MovementWork>(MovementErrors.Project);
        }

        var quote = priced.Value[0];
        var regular = keep ?? quote.TotalPrice;
        var special = input.SpecialPrice is { } price && price != regular;
        if (!special && regular is null)
        {
            return Result.Failure<MovementWork>(MovementErrors.NoPrice);
        }

        if (special && string.IsNullOrWhiteSpace(input.SpecialReason))
        {
            return Result.Failure<MovementWork>(MovementErrors.SpecialReason);
        }

        var total = special ? input.SpecialPrice!.Value : regular!.Value;
        if (total < DeliveryOrderService.MinimumServicePrice)
        {
            return Result.Failure<MovementWork>(MovementErrors.Minimum);
        }

        var fee = total - quote.Salary - quote.Housing - quote.Transport;
        if (fee < 0)
        {
            return Result.Failure<MovementWork>(MovementErrors.BelowCost);
        }

        return Result.Success(new MovementWork(
            project.Id, project.CrmId, project.Name, quote.PackageId, quote.PackageNo, quote.Salary, fee, quote.Housing, quote.HousingBillable,
            quote.Transport, quote.TransportBillable, special, special ? input.SpecialReason!.Trim() : null));
    }
}
