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

/// <summary>
/// A payslip emailed to an employee (4.12b): which run and line, to which address, by whom, and the queued email in
/// the outbox that says how it went. Never the amounts: the email's body lives only in the outbox until it is sent.
/// </summary>
public sealed class PayslipEmail : ITenantOwned
{
    private PayslipEmail()
    {
        EmployeeNo = string.Empty;
        Name = string.Empty;
        Email = string.Empty;
        QueuedByName = string.Empty;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid RunId { get; private set; }

    public Guid LineId { get; private set; }

    public Guid EmployeeId { get; private set; }

    public string EmployeeNo { get; private set; }

    public string Name { get; private set; }

    public string Email { get; private set; }

    public Guid OutgoingEmailId { get; private set; }

    public string QueuedByName { get; private set; }

    public DateTimeOffset QueuedAt { get; private set; }

    public static PayslipEmail Of(Guid runId, Guid lineId, Guid employeeId, string employeeNo, string name, string email, Guid outgoingEmailId, string by, DateTimeOffset at) => new()
    {
        Id = Guid.CreateVersion7(),
        RunId = runId,
        LineId = lineId,
        EmployeeId = employeeId,
        EmployeeNo = employeeNo,
        Name = name,
        Email = email,
        OutgoingEmailId = outgoingEmailId,
        QueuedByName = by,
        QueuedAt = at,
    };
}
