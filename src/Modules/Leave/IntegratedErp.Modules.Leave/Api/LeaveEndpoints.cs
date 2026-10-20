using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Leave.Application;
using IntegratedErp.Modules.Leave.Domain;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Leave.Api;

public sealed record CancelInput(string Reason);

/// <summary>Leave requests, balances and their entries, the accrual and carry-over, and the types and settings.</summary>
internal static class LeaveEndpoints
{
    public static void MapLeaveEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/leave").WithTags("Leave").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/kpis", async (LeaveQueries queries, CancellationToken ct) => Results.Ok(await queries.KpisAsync(ct).ConfigureAwait(false)))
            .RequirePermission(LeavePermissions.View, companyWide: true);
        group.MapGet("/requests", async (string? tab, Guid? typeId, Guid? employeeId, string? search, int? page, int? pageSize, LeaveQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.RequestsAsync(tab, typeId, employeeId, search, page ?? 1, pageSize ?? 25, ct).ConfigureAwait(false)))
            .RequirePermission(LeavePermissions.View, companyWide: true);
        group.MapGet("/calendar/{period}", async (string period, LeaveQueries queries, CancellationToken ct) =>
                await queries.CalendarAsync(period, ct).ConfigureAwait(false) is { } list ? Results.Ok(list) : Results.NotFound())
            .RequirePermission(LeavePermissions.View, companyWide: true);
        group.MapGet("/requests/{id:guid}", async (Guid id, LeaveQueries queries, CancellationToken ct) =>
                await queries.RequestAsync(id, ct).ConfigureAwait(false) is { } r ? Results.Ok(r) : Results.NotFound())
            .RequirePermission(LeavePermissions.View, companyWide: true);
        group.MapPost("/requests/preview", async (LeaveInput input, Guid? requestId, LeaveRequests requests, CancellationToken ct) =>
                await requests.PreviewAsync(input, requestId, ct).ConfigureAwait(false) is var r && r.IsSuccess ? Results.Ok(r.Value) : Problem(r.Error))
            .RequirePermission(LeavePermissions.Manage, companyWide: true);
        group.MapPost("/requests", async (LeaveInput input, LeaveRequests requests, CancellationToken ct) => Saved(await requests.RequestAsync(input, ct).ConfigureAwait(false)))
            .RequirePermission(LeavePermissions.Manage, companyWide: true);
        group.MapPost("/requests/{id:guid}/resubmit", async (Guid id, LeaveInput input, LeaveRequests requests, CancellationToken ct) => Saved(await requests.ResubmitAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(LeavePermissions.Manage, companyWide: true);
        group.MapPost("/requests/{id:guid}/cancel", async (Guid id, CancelInput input, LeaveRequests requests, CancellationToken ct) => ToHttp(await requests.CancelAsync(id, input.Reason, ct).ConfigureAwait(false)))
            .RequirePermission(LeavePermissions.Manage, companyWide: true);

        group.MapGet("/employees/{id:guid}", async (Guid id, LeaveQueries queries, CancellationToken ct) =>
                await queries.EmployeeAsync(id, ct).ConfigureAwait(false) is { } e ? Results.Ok(e) : Results.NotFound())
            .RequirePermission(LeavePermissions.View, companyWide: true);
        group.MapPost("/employees/{id:guid}/opening", async (Guid id, EntryInput input, LeaveBalances balances, CancellationToken ct) => ToHttp(await balances.AddAsync(id, EntryKind.Opening, input, ct).ConfigureAwait(false)))
            .RequirePermission(LeavePermissions.Manage, companyWide: true);
        group.MapPost("/employees/{id:guid}/adjustment", async (Guid id, EntryInput input, LeaveBalances balances, CancellationToken ct) => ToHttp(await balances.AddAsync(id, EntryKind.Adjustment, input, ct).ConfigureAwait(false)))
            .RequirePermission(LeavePermissions.Manage, companyWide: true);

        group.MapGet("/balances", async (Guid? typeId, string? search, Guid? departmentId, LeaveQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.BalancesAsync(typeId, search, departmentId, ct).ConfigureAwait(false)))
            .RequirePermission(LeavePermissions.View, companyWide: true);
        group.MapPost("/balances/accrual/{period}", async (string period, LeaveBalances balances, CancellationToken ct) =>
                await balances.AccrueThroughAsync(period, ct).ConfigureAwait(false) is var r && r.IsSuccess ? Results.Ok(r.Value) : Problem(r.Error))
            .RequirePermission(LeavePermissions.Manage, companyWide: true);
        group.MapPost("/balances/carry-over/{year:int}", async (int year, LeaveBalances balances, CancellationToken ct) =>
                await balances.CarryOverAsync(year, ct).ConfigureAwait(false) is var r && r.IsSuccess ? Results.Ok(r.Value) : Problem(r.Error))
            .RequirePermission(LeavePermissions.Manage, companyWide: true);

        // Multipart uploads carry the X-ERP-CSRF header like every other call, so the antiforgery token is not used.
        group.MapPost("/balances/openings", async (HttpRequest request, Guid typeId, DateOnly asOf, bool? apply, LeaveBalances balances, CancellationToken ct) =>
            {
                if (!request.HasFormContentType)
                {
                    return Results.Problem("A multipart form is required.", statusCode: StatusCodes.Status400BadRequest, title: "validation.file_empty");
                }

                var form = await request.ReadFormAsync(ct).ConfigureAwait(false);
                var file = form.Files.GetFile("file");
                if (file is null || file.Length == 0 || file.Length > 10 * 1024 * 1024 || !file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
                {
                    return Results.Problem("An .xlsx file is required.", statusCode: StatusCodes.Status400BadRequest, title: "validation.excel_file");
                }

                await using var content = new MemoryStream();
                await file.CopyToAsync(content, ct).ConfigureAwait(false);
                content.Position = 0;
                var r = await balances.ImportOpeningsAsync(content, typeId, asOf, apply ?? false, ct).ConfigureAwait(false);
                return r.IsSuccess ? Results.Ok(r.Value) : Problem(r.Error);
            })
            .DisableAntiforgery()
            .RequirePermission(LeavePermissions.Manage, companyWide: true);

        group.MapGet("/setup", async (LeaveSetup setup, CancellationToken ct) => Results.Ok(await setup.SetupAsync(ct).ConfigureAwait(false)))
            .RequirePermission(LeavePermissions.View, companyWide: true);
        group.MapPut("/settings", async (LeaveSettingsInput input, LeaveSetup setup, CancellationToken ct) => ToHttp(await setup.SaveSettingsAsync(input, ct).ConfigureAwait(false)))
            .RequirePermission(LeavePermissions.Settings, companyWide: true);
        group.MapPost("/types", async (LeaveTypeInput input, LeaveSetup setup, CancellationToken ct) => Saved(await setup.SaveTypeAsync(null, input, ct).ConfigureAwait(false)))
            .RequirePermission(LeavePermissions.Settings, companyWide: true);
        group.MapPut("/types/{id:guid}", async (Guid id, LeaveTypeInput input, LeaveSetup setup, CancellationToken ct) => Saved(await setup.SaveTypeAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(LeavePermissions.Settings, companyWide: true);
    }

    private static IResult Saved(Result<Guid> result) => result.IsSuccess ? Results.Ok(new { id = result.Value }) : Problem(result.Error);

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}
