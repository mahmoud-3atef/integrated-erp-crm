using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Billing.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Billing.Api;

/// <summary>Collection: receipt vouchers and their allocations, a project's open items and statement, the debts' ages, the bank accounts.</summary>
internal static class ReceivableEndpoints
{
    public static void MapReceivableEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/billing").WithTags("Billing").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/receipts", async (DateOnly? from, DateOnly? to, string? status, string? search, ReceivableQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ReceiptsAsync(from, to, status, search, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.ReceiptsView, companyWide: true);

        group.MapGet("/receipts/{id:guid}", async (Guid id, ReceivableQueries queries, CancellationToken ct) =>
                await queries.ReceiptAsync(id, ct).ConfigureAwait(false) is { } receipt ? Results.Ok(receipt) : Results.NotFound())
            .RequirePermission(BillingPermissions.ReceiptsView, companyWide: true);

        group.MapPost("/receipts", async (ReceiptInput input, ReceiptService service, CancellationToken ct) =>
                await service.CreateAsync(input, ct).ConfigureAwait(false) is var result && result.IsSuccess ? Results.Ok(new { id = result.Value }) : Problem(result.Error))
            .RequirePermission(BillingPermissions.ReceiptsManage, companyWide: true);

        group.MapPut("/receipts/{id:guid}", async (Guid id, ReceiptInput input, ReceiptService service, CancellationToken ct) =>
                ToHttp(await service.UpdateAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.ReceiptsManage, companyWide: true);

        group.MapDelete("/receipts/{id:guid}", async (Guid id, ReceiptService service, CancellationToken ct) =>
                ToHttp(await service.DeleteAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.ReceiptsManage, companyWide: true);

        group.MapPost("/receipts/{id:guid}/submit", async (Guid id, ReceiptService service, CancellationToken ct) =>
                ToHttp(await service.SubmitAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.ReceiptsManage, companyWide: true);

        group.MapPost("/receipts/{id:guid}/allocate", async (Guid id, AllocateRequest? request, ReceiptService service, CancellationToken ct) =>
                ToHttp(await service.AllocateAsync(id, request?.Allocations, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.ReceiptsManage, companyWide: true);

        group.MapGet("/projects/{projectId:guid}/open-items", async (Guid projectId, Guid? exceptReceipt, ReceivableQueries queries, CancellationToken ct) =>
                await queries.OpenAsync(projectId, exceptReceipt, ct).ConfigureAwait(false) is { } open ? Results.Ok(open) : Results.NotFound())
            .RequirePermission(BillingPermissions.ReceiptsView, companyWide: true);

        group.MapGet("/receipt-projects", async (ReceivableQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ProjectsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.ReceiptsView, companyWide: true);

        group.MapGet("/aging", async (DateOnly? asOf, ReceivableQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.AgingAsync(asOf, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.ReceiptsView, companyWide: true);

        group.MapGet("/statements/{project:guid}", async (Guid project, DateOnly? from, DateOnly? to, ReceivableQueries queries, CancellationToken ct) =>
                await queries.StatementAsync(project, from, to, ct).ConfigureAwait(false) is { } statement ? Results.Ok(statement) : Results.NotFound())
            .RequirePermission(BillingPermissions.ReceiptsView, companyWide: true);

        group.MapGet("/bank-accounts", async (ReceivableQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.BankAccountsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.ReceiptsView, companyWide: true);

        group.MapPost("/bank-accounts", async (BankAccountInput input, ReceiptService service, CancellationToken ct) =>
                await service.SaveBankAccountAsync(null, input, ct).ConfigureAwait(false) is var result && result.IsSuccess ? Results.Ok(new { id = result.Value }) : Problem(result.Error))
            .RequirePermission(BillingPermissions.BankAccountsManage, companyWide: true);

        group.MapPut("/bank-accounts/{id:guid}", async (Guid id, BankAccountInput input, ReceiptService service, CancellationToken ct) =>
                await service.SaveBankAccountAsync(id, input, ct).ConfigureAwait(false) is var result && result.IsSuccess ? Results.NoContent() : Problem(result.Error))
            .RequirePermission(BillingPermissions.BankAccountsManage, companyWide: true);
    }

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}

/// <summary>The allocations of an approved receipt's credit; none: oldest due first.</summary>
public sealed record AllocateRequest(IReadOnlyList<AllocationDto>? Allocations);
