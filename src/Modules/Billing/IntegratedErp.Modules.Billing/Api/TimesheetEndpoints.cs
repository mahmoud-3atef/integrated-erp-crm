using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.BuildingBlocks.Time;
using IntegratedErp.Modules.Billing.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Billing.Api;

/// <summary>Monthly project timesheets: the month's projects, a timesheet with its outputs, adjustments and approval.</summary>
internal static class TimesheetEndpoints
{
    public static void MapTimesheetEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/billing").WithTags("Billing").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/timesheets", async (DateOnly? month, TimesheetQueries queries, IClock clock, CancellationToken ct) =>
                Results.Ok(await queries.MonthAsync(month ?? clock.Today, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.TimesheetsView, companyWide: true);

        group.MapGet("/timesheets/{id:guid}", async (Guid id, TimesheetQueries queries, CancellationToken ct) =>
                await queries.GetAsync(id, ct).ConfigureAwait(false) is { } timesheet ? Results.Ok(timesheet) : Results.NotFound())
            .RequirePermission(BillingPermissions.TimesheetsView, companyWide: true);

        group.MapPost("/timesheets/generate", async (GenerateInput input, TimesheetService service, CancellationToken ct) =>
                await service.GenerateAsync(input, ct).ConfigureAwait(false) is var result && result.IsSuccess ? Results.Ok(new { id = result.Value }) : Problem(result.Error))
            .RequirePermission(BillingPermissions.TimesheetsManage, companyWide: true);

        group.MapPost("/timesheets/{id:guid}/adjustments", async (Guid id, AdjustmentInput input, TimesheetService service, CancellationToken ct) =>
                ToHttp(await service.AdjustAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.TimesheetsManage, companyWide: true);

        group.MapDelete("/timesheets/{id:guid}/adjustments/{adjustmentId:guid}", async (Guid id, Guid adjustmentId, TimesheetService service, CancellationToken ct) =>
                ToHttp(await service.RemoveAdjustmentAsync(id, adjustmentId, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.TimesheetsManage, companyWide: true);

        group.MapGet("/timesheets/{id:guid}/excel", async (Guid id, TimesheetService service, CancellationToken ct) =>
                await service.ExportAsync(id, ct).ConfigureAwait(false) is { } file
                    ? Results.File(file.Content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", file.FileName)
                    : Results.NotFound())
            .RequirePermission(BillingPermissions.TimesheetsView, companyWide: true);

        // Multipart uploads carry the X-ERP-CSRF header like every other call, so the antiforgery token is not used.
        group.MapPost("/timesheets/{id:guid}/excel/preview", async (Guid id, HttpRequest request, TimesheetService service, CancellationToken ct) =>
                await UploadAsync(request, content => service.PreviewAsync(id, content, ct), ct).ConfigureAwait(false))
            .DisableAntiforgery()
            .RequirePermission(BillingPermissions.TimesheetsManage, companyWide: true);

        group.MapPost("/timesheets/{id:guid}/excel/apply", async (Guid id, HttpRequest request, TimesheetService service, CancellationToken ct) =>
                await UploadAsync(request, content => service.ApplyExcelAsync(id, content, ct), ct).ConfigureAwait(false))
            .DisableAntiforgery()
            .RequirePermission(BillingPermissions.TimesheetsManage, companyWide: true);

        group.MapPost("/timesheets/{id:guid}/submit", async (Guid id, TimesheetService service, CancellationToken ct) =>
                ToHttp(await service.SubmitAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.TimesheetsManage, companyWide: true);

        group.MapGet("/projects/{projectId:guid}/settings", async (Guid projectId, TimesheetService service, CancellationToken ct) =>
                Results.Ok(await service.SettingsAsync(projectId, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.TimesheetsView, companyWide: true);

        group.MapPut("/projects/{projectId:guid}/settings", async (Guid projectId, BillingSettingsDto input, TimesheetService service, CancellationToken ct) =>
                ToHttp(await service.SaveSettingsAsync(projectId, input, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.TimesheetsManage, companyWide: true);
    }

    /// <summary>Reads the uploaded file (form field "file", up to 10 MB) and hands it to the service.</summary>
    private static async Task<IResult> UploadAsync(HttpRequest request, Func<Stream, Task<Result<ExcelPreview>>> handle, CancellationToken ct)
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
        var result = await handle(content).ConfigureAwait(false);
        return result.IsSuccess ? Results.Ok(result.Value) : Problem(result.Error);
    }

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}
