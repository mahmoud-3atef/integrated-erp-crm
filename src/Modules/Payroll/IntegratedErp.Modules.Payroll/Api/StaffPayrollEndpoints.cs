using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Payroll.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Payroll.Api;

/// <summary>The staff payroll runs: the checks, list, create, recalculate, send, delete, the run, its lines, adjustments and register, and the pay settings and GOSI rates.</summary>
internal static class StaffPayrollEndpoints
{
    public static void MapStaffPayrollEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/payroll/staff").WithTags("Staff payroll").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/checks", async (Guid legalEntityId, string period, StaffPayrollService service, CancellationToken ct) =>
                Results.Ok(await service.ChecksAsync(legalEntityId, period, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.StaffManage, companyWide: true);
        group.MapGet("/runs", async (Guid? legalEntityId, string? tab, StaffPayrollQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ListAsync(legalEntityId, tab, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.StaffView, companyWide: true);
        group.MapPost("/runs", async (CreateStaffRunInput input, StaffPayrollService service, CancellationToken ct) =>
                await service.CreateAsync(input, ct).ConfigureAwait(false) is var r && r.IsSuccess ? Results.Ok(new { id = r.Value }) : Problem(r.Error))
            .RequirePermission(PayrollPermissions.StaffManage, companyWide: true);
        group.MapGet("/runs/{id:guid}", async (Guid id, StaffPayrollQueries queries, CancellationToken ct) =>
                await queries.GetAsync(id, ct).ConfigureAwait(false) is { } run ? Results.Ok(run) : Results.NotFound())
            .RequirePermission(PayrollPermissions.StaffView, companyWide: true);
        group.MapGet("/runs/{id:guid}/lines", async (Guid id, string? search, Guid? department, string? note, string? sort, bool? desc, int? page, int? pageSize, StaffPayrollQueries queries, CancellationToken ct) =>
                await queries.LinesAsync(id, new StaffLineQuery(search, department, note, sort, desc ?? false, page ?? 1, pageSize ?? 25), ct).ConfigureAwait(false) is { } lines
                    ? Results.Ok(lines)
                    : Results.NotFound())
            .RequirePermission(PayrollPermissions.StaffView, companyWide: true);
        group.MapGet("/runs/{id:guid}/lines/{lineId:guid}", async (Guid id, Guid lineId, StaffPayrollQueries queries, CancellationToken ct) =>
                await queries.LineAsync(id, lineId, ct).ConfigureAwait(false) is { } line ? Results.Ok(line) : Results.NotFound())
            .RequirePermission(PayrollPermissions.StaffView, companyWide: true);
        group.MapGet("/runs/{id:guid}/deferred", async (Guid id, StaffPayrollQueries queries, CancellationToken ct) =>
                await queries.DeferredAsync(id, ct).ConfigureAwait(false) is { } list ? Results.Ok(list) : Results.NotFound())
            .RequirePermission(PayrollPermissions.StaffView, companyWide: true);
        group.MapGet("/runs/{id:guid}/excel", async (Guid id, string? search, Guid? department, string? note, string? sort, bool? desc, StaffPayrollQueries queries, CancellationToken ct) =>
            {
                var query = new StaffLineQuery(search, department, note, sort, desc ?? false, 1, int.MaxValue);
                if (await queries.ScopeAsync(id, query, ct).ConfigureAwait(false) is not { } scope)
                {
                    return Results.NotFound();
                }

                var filtered = !string.IsNullOrWhiteSpace(search) || !string.IsNullOrWhiteSpace(note) || department is not null;
                return Results.File(StaffPayrollWorkbook.Build(scope.Run, scope.Lines, filtered), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{scope.Run.RunNo}.xlsx");
            })
            .RequirePermission(PayrollPermissions.StaffView, companyWide: true);
        group.MapPost("/runs/{id:guid}/recalculate", async (Guid id, StaffPayrollService service, CancellationToken ct) => ToHttp(await service.RecalculateAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.StaffManage, companyWide: true);
        group.MapPost("/runs/{id:guid}/submit", async (Guid id, StaffPayrollService service, CancellationToken ct) => ToHttp(await service.SubmitAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.StaffManage, companyWide: true);
        group.MapDelete("/runs/{id:guid}", async (Guid id, StaffPayrollService service, CancellationToken ct) => ToHttp(await service.DeleteAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.StaffManage, companyWide: true);
        group.MapPost("/runs/{id:guid}/adjustments", async (Guid id, StaffAdjustmentRequest input, StaffPayrollService service, CancellationToken ct) => ToHttp(await service.AddAdjustmentAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.StaffManage, companyWide: true);
        group.MapDelete("/runs/{id:guid}/adjustments/{adjustmentId:guid}", async (Guid id, Guid adjustmentId, StaffPayrollService service, CancellationToken ct) =>
                ToHttp(await service.RemoveAdjustmentAsync(id, adjustmentId, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.StaffManage, companyWide: true);

        group.MapGet("/employees/{employeeId:guid}/lines", async (Guid employeeId, StaffPayrollQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.EmployeeAsync(employeeId, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.StaffView, companyWide: true);

        group.MapGet("/settings", async (StaffPayrollService service, CancellationToken ct) => Results.Ok(await service.SettingsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.StaffView, companyWide: true);
        group.MapPut("/settings", async (PaySettingsDto input, StaffPayrollService service, CancellationToken ct) => ToHttp(await service.SaveSettingsAsync(input, ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.SettingsManage, companyWide: true);
        group.MapGet("/gosi-rates", async (StaffPayrollService service, CancellationToken ct) => Results.Ok(await service.GosiRatesAsync(ct).ConfigureAwait(false)))
            .RequirePermission(PayrollPermissions.StaffView, companyWide: true);
        group.MapPost("/gosi-rates", async (GosiRateInput input, StaffPayrollService service, CancellationToken ct) =>
                await service.SaveGosiRateAsync(null, input, ct).ConfigureAwait(false) is var r && r.IsSuccess ? Results.Ok(new { id = r.Value }) : Problem(r.Error))
            .RequirePermission(PayrollPermissions.SettingsManage, companyWide: true);
        group.MapPut("/gosi-rates/{id:guid}", async (Guid id, GosiRateInput input, StaffPayrollService service, CancellationToken ct) =>
                await service.SaveGosiRateAsync(id, input, ct).ConfigureAwait(false) is var r && r.IsSuccess ? Results.Ok(new { id = r.Value }) : Problem(r.Error))
            .RequirePermission(PayrollPermissions.SettingsManage, companyWide: true);
    }

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}
