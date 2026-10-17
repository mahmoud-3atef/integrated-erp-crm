using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Housing.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Housing.Api;

/// <summary>Buildings, rooms and who lives in them.</summary>
internal static class HousingEndpoints
{
    public static void MapHousingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/housing").WithTags("Housing").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/", async (HousingQueries queries, CancellationToken ct) => Results.Ok(await queries.OverviewAsync(ct).ConfigureAwait(false)))
            .RequirePermission(HousingPermissions.View, companyWide: true);

        group.MapGet("/buildings/{id:guid}", async (Guid id, HousingQueries queries, CancellationToken ct) =>
                await queries.BuildingAsync(id, ct).ConfigureAwait(false) is { } building ? Results.Ok(building) : Results.NotFound())
            .RequirePermission(HousingPermissions.View, companyWide: true);

        group.MapGet("/rooms", async (HousingService service, CancellationToken ct) => Results.Ok(await service.RoomsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(HousingPermissions.View, companyWide: true);

        group.MapGet("/without-room", async (HousingQueries queries, CancellationToken ct) => Results.Ok(await queries.WithoutRoomAsync(ct).ConfigureAwait(false)))
            .RequirePermission(HousingPermissions.View, companyWide: true);

        group.MapGet("/workers/{workerId:guid}/stays", async (Guid workerId, HousingQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.StaysAsync(workerId, ct).ConfigureAwait(false)))
            .RequirePermission(HousingPermissions.View, companyWide: true);

        group.MapGet("/projects", async (IProjectDirectory projects, CancellationToken ct) => Results.Ok(await projects.ActiveAsync(ct).ConfigureAwait(false)))
            .RequirePermission(HousingPermissions.Manage, companyWide: true);

        group.MapPost("/buildings", async (BuildingInput input, HousingService service, CancellationToken ct) =>
                await service.CreateBuildingAsync(input, ct).ConfigureAwait(false) is var result && result.IsSuccess
                    ? Results.Json(new { id = result.Value }, statusCode: StatusCodes.Status201Created)
                    : Problem(result.Error))
            .RequirePermission(HousingPermissions.Manage, companyWide: true);

        group.MapPut("/buildings/{id:guid}", async (Guid id, BuildingInput input, HousingService service, CancellationToken ct) =>
                ToHttp(await service.UpdateBuildingAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(HousingPermissions.Manage, companyWide: true);

        group.MapPost("/buildings/{id:guid}/active", async (Guid id, ActiveRequest r, HousingService service, CancellationToken ct) =>
                ToHttp(await service.SetBuildingActiveAsync(id, r.Active, ct).ConfigureAwait(false)))
            .RequirePermission(HousingPermissions.Manage, companyWide: true);

        group.MapPost("/buildings/{id:guid}/rooms", async (Guid id, RoomInput input, HousingService service, CancellationToken ct) =>
                await service.CreateRoomAsync(id, input, ct).ConfigureAwait(false) is var result && result.IsSuccess
                    ? Results.Json(new { id = result.Value }, statusCode: StatusCodes.Status201Created)
                    : Problem(result.Error))
            .RequirePermission(HousingPermissions.Manage, companyWide: true);

        group.MapPut("/rooms/{id:guid}", async (Guid id, RoomInput input, HousingService service, CancellationToken ct) =>
                ToHttp(await service.UpdateRoomAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(HousingPermissions.Manage, companyWide: true);

        group.MapPost("/rooms/{id:guid}/active", async (Guid id, ActiveRequest r, HousingService service, CancellationToken ct) =>
                ToHttp(await service.SetRoomActiveAsync(id, r.Active, ct).ConfigureAwait(false)))
            .RequirePermission(HousingPermissions.Manage, companyWide: true);

        group.MapPost("/assignments", async (AssignInput input, HousingService service, CancellationToken ct) =>
                ToHttp(await service.AssignAsync(input, ct).ConfigureAwait(false)))
            .RequirePermission(HousingPermissions.Assign, companyWide: true);

        group.MapPost("/workers/{workerId:guid}/leave", async (Guid workerId, LeaveRequest r, HousingService service, CancellationToken ct) =>
                ToHttp(await service.UnassignAsync(workerId, r.On, ct).ConfigureAwait(false)))
            .RequirePermission(HousingPermissions.Assign, companyWide: true);
    }

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}

internal sealed record ActiveRequest(bool Active);

internal sealed record LeaveRequest(DateOnly? On);
