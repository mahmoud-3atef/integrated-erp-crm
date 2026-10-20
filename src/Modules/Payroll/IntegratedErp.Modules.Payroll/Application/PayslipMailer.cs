using System.Globalization;
using System.Net;
using System.Net.Mail;
using System.Text;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Documents.Contracts;
using IntegratedErp.Modules.Payroll.Domain;
using IntegratedErp.Modules.Payroll.Infrastructure;
using IntegratedErp.Modules.Staff.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Payroll.Application;

public sealed record PayslipRecipientDto(string EmployeeNo, string Name);

/// <param name="WithoutEmail">The first of those without a valid address (to complete their files).</param>
public sealed record PayslipEmailPreviewDto(
    bool Configured,
    string? FromAddress,
    bool Approved,
    int Total,
    int WithEmail,
    int WithoutEmailCount,
    IReadOnlyList<PayslipRecipientDto> WithoutEmail,
    int AlreadySent);

public sealed record PayslipEmailInput(string? Search, Guid? Department, string? Note, Guid? Line, bool Resend);

public sealed record PayslipEmailResultDto(int Queued, int WithoutEmail, int AlreadySent);

/// <param name="Status"><c>Pending</c>, <c>Sent</c> or <c>Failed</c>.</param>
public sealed record PayslipEmailRowDto(Guid EmployeeId, string EmployeeNo, string Name, string Email, string Status, int Attempts, DateTimeOffset QueuedAt, string QueuedByName, DateTimeOffset? SentAt, string? Error);

/// <summary>
/// Emails the staff's payslips (docs/03-migration-plan/13, 4.12b): only for an approved run, to the address in each
/// employee's file, through the outbox (sent in the background and retried). Each employee gets the run's payslip once
/// unless it is sent again on purpose; the amounts stay out of the payroll's tables and of the logs.
/// </summary>
internal sealed class PayslipMailer(PayrollDbContext db, PayslipService payslips, IStaffPayroll staff, IEmailOutbox outbox, ICurrentUser user, IClock clock)
{
    private const int Max = 5000;

    public async Task<PayslipEmailPreviewDto?> PreviewAsync(Guid runId, PayslipEmailInput q, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(q);
        if (await ScopeAsync(runId, q, cancellationToken).ConfigureAwait(false) is not { } scope)
        {
            return null;
        }

        var without = scope.Recipients.Where(r => r.Email is null).ToList();
        var sent = await SentAsync(runId, cancellationToken).ConfigureAwait(false);
        var (configured, from) = outbox.Sender;
        return new PayslipEmailPreviewDto(
            configured, from, !scope.Batch.Draft, scope.Recipients.Count, scope.Recipients.Count - without.Count, without.Count,
            without.Take(30).Select(r => new PayslipRecipientDto(r.Slip.No, r.Slip.Name)).ToList(),
            scope.Recipients.Count(r => r.Email is not null && sent.Contains(r.Slip.PersonId)));
    }

