using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.Modules.Staff.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Staff.Api;

/// <summary>The staff: the directory and its cards, an employee's file and its changes, the organisation and its catalogues.</summary>
internal static class StaffEndpoints
{
    public static void MapStaffEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/staff").WithTags("Staff").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/employees", async (string? search, string? tab, Guid? departmentId, Guid? legalEntityId, string? sort, bool? desc, int? page, int? pageSize, StaffQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.DirectoryAsync(new StaffQuery(search, tab, departmentId, legalEntityId, sort, desc ?? false, page ?? 1, pageSize ?? 25), ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.View, companyWide: true);

        group.MapGet("/employees/kpis", async (StaffQueries queries, CancellationToken ct) => Results.Ok(await queries.KpisAsync(ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.View, companyWide: true);

        group.MapGet("/employees/pick", async (string? search, StaffQueries queries, CancellationToken ct) => Results.Ok(await queries.PeopleAsync(search, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.View, companyWide: true);

        group.MapGet("/employees/{id:guid}", async (Guid id, StaffQueries queries, CancellationToken ct) =>
                await queries.ProfileAsync(id, ct).ConfigureAwait(false) is { } profile ? Results.Ok(profile) : Results.NotFound())
            .RequirePermission(StaffPermissions.View, companyWide: true);

        group.MapGet("/employees/{id:guid}/history", async (Guid id, StaffQueries queries, CancellationToken ct) =>
                await queries.HistoryAsync(id, ct).ConfigureAwait(false) is { } history ? Results.Ok(history) : Results.NotFound())
            .RequirePermission(StaffPermissions.View, companyWide: true);

        group.MapPost("/employees", async (HireInput input, StaffService service, CancellationToken ct) =>
                await service.HireAsync(input, ct).ConfigureAwait(false) is var result && result.IsSuccess ? Results.Ok(new { id = result.Value }) : Problem(result.Error))
            .RequirePermission(StaffPermissions.Manage, companyWide: true);

        group.MapPost("/employees/import", async (StaffService service, CancellationToken ct) => Results.Ok(await service.ImportAsync(ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.Manage, companyWide: true);

        group.MapPut("/employees/{id:guid}/personal", async (Guid id, PersonalInput input, StaffService service, CancellationToken ct) =>
                ToHttp(await service.SetPersonalAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.Manage, companyWide: true);

        group.MapGet("/employees/update-template", async (string? lang, StaffBulkUpdate bulk, CancellationToken ct) =>
                Results.File(await bulk.TemplateAsync(lang != "en", ct).ConfigureAwait(false), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "staff-update.xlsx"))
            .RequirePermission(StaffPermissions.BulkUpdate, companyWide: true);

        group.MapPost("/employees/bulk-update", async (HttpRequest request, bool? apply, StaffBulkUpdate bulk, CancellationToken ct) =>
            {
                if (!request.HasFormContentType)
                {
                    return Results.Problem("A multipart form is required.", statusCode: StatusCodes.Status400BadRequest, title: "validation.file_empty");
                }

                var form = await request.ReadFormAsync(ct).ConfigureAwait(false);
                var file = form.Files.GetFile("file");
                if (file is null || file.Length > 10 * 1024 * 1024 || file.Length == 0 || !file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
                {
                    return Results.Problem("An .xlsx file is required.", statusCode: StatusCodes.Status400BadRequest, title: "validation.excel_file");
                }

                await using var content = new MemoryStream();
                await file.CopyToAsync(content, ct).ConfigureAwait(false);
                content.Position = 0;
                return Results.Ok(await bulk.RunAsync(content, apply ?? false, ct).ConfigureAwait(false));
            })
            .DisableAntiforgery()
            .RequirePermission(StaffPermissions.BulkUpdate, companyWide: true);

        group.MapPut("/employees/{id:guid}/pay-details", async (Guid id, PayDetailsInput input, StaffService service, CancellationToken ct) =>
                ToHttp(await service.SetPayDetailsAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.BankManage, companyWide: true);

        group.MapPut("/employees/{id:guid}/job", async (Guid id, JobInput input, StaffService service, CancellationToken ct) =>
                ToHttp(await service.SetJobAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.Manage, companyWide: true);

        group.MapPut("/employees/{id:guid}/contract", async (Guid id, ContractInput input, StaffService service, CancellationToken ct) =>
                ToHttp(await service.SetContractAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.Manage, companyWide: true);

        group.MapPost("/employees/{id:guid}/salary", async (Guid id, SalaryChangeInput input, StaffService service, CancellationToken ct) =>
                ToHttp(await service.ChangeSalaryAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.SalariesManage, companyWide: true);

        group.MapGet("/user-links", async (StaffQueries queries, CancellationToken ct) => Results.Ok(await queries.UserLinksAsync(ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.View, companyWide: true);

        group.MapPut("/user-links/{userId:guid}", async (Guid userId, UserLinkInput input, StaffService service, CancellationToken ct) =>
                ToHttp(await service.LinkUserAsync(userId, input.EmployeeId, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.Manage, companyWide: true);

        group.MapGet("/nationalities", async (IReferenceData reference, CancellationToken ct) =>
                Results.Ok((await reference.ListAsync(ReferenceListCodes.Nationalities, ct).ConfigureAwait(false)).Select(n => new { n.Code, n.NameAr, n.NameEn })))
            .RequirePermission(StaffPermissions.View, companyWide: true);

        group.MapGet("/employees/{id:guid}/contracts", async (Guid id, StaffActionQueries queries, CancellationToken ct) => Results.Ok(await queries.ContractsAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.View, companyWide: true);

        group.MapPost("/employees/{id:guid}/actions", async (Guid id, ActionInput input, StaffActionService service, CancellationToken ct) =>
                await service.RequestAsync(id, input, ct).ConfigureAwait(false) is var result && result.IsSuccess ? Results.Ok(new { id = result.Value }) : Problem(result.Error))
            .RequirePermission(StaffPermissions.Manage, companyWide: true);

        group.MapGet("/actions", async (Guid? employeeId, string? status, StaffActionQueries queries, CancellationToken ct) => Results.Ok(await queries.ListAsync(employeeId, status, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.View, companyWide: true);

        group.MapGet("/actions/{id:guid}", async (Guid id, StaffActionQueries queries, CancellationToken ct) =>
                await queries.GetAsync(id, ct).ConfigureAwait(false) is { } action ? Results.Ok(action) : Results.NotFound())
            .RequirePermission(StaffPermissions.View, companyWide: true);

        // Each kind of action has its own permissions to change or cancel it after its approval (checked by the service).
        group.MapPut("/actions/{id:guid}/amend", async (Guid id, ActionAmendInput input, StaffActionService service, CancellationToken ct) => ToHttp(await service.AmendAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.View, companyWide: true);
        group.MapPost("/actions/{id:guid}/cancel-approved", async (Guid id, ActionCancelInput input, StaffActionService service, CancellationToken ct) => ToHttp(await service.CancelApprovedAsync(id, input.Reason, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.View, companyWide: true);
        group.MapPost("/actions/{id:guid}/resubmit", async (Guid id, StaffActionService service, CancellationToken ct) => ToHttp(await service.ResubmitAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.Manage, companyWide: true);

        group.MapGet("/structure", async (StaffQueries queries, CancellationToken ct) => Results.Ok(await queries.StructureAsync(ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.View, companyWide: true);

        group.MapGet("/catalog", async (StaffQueries queries, CancellationToken ct) => Results.Ok(await queries.CatalogAsync(ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.View, companyWide: true);

        group.MapPost("/departments", async (DepartmentInput input, StructureService service, CancellationToken ct) => Saved(await service.SaveDepartmentAsync(null, input, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.StructureManage, companyWide: true);
        group.MapPut("/departments/{id:guid}", async (Guid id, DepartmentInput input, StructureService service, CancellationToken ct) => Saved(await service.SaveDepartmentAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.StructureManage, companyWide: true);
        group.MapDelete("/departments/{id:guid}", async (Guid id, StructureService service, CancellationToken ct) => ToHttp(await service.DeleteDepartmentAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.StructureManage, companyWide: true);

        group.MapPost("/positions", async (PositionInput input, StructureService service, CancellationToken ct) => Saved(await service.SavePositionAsync(null, input, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.StructureManage, companyWide: true);
        group.MapPut("/positions/{id:guid}", async (Guid id, PositionInput input, StructureService service, CancellationToken ct) => Saved(await service.SavePositionAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.StructureManage, companyWide: true);
        group.MapDelete("/positions/{id:guid}", async (Guid id, StructureService service, CancellationToken ct) => ToHttp(await service.DeletePositionAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.StructureManage, companyWide: true);

        group.MapPost("/job-titles", async (JobTitleInput input, StructureService service, CancellationToken ct) => Saved(await service.SaveJobTitleAsync(null, input, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.StructureManage, companyWide: true);
        group.MapPut("/job-titles/{id:guid}", async (Guid id, JobTitleInput input, StructureService service, CancellationToken ct) => Saved(await service.SaveJobTitleAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.StructureManage, companyWide: true);

        group.MapPost("/grades", async (GradeInput input, StructureService service, CancellationToken ct) => Saved(await service.SaveGradeAsync(null, input, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.StructureManage, companyWide: true);
        group.MapPut("/grades/{id:guid}", async (Guid id, GradeInput input, StructureService service, CancellationToken ct) => Saved(await service.SaveGradeAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(StaffPermissions.StructureManage, companyWide: true);
    }

    private static IResult Saved(Result<Guid> result) => result.IsSuccess ? Results.Ok(new { id = result.Value }) : Problem(result.Error);

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : error.Code.StartsWith("forbidden.", StringComparison.Ordinal) ? StatusCodes.Status403Forbidden
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}

public sealed record ActionCancelInput(string Reason);
