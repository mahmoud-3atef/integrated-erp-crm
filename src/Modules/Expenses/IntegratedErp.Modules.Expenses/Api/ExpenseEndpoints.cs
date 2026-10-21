using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Expenses.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Expenses.Api;

/// <summary>The company's expenses: the list (filtered on the server, with its totals), a record, and its changes.</summary>
internal static class ExpenseEndpoints
{
    public sealed record CancelRequest(string? Reason);

    public static void MapExpenseEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/expenses").WithTags("Expenses").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("", async (DateOnly? from, DateOnly? to, string? category, string? scope, Guid? workerId, Guid? projectCrmId, string? search, bool? withCancelled, int? page, int? pageSize, ExpenseService service, CancellationToken ct) =>
                Results.Ok(await service.ListAsync(new ExpenseFilter(from, to, category, scope, workerId, projectCrmId, search, withCancelled == true, page ?? 1, pageSize ?? 50), ct).ConfigureAwait(false)))
            .RequirePermission(ExpensePermissions.View, companyWide: true);

        group.MapGet("/{id:guid}", async (Guid id, ExpenseService service, CancellationToken ct) =>
                await service.GetAsync(id, ct).ConfigureAwait(false) is { } e ? Results.Ok(e) : Results.NotFound())
            .RequirePermission(ExpensePermissions.View, companyWide: true);

        group.MapPost("", async (ExpenseInput input, ExpenseService service, CancellationToken ct) =>
            {
                var result = await service.CreateAsync(input, ct).ConfigureAwait(false);
                return result.IsSuccess ? Results.Ok(new { id = result.Value }) : Problem(result.Error);
            })
            .RequirePermission(ExpensePermissions.Manage, companyWide: true);

        group.MapPut("/{id:guid}", async (Guid id, ExpenseInput input, ExpenseService service, CancellationToken ct) =>
                Http(await service.UpdateAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(ExpensePermissions.Manage, companyWide: true);

        group.MapPost("/{id:guid}/cancel", async (Guid id, CancelRequest r, ExpenseService service, CancellationToken ct) =>
                Http(await service.CancelAsync(id, r.Reason, ct).ConfigureAwait(false)))
            .RequirePermission(ExpensePermissions.Manage, companyWide: true);

        group.MapGet("/workers", async (string? search, ExpenseService service, CancellationToken ct) =>
                Results.Ok(await service.WorkersAsync(search ?? string.Empty, ct).ConfigureAwait(false)))
            .RequirePermission(ExpensePermissions.Manage, companyWide: true);

        group.MapGet("/categories", async (ExpenseService service, CancellationToken ct) => Results.Ok(await service.CategoriesAsync(ct).ConfigureAwait(false)))
            .RequirePermission(ExpensePermissions.View, companyWide: true);

        group.MapGet("/projects", async (ExpenseService service, CancellationToken ct) => Results.Ok(await service.ProjectsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(ExpensePermissions.View, companyWide: true);
    }

    private static IResult Http(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound : StatusCodes.Status400BadRequest,
        title: error.Code);
}
