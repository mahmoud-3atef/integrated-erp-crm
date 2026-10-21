namespace IntegratedErp.Modules.Expenses.Contracts;

/// <summary>
/// Public surface of the Expenses module (docs/03-migration-plan/16): what the company spends on a worker (residence
/// renewal, visa, work permit…), on a project (travel tickets when delivering a worker…) or in general.
/// </summary>
public static class ExpensesContracts
{
    public const string ModuleName = "Expenses";
}

/// <summary>
/// The part of an expense that falls in a period (an expense spread over months counts its months' shares), and whom
/// it is charged to: a project (first), else a worker, else the company.
/// </summary>
public sealed record ExpenseShare(Guid ExpenseId, string ExpenseNo, string Category, Guid? WorkerId, Guid? ProjectCrmId, decimal Amount);

public interface IExpenseLedger
{
    Task<IReadOnlyList<ExpenseShare>> SharesAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken);
}