    public async Task<Result<PayslipEmailResultDto>?> SendAsync(Guid runId, PayslipEmailInput q, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(q);
        if (await ScopeAsync(runId, q, cancellationToken).ConfigureAwait(false) is not { } scope)
        {
            return null;
        }

        if (scope.Batch.Draft)
        {
            return Result.Failure<PayslipEmailResultDto>(PayrollErrors.PayslipNotApproved);
        }

        if (!outbox.Sender.Configured)
        {
            return Result.Failure<PayslipEmailResultDto>(PayrollErrors.EmailNotConfigured);
        }

        var sent = await SentAsync(runId, cancellationToken).ConfigureAwait(false);
        var to = scope.Recipients.Where(r => r.Email is not null && (q.Resend || !sent.Contains(r.Slip.PersonId))).ToList();
        if (to.Count > 0)
        {
            var ids = await outbox.QueueAsync(to.Select(r => PayslipEmailTemplate.Render(scope.Batch, r.Slip, r.Email!)).ToList(), confidential: true, cancellationToken).ConfigureAwait(false);
            var now = clock.UtcNow;
            db.PayslipEmails.AddRange(to.Select((r, i) => PayslipEmail.Of(runId, r.Slip.LineId, r.Slip.PersonId, r.Slip.No, r.Slip.Name, r.Email!, ids[i], user.DisplayName, now)));
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        var withEmail = scope.Recipients.Count(r => r.Email is not null);
        return Result.Success(new PayslipEmailResultDto(to.Count, scope.Recipients.Count - withEmail, withEmail - to.Count));
    }

    /// <summary>The run's emailed payslips, the latest per employee, with how each went.</summary>
    public async Task<IReadOnlyList<PayslipEmailRowDto>> StatusAsync(Guid runId, CancellationToken cancellationToken)
    {
        var rows = (await db.PayslipEmails.AsNoTracking().Where(e => e.RunId == runId).ToListAsync(cancellationToken).ConfigureAwait(false))
            .GroupBy(e => e.EmployeeId).Select(g => g.OrderByDescending(e => e.QueuedAt).First()).ToList();
        var states = (await outbox.StatesAsync(rows.Select(r => r.OutgoingEmailId).ToList(), cancellationToken).ConfigureAwait(false)).ToDictionary(s => s.Id);
        return rows.Select(r =>
            {
                var s = states.GetValueOrDefault(r.OutgoingEmailId);
                return new PayslipEmailRowDto(r.EmployeeId, r.EmployeeNo, r.Name, r.Email, s?.Status ?? "Pending", s?.Attempts ?? 0, r.QueuedAt, r.QueuedByName, s?.SentAt, s?.LastError);
            })
            .OrderBy(r => r.Status == "Failed" ? 0 : r.Status == "Pending" ? 1 : 2).ThenBy(r => r.EmployeeNo, StringComparer.Ordinal).ToList();
    }

    private async Task<HashSet<Guid>> SentAsync(Guid runId, CancellationToken cancellationToken) =>
        (await db.PayslipEmails.AsNoTracking().Where(e => e.RunId == runId).Select(e => e.EmployeeId).Distinct().ToListAsync(cancellationToken).ConfigureAwait(false)).ToHashSet();

    private async Task<(PayslipBatchDto Batch, List<(PayslipDto Slip, string? Email)> Recipients)?> ScopeAsync(Guid runId, PayslipEmailInput q, CancellationToken cancellationToken)
    {
        if (await payslips.StaffAsync(runId, new PayslipQuery(q.Line, q.Search, q.Department, q.Note), Max, false, cancellationToken).ConfigureAwait(false) is not { } batch)
        {
            return null;
        }

        var emails = (await staff.PayInfoAsync(batch.From, batch.To, cancellationToken).ConfigureAwait(false)).ToDictionary(p => p.EmployeeId, p => Valid(p.Email));
        return (batch, batch.Items.Select(s => (s, emails.GetValueOrDefault(s.PersonId))).ToList());
    }

    /// <summary>A usable address, or null.</summary>
    internal static string? Valid(string? email)
    {
        if (string.IsNullOrWhiteSpace(email) || email.Trim().Length > 256)
        {
            return null;
        }

        try
        {
            var address = new MailAddress(email.Trim());
            return address.Address.Contains('.', StringComparison.Ordinal) && address.Address == email.Trim() ? address.Address : null;
        }
        catch (FormatException)
        {
            return null;
        }
    }
}

/// <summary>The payslip as an email: the same items as the printed one, in Arabic with English, with inline styles.</summary>
internal static class PayslipEmailTemplate
{
    private static readonly Dictionary<string, (string Ar, string En)> Items = new(StringComparer.Ordinal)
    {
        ["basic"] = ("الراتب الأساسي", "Basic salary"),
        ["housing"] = ("بدل السكن", "Housing allowance"),
        ["other"] = ("بدلات أخرى", "Other allowances"),
        ["overtime"] = ("العمل الإضافي", "Overtime"),
        ["addition"] = ("إضافة", "Addition"),
        ["additions"] = ("إضافات", "Additions"),
        ["absence"] = ("الغياب وأيام بلا أجر", "Absence and unpaid days"),
        ["late"] = ("التأخير والانصراف المبكر", "Lateness and early leave"),
        ["sick"] = ("خصم الإجازة المرضية (25%)", "Sick leave deduction (25%)"),
        ["installment"] = ("قسط السلفة", "Advance installment"),
        ["penaltyDays"] = ("جزاء بالأيام", "Penalty (days)"),
        ["penaltyAmount"] = ("جزاء", "Penalty"),
        ["deduction"] = ("خصم", "Deduction"),
        ["adjustment"] = ("خصم (تسوية)", "Deduction (adjustment)"),
        ["gosi"] = ("التأمينات الاجتماعية", "GOSI"),
        ["otherDeductions"] = ("استقطاعات أخرى", "Other deductions"),
    };

