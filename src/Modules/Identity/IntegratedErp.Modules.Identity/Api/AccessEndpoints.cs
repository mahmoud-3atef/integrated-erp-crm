using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Identity.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Identity.Api;

/// <summary>
/// Company access administration: roles, members, role assignments (always the current company). Company-wide:
/// a role limited to one commercial registration does not let anyone administer access.
/// </summary>
internal static class AccessEndpoints
{
    public sealed record RoleRequest(string? Code, string NameAr, string NameEn, IReadOnlyList<string>? Permissions);

    public sealed record AddMemberRequest(string UserName);

    public sealed record SetRolesRequest(IReadOnlyList<AssignmentDto>? Roles);

    public sealed record SetActiveRequest(bool IsActive);

    public static void MapAccessEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/access").WithTags("Access");

        group.MapGet("/permissions", (AccessService service) => Results.Ok(service.Permissions()))
            .RequirePermission(IdentityPermissions.RolesView, companyWide: true);

        group.MapGet("/roles", async (AccessService service, CancellationToken ct) =>
            Results.Ok(await service.ListRolesAsync(ct).ConfigureAwait(false)))
            .RequirePermission(IdentityPermissions.RolesView, companyWide: true);

        group.MapPost("/roles", async (RoleRequest request, AccessService service, CancellationToken ct) =>
            ToHttp(await service.CreateRoleAsync(request.Code ?? string.Empty, request.NameAr, request.NameEn, request.Permissions ?? [], ct).ConfigureAwait(false), StatusCodes.Status201Created))
            .RequirePermission(IdentityPermissions.RolesManage, companyWide: true);

        group.MapPut("/roles/{id:guid}", async (Guid id, RoleRequest request, AccessService service, CancellationToken ct) =>
            ToHttp(await service.UpdateRoleAsync(id, request.NameAr, request.NameEn, request.Permissions ?? [], ct).ConfigureAwait(false), StatusCodes.Status200OK))
            .RequirePermission(IdentityPermissions.RolesManage, companyWide: true);

        group.MapGet("/members", async (AccessService service, CancellationToken ct) =>
            Results.Ok(await service.ListMembersAsync(ct).ConfigureAwait(false)))
            .RequirePermission(IdentityPermissions.UsersView, companyWide: true);

        group.MapPost("/members", async (AddMemberRequest request, AccessService service, CancellationToken ct) =>
            ToHttp(await service.AddMemberAsync(request.UserName, ct).ConfigureAwait(false), StatusCodes.Status201Created))
            .RequirePermission(IdentityPermissions.UsersManage, companyWide: true);

        group.MapPut("/members/{id:guid}/roles", async (Guid id, SetRolesRequest request, AccessService service, CancellationToken ct) =>
            ToHttp(await service.SetMemberRolesAsync(id, request.Roles ?? [], ct).ConfigureAwait(false)))
            .RequirePermission(IdentityPermissions.UsersManage, companyWide: true);

        group.MapPut("/members/{id:guid}/active", async (Guid id, SetActiveRequest request, AccessService service, CancellationToken ct) =>
            ToHttp(await service.SetMemberActiveAsync(id, request.IsActive, ct).ConfigureAwait(false)))
            .RequirePermission(IdentityPermissions.UsersManage, companyWide: true);

        // Needed to scope a role to one commercial registration.
        group.MapGet("/legal-entities", async (AccessService service, CancellationToken ct) =>
            Results.Ok(await service.LegalEntitiesAsync(ct).ConfigureAwait(false)))
            .RequirePermission(IdentityPermissions.UsersView, companyWide: true);
    }

    private static IResult ToHttp<T>(Result<T> result, int successStatus) =>
        result.IsSuccess ? Results.Json(result.Value, statusCode: successStatus) : Problem(result.Error);

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}
