using System.Text.Json;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Attendance.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Attendance.Api;

/// <summary>The attendance month and an employee's days, the fingerprint file's import, and the shifts and calendar.</summary>
internal static class AttendanceEndpoints
{
    public static void MapAttendanceEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/attendance").WithTags("Attendance").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/months/{period}", async (string period, Guid? legalEntityId, AttendanceQueries queries, CancellationToken ct) =>
                await queries.MonthAsync(period, legalEntityId, ct).ConfigureAwait(false) is { } month ? Results.Ok(month) : Results.NotFound())
            .RequirePermission(AttendancePermissions.View, companyWide: true);

        group.MapGet("/months/{period}/employees", async (string period, Guid? legalEntityId, string? search, Guid? departmentId, Guid? shiftId, string? state, string? sort, bool? desc, int? page, int? pageSize, AttendanceQueries queries, CancellationToken ct) =>
                await queries.EmployeesAsync(period, new MonthQuery(legalEntityId, search, departmentId, shiftId, state, sort, desc ?? false, page ?? 1, pageSize ?? 25), ct).ConfigureAwait(false) is { } rows ? Results.Ok(rows) : Results.NotFound())
            .RequirePermission(AttendancePermissions.View, companyWide: true);

        group.MapGet("/months/{period}/exceptions", async (string period, Guid? legalEntityId, AttendanceQueries queries, CancellationToken ct) =>
                await queries.ExceptionsAsync(period, legalEntityId, ct).ConfigureAwait(false) is { } list ? Results.Ok(list) : Results.NotFound())
            .RequirePermission(AttendancePermissions.View, companyWide: true);

        group.MapGet("/months/{period}/employees/{id:guid}", async (string period, Guid id, AttendanceQueries queries, CancellationToken ct) =>
                await queries.EmployeeAsync(period, id, ct).ConfigureAwait(false) is { } days ? Results.Ok(days) : Results.NotFound())
            .RequirePermission(AttendancePermissions.View, companyWide: true);

        group.MapGet("/months/by-id/{id:guid}", async (Guid id, AttendanceQueries queries, CancellationToken ct) =>
                await queries.PeriodOfAsync(id, ct).ConfigureAwait(false) is { } period ? Results.Ok(new { period }) : Results.NotFound())
            .RequirePermission(AttendancePermissions.View, companyWide: true);

        group.MapPost("/months/{period}/submit", async (string period, MonthClosing closing, CancellationToken ct) => Saved(await closing.SubmitAsync(period, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.Manage, companyWide: true);

        group.MapPost("/months/{period}/reopen", async (string period, ReopenInput input, MonthClosing closing, CancellationToken ct) => ToHttp(await closing.ReopenAsync(period, input, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.MonthReopen, companyWide: true);

        group.MapGet("/months/{period}/overtime", async (string period, AttendanceQueries queries, CancellationToken ct) =>
                await queries.OvertimeAsync(period, ct).ConfigureAwait(false) is { } list ? Results.Ok(list) : Results.NotFound())
            .RequirePermission(AttendancePermissions.View, companyWide: true);

        group.MapGet("/overtime/{id:guid}", async (Guid id, AttendanceQueries queries, CancellationToken ct) =>
                await queries.OvertimeRequestAsync(id, ct).ConfigureAwait(false) is { } request ? Results.Ok(request) : Results.NotFound())
            .RequirePermission(AttendancePermissions.View, companyWide: true);

        group.MapPost("/overtime", async (OvertimeInput input, OvertimeService service, CancellationToken ct) => Saved(await service.RequestAsync(input, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.Manage, companyWide: true);

        group.MapPut("/overtime/{id:guid}/amend", async (Guid id, OvertimeAmendInput input, OvertimeService service, CancellationToken ct) => ToHttp(await service.AmendAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.OvertimeAmend, companyWide: true);
        group.MapPost("/overtime/{id:guid}/cancel-approved", async (Guid id, ReopenInput input, OvertimeService service, CancellationToken ct) => ToHttp(await service.CancelApprovedAsync(id, input.Reason, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.OvertimeCancelApproved, companyWide: true);
        group.MapPost("/overtime/{id:guid}/resubmit", async (Guid id, OvertimeInput input, OvertimeService service, CancellationToken ct) => Saved(await service.ResubmitAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.Manage, companyWide: true);

        group.MapPut("/employees/{id:guid}/days/{date}", async (Guid id, DateOnly date, CorrectionInput input, AttendanceService service, CancellationToken ct) =>
                ToHttp(await service.CorrectAsync(id, date, input, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.Manage, companyWide: true);

        group.MapPut("/employees/{id:guid}/setting", async (Guid id, EmployeeSettingInput input, AttendanceSetup setup, CancellationToken ct) =>
                ToHttp(await setup.SaveEmployeeAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.Manage, companyWide: true);

        group.MapGet("/imports", async (AttendanceQueries queries, CancellationToken ct) => Results.Ok(await queries.ImportsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.View, companyWide: true);

        // Multipart uploads carry the X-ERP-CSRF header like every other call, so the antiforgery token is not used.
        group.MapPost("/imports/preview", async (HttpRequest request, AttendanceImporter importer, CancellationToken ct) =>
                await UploadAsync(request, (content, mapping, _) => importer.PreviewAsync(content, mapping, ct), ct).ConfigureAwait(false))
            .DisableAntiforgery()
            .RequirePermission(AttendancePermissions.Manage, companyWide: true);

        group.MapPost("/imports", async (HttpRequest request, AttendanceImporter importer, CancellationToken ct) =>
                await UploadAsync(request, (content, mapping, name) => importer.ApplyAsync(content, mapping, name, ct), ct).ConfigureAwait(false))
            .DisableAntiforgery()
            .RequirePermission(AttendancePermissions.Manage, companyWide: true);

        group.MapGet("/setup", async (int? year, AttendanceSetup setup, CancellationToken ct) =>
                Results.Ok(await setup.SetupAsync(year ?? DateTime.Today.Year, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.View, companyWide: true);

        group.MapPut("/settings", async (SettingsInput input, AttendanceSetup setup, CancellationToken ct) => ToHttp(await setup.SaveSettingsAsync(input, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.Settings, companyWide: true);

        group.MapPost("/shifts", async (ShiftInput input, AttendanceSetup setup, CancellationToken ct) => Saved(await setup.SaveShiftAsync(null, input, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.Settings, companyWide: true);
        group.MapPut("/shifts/{id:guid}", async (Guid id, ShiftInput input, AttendanceSetup setup, CancellationToken ct) => Saved(await setup.SaveShiftAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.Settings, companyWide: true);
        group.MapDelete("/shifts/{id:guid}", async (Guid id, AttendanceSetup setup, CancellationToken ct) => ToHttp(await setup.DeleteShiftAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.Settings, companyWide: true);

        group.MapPost("/assignments", async (AssignmentInput input, AttendanceSetup setup, CancellationToken ct) => Saved(await setup.AssignAsync(input, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.Settings, companyWide: true);
        group.MapDelete("/assignments/{id:guid}", async (Guid id, AttendanceSetup setup, CancellationToken ct) => ToHttp(await setup.UnassignAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.Settings, companyWide: true);

        group.MapPost("/holidays", async (HolidayInput input, AttendanceSetup setup, CancellationToken ct) => Saved(await setup.SaveHolidayAsync(null, input, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.Settings, companyWide: true);
        group.MapPut("/holidays/{id:guid}", async (Guid id, HolidayInput input, AttendanceSetup setup, CancellationToken ct) => Saved(await setup.SaveHolidayAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.Settings, companyWide: true);
        group.MapDelete("/holidays/{id:guid}", async (Guid id, AttendanceSetup setup, CancellationToken ct) => ToHttp(await setup.DeleteHolidayAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(AttendancePermissions.Settings, companyWide: true);
    }

    /// <summary>Reads the uploaded file (form field "file", .xlsx up to 10 MB) and the optional column mapping (form field "mapping", JSON).</summary>
    private static async Task<IResult> UploadAsync(HttpRequest request, Func<Stream, IReadOnlyDictionary<string, string>?, string, Task<Result<ImportPreview>>> handle, CancellationToken ct)
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

        Dictionary<string, string>? mapping = null;
        if (form.TryGetValue("mapping", out var raw) && !string.IsNullOrWhiteSpace(raw))
        {
            try
            {
                mapping = JsonSerializer.Deserialize<Dictionary<string, string>>(raw.ToString());
            }
            catch (JsonException)
            {
                return Results.Problem("The column mapping is not valid.", statusCode: StatusCodes.Status400BadRequest, title: "validation.attendance_mapping");
            }
        }

        await using var content = new MemoryStream();
        await file.CopyToAsync(content, ct).ConfigureAwait(false);
        content.Position = 0;
        var result = await handle(content, mapping, Path.GetFileName(file.FileName)).ConfigureAwait(false);
        return result.IsSuccess ? Results.Ok(result.Value) : Problem(result.Error);
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
