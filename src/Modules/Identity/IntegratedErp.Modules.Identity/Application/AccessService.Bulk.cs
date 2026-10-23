using ClosedXML.Excel;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure.Ldap;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace IntegratedErp.Modules.Identity.Application;

/// <summary>One name of a bulk add: what was found in the directory and what happened (or would happen).</summary>
/// <param name="Outcome">new, member (already in the company), not_found (not in the directory or disabled), added, failed.</param>
public sealed record BulkMemberDto(string UserName, string Outcome, string? DisplayName, string? Email);

internal sealed partial class AccessService
{
    public const int BulkLimit = 300;
    public static readonly Error BulkTooMany = Error.Validation("bulk_too_many", $"At most {BulkLimit} users at once.");
    public static readonly Error BulkFileUnreadable = Error.Validation("bulk_file_unreadable", "The file is not an Excel file with a «User Name» column.");

    /// <summary>
    /// Adds several company AD users at once (the user's request, 2026-10-23: the old system's users), each exactly as
    /// one added by hand, and gives each the chosen role for all registrations (kept with any roles they have).
    /// With <paramref name="apply"/> false nothing is saved: it says who would be added.
    /// </summary>
    public async Task<Result<IReadOnlyList<BulkMemberDto>>> AddMembersAsync(IReadOnlyCollection<string> userNames, Guid? roleId, bool apply, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(userNames);
        var names = userNames.Select(LdapDirectory.NormalizeUserName).Where(n => n.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (names.Count > BulkLimit)
        {
            return Result.Failure<IReadOnlyList<BulkMemberDto>>(BulkTooMany);
        }

        if (roleId is { } id && !await db.Roles.AnyAsync(r => r.Id == id, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<IReadOnlyList<BulkMemberDto>>(RoleNotFound);
        }

        var provider = options.Value.DirectoryProvider;
        var results = new List<BulkMemberDto>();
        foreach (var name in names)
        {
            try
            {
                var found = await directory.FindUserAsync(name, cancellationToken).ConfigureAwait(false);
                if (found is null || !found.IsEnabled)
                {
                    results.Add(new(name, "not_found", null, null));
                    continue;
                }

                var subject = found.ObjectGuid.ToString();
                var member = await (
                        from l in db.ExternalLogins
                        join m in db.Memberships on l.UserAccountId equals m.UserAccountId
                        where l.Provider == provider && l.Subject == subject && m.IsActive
                        select m.Id)
                    .AnyAsync(cancellationToken).ConfigureAwait(false);
                if (!apply)
                {
                    results.Add(new(found.SamAccountName, member ? "member" : "new", found.DisplayName, found.Email));
                    continue;
                }

                var added = await AddMemberAsync(found.SamAccountName, cancellationToken).ConfigureAwait(false);
                if (added.IsFailure)
                {
                    results.Add(new(found.SamAccountName, "failed", found.DisplayName, found.Email));
                    continue;
                }

                if (roleId is { } role && added.Value.Roles.All(r => r.RoleId != role || r.LegalEntityId is not null))
                {
                    var roles = await SetMemberRolesAsync(added.Value.MembershipId, [.. added.Value.Roles, new AssignmentDto(role, null)], cancellationToken).ConfigureAwait(false);
                    if (roles.IsFailure)
                    {
                        db.ChangeTracker.Clear();
                        results.Add(new(found.SamAccountName, "failed", found.DisplayName, found.Email));
                        continue;
                    }
                }

                results.Add(new(found.SamAccountName, member ? "member" : "added", found.DisplayName, found.Email));
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // One name the directory could not answer does not stop the others.
                logger.LogWarning(ex, "Bulk add: {UserName} could not be added.", name);
                db.ChangeTracker.Clear();
                results.Add(new(name, "failed", null, null));
            }
        }

        return Result.Success<IReadOnlyList<BulkMemberDto>>(results);
    }

    /// <summary>
    /// The user names of an Excel list (the old system's «Enabled Users» export, or any sheet): the column headed
    /// «User Name» (or «اسم المستخدم»), else the first column of DOMAIN\name values.
    /// </summary>
    public static Result<IReadOnlyList<string>> ReadUserNames(Stream content)
    {
        try
        {
            using var workbook = new XLWorkbook(content);
            foreach (var sheet in workbook.Worksheets.Where(s => s.Visibility == XLWorksheetVisibility.Visible))
            {
                var used = sheet.RangeUsed();
                if (used is null)
                {
                    continue;
                }

                var header = used.FirstRow();
                var column = header.Cells().FirstOrDefault(c => c.GetString().Trim() is var h && (h.Equals("User Name", StringComparison.OrdinalIgnoreCase) || h == "اسم المستخدم"))?.Address.ColumnNumber
                    ?? used.Columns().FirstOrDefault(c => c.Cells().Skip(1).Any(x => x.GetString().Contains('\\', StringComparison.Ordinal)))?.ColumnNumber();
                if (column is not { } at)
                {
                    continue;
                }

                var names = used.Rows().Skip(1).Select(r => r.Cell(at - used.FirstColumn().ColumnNumber() + 1).GetString().Trim()).Where(n => n.Length > 0).ToList();
                if (names.Count > 0)
                {
                    return Result.Success<IReadOnlyList<string>>(names);
                }
            }
        }
        catch (Exception ex) when (ex is InvalidDataException or IOException or ArgumentException or InvalidOperationException or FormatException or NotSupportedException)
        {
            return Result.Failure<IReadOnlyList<string>>(BulkFileUnreadable);
        }

        return Result.Failure<IReadOnlyList<string>>(BulkFileUnreadable);
    }
}
