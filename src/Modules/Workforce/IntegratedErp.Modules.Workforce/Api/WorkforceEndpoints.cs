using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Workforce.Application;
using IntegratedErp.Modules.Workforce.Contracts;
using IntegratedErp.Modules.Workforce.Domain;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Workforce.Api;

/// <summary>
/// Workers (/workers) and company staff (/staff) of the current company, read-only in the parallel phase: separate
/// lists with separate permissions, and salaries need their own permission for each.
/// </summary>
internal static class WorkforceEndpoints
{
    public static void MapWorkforceEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/workforce").WithTags("Workforce").RequireAuthorization(PlatformPolicies.CompanyUser);
        Map(group, "workers", WorkerKind.Worker, WorkforcePermissions.WorkersView, WorkforcePermissions.WorkersSalary);
        Map(group, "staff", WorkerKind.Staff, WorkforcePermissions.StaffView, WorkforcePermissions.StaffSalary);

        group.MapGet("/dashboard", async (WorkforceDashboard dashboard, CancellationToken ct) => Results.Ok(await dashboard.GetAsync(ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.WorkersView, companyWide: true);

        group.MapGet("/invoice-check", async (DateOnly? month, string? result, string? search, int? page, int? pageSize, InvoiceCheckQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ListAsync(month, result, search, page ?? 1, pageSize ?? 50, ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.WorkersView, companyWide: true);

        MapShowcase(group);
        MapCosts(group);
        MapEdits(group);

        group.MapGet("/history/issues", async (string? code, string? search, Guid? workerId, int? page, int? pageSize, HistoryQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.IssuesAsync(code, search, workerId, page ?? 1, pageSize ?? 50, ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.WorkersView, companyWide: true);
    }

    /// <summary>Changing a worker's file (2026-10-25): the data, the salary directly, or a salary change through approval.</summary>
    private static void MapEdits(RouteGroupBuilder group)
    {
        group.MapGet("/edit-options", async (WorkerEditService service, CancellationToken ct) => Results.Ok(await service.OptionsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.WorkersView, companyWide: true);
        group.MapPut("/workers/{id:guid}/data", async (Guid id, WorkerDataInput input, WorkerEditService service, CancellationToken ct) =>
                Http(await service.EditAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.WorkersEdit, companyWide: true);
        group.MapPut("/workers/{id:guid}/salary", async (Guid id, SalaryInput input, WorkerEditService service, CancellationToken ct) =>
                Http(await service.SetSalaryAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.WorkersSalaryEdit, companyWide: true);
        group.MapPost("/workers/{id:guid}/salary-changes", async (Guid id, SalaryChangeInput input, WorkerEditService service, CancellationToken ct) =>
            {
                var created = await service.RequestSalaryChangeAsync(id, input, ct).ConfigureAwait(false);
                return created.IsSuccess ? Results.Ok(new { id = created.Value }) : Http(Result.Failure(created.Error));
            })
            .RequirePermission(WorkforcePermissions.SalaryChangesRequest, companyWide: true);

        // A salary change shows salaries: those who see salaries, ask for a change or approve one.
        group.MapGet("/workers/{id:guid}/salary-changes", async (Guid id, WorkerEditService service, IPermissionService permissions, CancellationToken ct) =>
                await SeesChangesAsync(permissions, ct).ConfigureAwait(false) ? Results.Ok(await service.ChangesAsync(id, ct).ConfigureAwait(false)) : Results.Forbid())
            .RequirePermission(WorkforcePermissions.WorkersView, companyWide: true);
        group.MapGet("/salary-changes/{id:guid}", async (Guid id, WorkerEditService service, IPermissionService permissions, CancellationToken ct) =>
                !await SeesChangesAsync(permissions, ct).ConfigureAwait(false) ? Results.Forbid()
                : await service.ChangeAsync(id, ct).ConfigureAwait(false) is { } change ? Results.Ok(change) : Results.NotFound())
            .RequirePermission(WorkforcePermissions.WorkersView, companyWide: true);
    }

    private static async Task<bool> SeesChangesAsync(IPermissionService permissions, CancellationToken ct)
    {
        var mine = await permissions.GetCurrentAsync(ct).ConfigureAwait(false);
        return mine.Has(WorkforcePermissions.WorkersSalary) || mine.Has(WorkforcePermissions.SalaryChangesRequest) || mine.Has(WorkforcePermissions.SalaryChangesApprove);
    }

    /// <summary>The suppliers' worker costs (docs/03-migration-plan/16): packages, cards, an Excel round trip.</summary>
    private static void MapCosts(RouteGroupBuilder group)
    {
        const string Xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        group.MapGet("/costs", async (WorkerCostService service, CancellationToken ct) => Results.Ok(await service.OverviewAsync(ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.CostsView, companyWide: true);
        group.MapGet("/costs/options", async (WorkerCostService service, CancellationToken ct) => Results.Ok(await service.OptionsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.CostsView, companyWide: true);
        group.MapGet("/costs/packages", async (WorkerCostService service, CancellationToken ct) => Results.Ok(await service.PackagesAsync(ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.CostsView, companyWide: true);
        group.MapPost("/costs/packages", async (CostInput input, WorkerCostService service, CancellationToken ct) =>
            {
                var result = await service.SavePackageAsync(null, input, ct).ConfigureAwait(false);
                return result.IsSuccess ? Results.Ok(new { id = result.Value }) : Http(result);
            })
            .RequirePermission(WorkforcePermissions.CostsManage, companyWide: true);
        group.MapPut("/costs/packages/{id:guid}", async (Guid id, CostInput input, WorkerCostService service, CancellationToken ct) =>
                Http(await service.SavePackageAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.CostsManage, companyWide: true);
        group.MapDelete("/costs/packages/{id:guid}", async (Guid id, WorkerCostService service, CancellationToken ct) =>
                Http(await service.DeletePackageAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.CostsManage, companyWide: true);
        group.MapGet("/costs/workers", async (string? supplier, bool? missing, string? search, WorkerCostService service, CancellationToken ct) =>
                Results.Ok(await service.WorkersAsync(supplier, missing, search, ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.CostsView, companyWide: true);
        group.MapGet("/costs/template", async (string? supplier, WorkerCostService service, CancellationToken ct) =>
                Results.File(await service.TemplateAsync(supplier, ct).ConfigureAwait(false), Xlsx, "worker-costs.xlsx"))
            .RequirePermission(WorkforcePermissions.CostsView, companyWide: true);
        group.MapPost("/costs/import", async (HttpRequest request, WorkerCostService service, CancellationToken ct) =>
            {
                if (!request.HasFormContentType || (await request.ReadFormAsync(ct).ConfigureAwait(false)).Files is not { Count: > 0 } files)
                {
                    return Results.Problem("Upload an Excel file.", statusCode: StatusCodes.Status400BadRequest, title: "validation.excel_file");
                }

                await using var stream = files[0].OpenReadStream();
                var result = await service.ImportAsync(stream, ct).ConfigureAwait(false);
                return result.IsSuccess ? Results.Ok(result.Value) : Http(result);
            })
            .DisableAntiforgery()
            .RequirePermission(WorkforcePermissions.CostsManage, companyWide: true);
        group.MapGet("/workers/{id:guid}/cost", async (Guid id, WorkerCostService service, IPermissionService permissions, CancellationToken ct) =>
            {
                var withSalary = (await permissions.GetCurrentAsync(ct).ConfigureAwait(false)).Has(WorkforcePermissions.WorkersSalary);
                return await service.WorkerAsync(id, withSalary, ct).ConfigureAwait(false) is { } cost ? Results.Ok(cost) : Results.NotFound();
            })
            .RequirePermission(WorkforcePermissions.CostsView, companyWide: true);
        group.MapPost("/workers/{id:guid}/cost", async (Guid id, CostInput input, WorkerCostService service, CancellationToken ct) =>
                Http(await service.AddCardAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.CostsManage, companyWide: true);
        group.MapDelete("/workers/{id:guid}/cost/{cardId:guid}", async (Guid id, Guid cardId, WorkerCostService service, CancellationToken ct) =>
                Http(await service.DeleteCardAsync(id, cardId, ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.CostsManage, companyWide: true);
    }

    /// <summary>The workers' marketing profile and photos (docs/03-migration-plan/15).</summary>
    private static void MapShowcase(RouteGroupBuilder group)
    {
        group.MapGet("/profile-lists", async (WorkerShowcaseService service, CancellationToken ct) => Results.Ok(await service.ListsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.WorkersView, companyWide: true);

        group.MapGet("/workers/{id:guid}/profile", async (Guid id, WorkerShowcaseService service, CancellationToken ct) =>
                await service.GetAsync(id, ct).ConfigureAwait(false) is { } profile ? Results.Ok(profile) : Results.NotFound())
            .RequirePermission(WorkforcePermissions.WorkersView, companyWide: true);

        group.MapPut("/workers/{id:guid}/profile", async (Guid id, WorkerProfileInput input, WorkerShowcaseService service, CancellationToken ct) =>
                Http(await service.UpdateAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.ProfileEdit, companyWide: true);

        group.MapPost("/workers/{id:guid}/photos", async (Guid id, HttpRequest request, WorkerShowcaseService service, CancellationToken ct) =>
            {
                if (!request.HasFormContentType)
                {
                    return Results.Problem("Send the photo as a form file.", statusCode: StatusCodes.Status400BadRequest, title: "validation.photo_not_image");
                }

                var form = await request.ReadFormAsync(ct).ConfigureAwait(false);
                if (form.Files.Count == 0)
                {
                    return Results.Problem("Send the photo as a form file.", statusCode: StatusCodes.Status400BadRequest, title: "validation.photo_not_image");
                }

                var file = form.Files[0];
                await using var stream = file.OpenReadStream();
                var result = await service.AddPhotoAsync(id, stream, file.Length, ct).ConfigureAwait(false);
                return result.IsSuccess ? Results.Ok(new { id = result.Value }) : Http(result);
            })
            .DisableAntiforgery()
            .RequirePermission(WorkforcePermissions.ProfileEdit, companyWide: true);

        // A photo: for whoever sees the workers or the showroom (never cached by shared proxies).
        group.MapGet("/workers/{id:guid}/photos/{photoId:guid}", async (Guid id, Guid photoId, WorkerShowcaseService service, IPermissionService permissions, HttpContext http, CancellationToken ct) =>
            {
                var mine = await permissions.GetCurrentAsync(ct).ConfigureAwait(false);
                if (!mine.Has(WorkforcePermissions.WorkersView) && !mine.Has(WorkforcePermissions.ShowroomView))
                {
                    return Results.Forbid();
                }

                if (await service.PhotoAsync(id, photoId, ct).ConfigureAwait(false) is not { } photo)
                {
                    return Results.NotFound();
                }

                http.Response.Headers.CacheControl = "private, max-age=86400";
                return Results.File(photo.Content, photo.ContentType);
            });

        group.MapDelete("/workers/{id:guid}/photos/{photoId:guid}", async (Guid id, Guid photoId, WorkerShowcaseService service, CancellationToken ct) =>
                Http(await service.DeletePhotoAsync(id, photoId, ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.ProfileEdit, companyWide: true);

        group.MapPost("/workers/{id:guid}/photos/{photoId:guid}/main", async (Guid id, Guid photoId, WorkerShowcaseService service, CancellationToken ct) =>
                Http(await service.MakeMainAsync(id, photoId, ct).ConfigureAwait(false)))
            .RequirePermission(WorkforcePermissions.ProfileEdit, companyWide: true);
    }

    private static IResult Http(Result result) =>
        result.IsSuccess ? Results.NoContent()
        : Results.Problem(
            result.Error.Message,
            statusCode: result.Error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound : StatusCodes.Status400BadRequest,
            title: result.Error.Code);

    private static void Map(RouteGroupBuilder group, string path, WorkerKind kind, string view, string salary)
    {
        group.MapGet($"/{path}", async (
                string? search, string? placement, string? sort, bool? desc, int? page, int? pageSize,
                WorkerQueries queries, IPermissionService permissions, CancellationToken ct) =>
            {
                var withSalary = (await permissions.GetCurrentAsync(ct).ConfigureAwait(false)).Has(salary);
                var filter = new WorkerFilter(kind, search, placement, sort, desc ?? false, page ?? 1, pageSize ?? 50);
                return Results.Ok(await queries.ListAsync(filter, withSalary, ct).ConfigureAwait(false));
            })
            .RequirePermission(view, companyWide: true);

        group.MapGet($"/{path}/{{id:guid}}", async (Guid id, WorkerQueries queries, IPermissionService permissions, CancellationToken ct) =>
            {
                var withSalary = (await permissions.GetCurrentAsync(ct).ConfigureAwait(false)).Has(salary);
                return await queries.GetAsync(id, kind, withSalary, ct).ConfigureAwait(false) is { } file ? Results.Ok(file) : Results.NotFound();
            })
            .RequirePermission(view, companyWide: true);

        group.MapGet($"/{path}/{{id:guid}}/periods", async (Guid id, IPeriodLedger ledger, CancellationToken ct) =>
                Results.Ok(await ledger.PeriodsAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(view, companyWide: true);
    }
}
