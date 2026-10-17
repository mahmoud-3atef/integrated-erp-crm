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

public sealed record ReturnInput(
    Guid WorkerId,
    DateOnly ArrivedOn,
    string Reason,
    string? ReasonNotes,
    bool StopSalary,
    string? HousingName,
    string? DelayReason,
    string? Notes);

/// <summary>A worker on the job for the return form, with the open return order that already has them (if any).</summary>
public sealed record OnJobWorkerDto(WorkerCard Worker, string? BusyOrderNo);

/// <summary>
/// Return orders written in this system: a worker on the job back to housing. Saved under preparation and sent through
/// the company's approval process at once (the creator's confirmation comes first).
/// </summary>
internal sealed class ReturnOrderService(
    OperationsDbContext db,
    IWorkforceDirectory workforce,
    IProjectDirectory projects,
    IApprovalService approvals,
    NumberSequenceService numbering,
    ICurrentUser user,
    IClock clock)
{
    private static readonly ReturnStatus[] Open =
        [ReturnStatus.UnderPreparation, ReturnStatus.SentToSales, ReturnStatus.SentToOperationsManager, ReturnStatus.InApproval, ReturnStatus.Returned];

    public async Task<IReadOnlyList<OnJobWorkerDto>> OnJobAsync(Guid? exceptOrderId, CancellationToken cancellationToken)
    {
        var cards = await workforce.OnJobAsync(cancellationToken).ConfigureAwait(false);
        var busy = await BusyAsync(exceptOrderId, cards.Select(c => c.Id).ToList(), cancellationToken).ConfigureAwait(false);
        return cards.Select(c => new OnJobWorkerDto(c, busy.GetValueOrDefault(c.Id))).ToList();
    }

    public async Task<Result<SavedOrderDto>> CreateAsync(ReturnInput input, CancellationToken cancellationToken)
    {
        var built = await BuildAsync(null, input, cancellationToken).ConfigureAwait(false);
        if (built.IsFailure)
        {
            return Result.Failure<SavedOrderDto>(built.Error);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        var value = await numbering.NextAsync(db, new NumberRequest("return_order", Period: clock.Today.Year), cancellationToken).ConfigureAwait(false);
        var order = ReturnOrder.Create(
            DocumentNumberFormat.Format("RT-{YYYY}-{N:5}", value, clock.Today), built.Value.Worker, built.Value.Details,
            Guid.TryParse(user.UserId, out var userId) ? userId : null, user.DisplayName, clock.UtcNow);
        db.ReturnOrders.Add(order);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        var started = await SubmitAsync(order.Id, cancellationToken).ConfigureAwait(false);
        return Result.Success(new SavedOrderDto(order.Id, started.IsFailure ? started.Error.Code : null));
    }

    public async Task<Result<SavedOrderDto>> UpdateAsync(Guid id, ReturnInput input, CancellationToken cancellationToken)
    {
        var order = await db.ReturnOrders.FirstOrDefaultAsync(o => o.Id == id, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<SavedOrderDto>(ReturnErrors.NotFound);
        }

        var built = await BuildAsync(id, input, cancellationToken).ConfigureAwait(false);
        if (built.IsFailure)
        {
            return Result.Failure<SavedOrderDto>(built.Error);
        }

        var updated = order.Update(built.Value.Worker, built.Value.Details);
        if (updated.IsFailure)
        {
            return Result.Failure<SavedOrderDto>(updated.Error);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        if (order.AwaitingApproval)
        {
            return Result.Success(new SavedOrderDto(order.Id, null));
        }

        var started = await SubmitAsync(order.Id, cancellationToken).ConfigureAwait(false);
        return Result.Success(new SavedOrderDto(order.Id, started.IsFailure ? started.Error.Code : null));
    }

    public async Task<Result> SubmitAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.ReturnOrders.FirstOrDefaultAsync(o => o.Id == id, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure(ReturnErrors.NotFound);
        }

        var marked = order.MarkSubmitted(clock.UtcNow);
        if (marked.IsFailure)
        {
            return marked;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        var started = await approvals.SubmitAsync(
            new ApprovalSubmission(ReturnOrderAdapter.ScreenCode, order.Id, $"{order.OrderNo} — {order.Name}"), cancellationToken).ConfigureAwait(false);
        if (started.IsFailure)
        {
            order.SubmissionFailed();
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return Result.Failure(started.Error);
        }

        return Result.Success();
    }

    public async Task<Result> CancelAsync(Guid id, string? comment, CancellationToken cancellationToken)
    {
        var order = await db.ReturnOrders.FirstOrDefaultAsync(o => o.Id == id, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure(ReturnErrors.NotFound);
        }

        var canceled = order.Cancel(comment);
        if (canceled.IsFailure)
        {
            return canceled;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }

    private async Task<Result<(ReturnWorker Worker, ReturnDetails Details)>> BuildAsync(Guid? orderId, ReturnInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (!ReturnReasons.All.Contains(input.Reason))
        {
            return Fail(Errors.Reason);
        }

        if (input.Reason == ReturnReasons.Other && string.IsNullOrWhiteSpace(input.ReasonNotes))
        {
            return Fail(Errors.ReasonNotes);
        }

        if (input.ArrivedOn > clock.Today)
        {
            return Fail(Errors.Future);
        }

        if (input.ArrivedOn < clock.Today.AddDays(-DeliveryOrderService.DelayDays) && string.IsNullOrWhiteSpace(input.DelayReason))
        {
            return Fail(Errors.DelayReason);
        }

        var card = (await workforce.CardsAsync([input.WorkerId], cancellationToken).ConfigureAwait(false)) is [var only, ..] ? only : null;
        if (card is null || !card.OnJob)
        {
            return Fail(Errors.NotOnJob);
        }

        if (card.ProjectJoinedOn is { } started && input.ArrivedOn <= started)
        {
            return Fail(Errors.BeforeWork);
        }

        if ((await BusyAsync(orderId, [card.Id], cancellationToken).ConfigureAwait(false)).Count > 0)
        {
            return Fail(Errors.Busy);
        }

        var project = card.ProjectCrmId is { } crm
            ? (await projects.FindAsync([], [crm], cancellationToken).ConfigureAwait(false)) is [var p, ..] ? p : null
            : null;
        var worker = new ReturnWorker(
            card.Id, card.CrmId, card.WorkerNo, card.Name, card.ProfessionCode, card.NationalityCode, card.IqamaNo,
            project?.Id, card.ProjectCrmId, project?.Name ?? card.ProjectName, card.ProjectJoinedOn);
        return Result.Success((worker, new ReturnDetails(input.ArrivedOn, input.Reason, input.ReasonNotes, input.StopSalary, input.HousingName, input.DelayReason, input.Notes)));

        static Result<(ReturnWorker, ReturnDetails)> Fail(Error error) => Result.Failure<(ReturnWorker, ReturnDetails)>(error);
    }

    /// <summary>Workers already on another open return order of this system, with that order's number.</summary>
    private async Task<Dictionary<Guid, string>> BusyAsync(Guid? exceptOrderId, IReadOnlyCollection<Guid> workerIds, CancellationToken cancellationToken)
    {
        var ids = workerIds.ToList();
        var rows = await db.ReturnOrders.AsNoTracking()
            .Where(o => o.WorkerId != null && ids.Contains(o.WorkerId.Value) && o.Source == DocumentSource.System && o.Id != exceptOrderId && Open.Contains(o.Status))
            .Select(o => new { o.WorkerId, o.OrderNo })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return rows.GroupBy(r => r.WorkerId!.Value).ToDictionary(g => g.Key, g => g.First().OrderNo);
    }

    private static class Errors
    {
        public static readonly Error Reason = Error.Validation("return_reason", "Choose the reason for the return.");
        public static readonly Error ReasonNotes = Error.Validation("return_reason_notes", "Describe the reason.");
        public static readonly Error Future = Error.Validation("return_future", "The arrival date cannot be in the future.");
        public static readonly Error DelayReason = Error.Validation("return_delay_reason", "The arrival date is more than two days ago: write the reason for the delay.");
        public static readonly Error NotOnJob = Error.Validation("return_not_on_job", "The worker is not on the job.");
        public static readonly Error BeforeWork = Error.Validation("return_before_work", "The arrival date must be after the worker's start of work.");
        public static readonly Error Busy = Error.Conflict("return_worker_busy", "The worker is already on another open return order.");
    }
}
