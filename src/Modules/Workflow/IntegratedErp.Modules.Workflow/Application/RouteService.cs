using IntegratedErp.BuildingBlocks.Approvals;
using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Identity.Contracts;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;
using IntegratedErp.SharedKernel;
using Microsoft.EntityFrameworkCore;

namespace IntegratedErp.Modules.Workflow.Application;

public sealed record DynamicKeyDto(string Key, string NameAr, string NameEn);

public sealed record StageDto(int Order, string NameAr, string NameEn, ApproverKind Kind, Guid? UserId, Guid? RoleId, string? DynamicKey);

public sealed record RouteSummaryDto(
    string DocumentType,
    string NameAr,
    string NameEn,
    IReadOnlyList<DynamicKeyDto> DynamicApprovers,
    bool HasRoute,
    bool IsActive,
    int Version,
    string? PublishedBy,
    DateTimeOffset? PublishedAt,
    IReadOnlyList<StageDto> Stages);

public sealed record VersionDto(int Version, string PublishedBy, DateTimeOffset PublishedAt, IReadOnlyList<StageDto> Stages);

public sealed record ApproverOptionsDto(IReadOnlyList<RoleInfo> Roles, IReadOnlyList<MemberInfo> Members);

/// <summary>Approval routes of the current company: one per document type, edited from the screens as new versions.</summary>
internal sealed class RouteService(WorkflowDbContext db, ApprovalDocumentCatalog documents, IAccessDirectory access, ICurrentUser user, IClock clock)
{
    public async Task<IReadOnlyList<RouteSummaryDto>> ListAsync(CancellationToken cancellationToken)
    {
        var routes = await db.Routes.AsNoTracking().Include(r => r.Versions).ThenInclude(v => v.Stages)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return documents.All.Select(d =>
        {
            var route = routes.FirstOrDefault(r => r.DocumentType == d.Code);
            var current = route?.Current;
            return new RouteSummaryDto(
                d.Code, d.NameAr, d.NameEn,
                d.DynamicApprovers.Select(k => new DynamicKeyDto(k.Key, k.NameAr, k.NameEn)).ToList(),
                route is not null, route?.IsActive ?? false, current?.Version ?? 0, current?.PublishedBy, current?.PublishedAt,
                current is null ? [] : ToDto(current));
        }).ToList();
    }

    public async Task<Result<IReadOnlyList<VersionDto>>> VersionsAsync(string documentType, CancellationToken cancellationToken)
    {
        var route = await db.Routes.AsNoTracking().Include(r => r.Versions).ThenInclude(v => v.Stages)
            .FirstOrDefaultAsync(r => r.DocumentType == documentType, cancellationToken).ConfigureAwait(false);
        return route is null
            ? Result.Failure<IReadOnlyList<VersionDto>>(Error.NotFound("approval_route", "Route not found."))
            : Result.Success<IReadOnlyList<VersionDto>>(route.Versions.OrderByDescending(v => v.Version)
                .Select(v => new VersionDto(v.Version, v.PublishedBy, v.PublishedAt, ToDto(v))).ToList());
    }

    /// <summary>Saves the stages as the next version (running approvals keep theirs) and switches the route on or off.</summary>
    public async Task<Result<RouteSummaryDto>> PublishAsync(string documentType, IReadOnlyList<StageInput> stages, bool isActive, CancellationToken cancellationToken)
    {
        if (documents.Find(documentType) is not { } definition)
        {
            return Result.Failure<RouteSummaryDto>(ApprovalEngine.UnknownDocumentType);
        }

        // Named users must be members, and roles must exist, in this company.
        var roles = (await access.ListRolesAsync(cancellationToken).ConfigureAwait(false)).Select(r => r.Id).ToHashSet();
        foreach (var stage in stages)
        {
            var known = stage.Kind switch
            {
                ApproverKind.User => stage.UserId is { } id && await access.IsMemberAsync(id, cancellationToken).ConfigureAwait(false),
                ApproverKind.Role => stage.RoleId is { } roleId && roles.Contains(roleId),
                _ => true,
            };
            if (!known)
            {
                return Result.Failure<RouteSummaryDto>(Error.Validation("route_approver_unknown", "An approver is not a member or role of this company."));
            }
        }

        var route = await db.Routes.Include(r => r.Versions).ThenInclude(v => v.Stages)
            .FirstOrDefaultAsync(r => r.DocumentType == documentType, cancellationToken).ConfigureAwait(false);
        if (route is null)
        {
            route = new ApprovalRoute(documentType);
            db.Routes.Add(route);
        }

        var published = route.Publish(stages, definition.DynamicApprovers.Select(k => k.Key).ToList(), user.DisplayName, clock.UtcNow);
        if (published.IsFailure)
        {
            return Result.Failure<RouteSummaryDto>(published.Error);
        }

        route.SetActive(isActive);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success((await ListAsync(cancellationToken).ConfigureAwait(false)).Single(r => r.DocumentType == documentType));
    }

    public async Task<ApproverOptionsDto> ApproverOptionsAsync(CancellationToken cancellationToken) =>
        new(
            (await access.ListRolesAsync(cancellationToken).ConfigureAwait(false)).Where(r => r.IsActive).ToList(),
            await access.ListMembersAsync(cancellationToken).ConfigureAwait(false));

    private static List<StageDto> ToDto(ApprovalRouteVersion version) =>
        version.Stages.OrderBy(s => s.Order).Select(s => new StageDto(s.Order, s.NameAr, s.NameEn, s.Kind, s.UserId, s.RoleId, s.DynamicKey)).ToList();
}
