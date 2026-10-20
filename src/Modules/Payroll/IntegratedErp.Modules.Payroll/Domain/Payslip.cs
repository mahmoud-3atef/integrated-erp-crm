using IntegratedErp.SharedKernel;

namespace IntegratedErp.Modules.Payroll.Domain;

/// <summary>
/// One printing of payslips (4.12): who printed which run, how many, and for whom when it was one — never the amounts.
/// </summary>
public sealed class PayslipPrint : ITenantOwned
{
    private PayslipPrint()
    {
        RunKind = string.Empty;
        RunNo = string.Empty;
        PrintedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    /// <summary><c>Staff</c> or <c>Workers</c>.</summary>
    public string RunKind { get; private set; }

    public Guid RunId { get; private set; }

    public string RunNo { get; private set; }

    public int Count { get; private set; }

    /// <summary>The employee or worker, when one payslip was printed.</summary>
    public Guid? PersonId { get; private set; }

    /// <summary>Printed before the run was approved (marked as a draft).</summary>
    public bool Draft { get; private set; }

    public string PrintedByName { get; private set; }

    public DateTimeOffset PrintedAt { get; private set; }

    public static PayslipPrint Of(string runKind, Guid runId, string runNo, int count, Guid? personId, bool draft, string by, DateTimeOffset at) => new()
    {
        Id = Guid.CreateVersion7(),
        RunKind = runKind,
        RunId = runId,
        RunNo = runNo,
        Count = count,
        PersonId = personId,
        Draft = draft,
        PrintedByName = by,
        PrintedAt = at,
    };
}