    public static OutgoingEmailRequest Render(PayslipBatchDto batch, PayslipDto p, string to)
    {
        ArgumentNullException.ThrowIfNull(batch);
        ArgumentNullException.ThrowIfNull(p);
        var period = $"{Day(batch.From)} – {Day(batch.To)}";
        var subject = $"قسيمة الراتب · Payslip · {period}";
        var h = new StringBuilder();
        h.Append("<div dir='rtl' style='font-family:Tahoma,Arial,sans-serif;color:#0F2747;line-height:1.7;max-width:640px'>");
        h.Append("<div style='border-bottom:3px solid #082B49;padding-bottom:8px;margin-bottom:12px'>");
        h.Append(CultureInfo.InvariantCulture, $"<div style='font-size:20px;font-weight:bold;color:#082B49'>قسيمة الراتب <span style='font-size:13px;color:#64748B'>/ Payslip</span></div>");
        h.Append(CultureInfo.InvariantCulture, $"<div>{E(batch.LegalEntityNameAr)} · <bdi>{E(period)}</bdi> · <bdi>{E(batch.RunNo)}</bdi></div></div>");
        h.Append(CultureInfo.InvariantCulture, $"<p>عزيزي الموظف/ <b>{E(p.Name)}</b> (<bdi>{E(p.No)}</bdi>)،<br>نرفق لكم قسيمة راتبكم للفترة <bdi>{E(period)}</bdi>.</p>");
        Table(h, "الاستحقاقات", "Earnings", "#E3F6EC", "#047857", p.Earnings, p.TotalEarnings);
        Table(h, "الاستقطاعات", "Deductions", "#FDF1DC", "#B45309", p.Deductions, p.TotalDeductions);
        h.Append(CultureInfo.InvariantCulture, $"<div style='background:#082B49;color:#fff;border-radius:8px;padding:10px 14px;margin-top:10px;font-size:16px'><b>صافي الراتب / Net pay: <bdi>{Money(p.Net)}</bdi> ر.س</b></div>");
        h.Append("<p style='color:#64748B;font-size:12px;margin-top:14px'>صدرت هذه القسيمة من النظام المتكامل بعد اعتماد المسير. لأي ملاحظة راجع إدارة الموارد البشرية.<br>");
        h.Append("<span dir='ltr'>Issued by Integrated ERP once the run was approved. For any question, contact Human Resources.</span></p></div>");

        var t = new StringBuilder();
        t.AppendLine(CultureInfo.InvariantCulture, $"قسيمة الراتب / Payslip — {batch.LegalEntityNameAr} — {period} — {batch.RunNo}");
        t.AppendLine(CultureInfo.InvariantCulture, $"{p.Name} ({p.No})");
        foreach (var i in p.Earnings)
        {
            t.AppendLine(CultureInfo.InvariantCulture, $"+ {Label(i).Ar}: {Money(i.Amount)}");
        }

        foreach (var i in p.Deductions)
        {
            t.AppendLine(CultureInfo.InvariantCulture, $"- {Label(i).Ar}: {Money(i.Amount)}");
        }

        t.AppendLine(CultureInfo.InvariantCulture, $"صافي الراتب / Net pay: {Money(p.Net)} SAR");
        return new OutgoingEmailRequest(to, subject, h.ToString(), t.ToString());
    }

    private static void Table(StringBuilder h, string ar, string en, string bg, string fg, IReadOnlyList<PayslipItem> items, decimal total)
    {
        h.Append(CultureInfo.InvariantCulture, $"<table cellpadding='6' cellspacing='0' style='border-collapse:collapse;width:100%;border:1px solid #D7E0EC;margin-top:10px;font-size:13px'><tr><th style='background:{bg};color:{fg};text-align:right'>{ar} / {en}</th><th style='background:{bg};color:{fg};text-align:left'>ر.س</th></tr>");
        foreach (var i in items)
        {
            var (lar, len) = Label(i);
            h.Append(CultureInfo.InvariantCulture, $"<tr><td style='border-top:1px solid #EEF2F7'>{E(lar)}<br><span dir='ltr' style='color:#64748B;font-size:11px'>{E(len)}</span></td><td dir='ltr' style='border-top:1px solid #EEF2F7;text-align:left'>{Money(i.Amount)}</td></tr>");
        }

        h.Append(CultureInfo.InvariantCulture, $"<tr><td style='border-top:2px solid #D7E0EC;font-weight:bold'>الإجمالي / Total</td><td dir='ltr' style='border-top:2px solid #D7E0EC;text-align:left;font-weight:bold'>{Money(total)}</td></tr></table>");
    }

    internal static (string Ar, string En) Label(PayslipItem i)
    {
        var (ar, en) = Items.GetValueOrDefault(i.Code, (i.Code, i.Code));
        var extra = string.Join(' ', new[] { i.Reference, i.Note is null ? null : $"— {i.Note}" }.Where(x => !string.IsNullOrWhiteSpace(x)));
        return extra.Length == 0 ? (ar, en) : ($"{ar} {extra}", $"{en} {extra}");
    }

    private static string Money(decimal value) => value.ToString("#,0.00", CultureInfo.InvariantCulture);

    private static string Day(DateOnly d) => d.ToString("yyyy/MM/dd", CultureInfo.InvariantCulture);

    private static string E(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);
}
