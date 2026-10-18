using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Billing.Application;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Billing.Api;

/// <summary>Customer invoices and notes: made from an approved timesheet, a draft's terms, notes, review and issue, the attachment.</summary>
internal static class InvoiceEndpoints
{
    public static void MapInvoiceEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/billing").WithTags("Billing").RequireAuthorization(PlatformPolicies.CompanyUser);

        group.MapGet("/invoices", async (DateOnly? month, string? status, string? kind, string? search, InvoiceQueries queries, CancellationToken ct) =>
                Results.Ok(await queries.ListAsync(month, status, kind, search, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.InvoicesView, companyWide: true);

        group.MapGet("/invoices/{id:guid}", async (Guid id, InvoiceQueries queries, CancellationToken ct) =>
                await queries.GetAsync(id, ct).ConfigureAwait(false) is { } invoice ? Results.Ok(invoice) : Results.NotFound())
            .RequirePermission(BillingPermissions.InvoicesView, companyWide: true);

        group.MapGet("/invoices/{id:guid}/attachment", async (Guid id, InvoiceService service, CancellationToken ct) =>
                await service.AttachmentAsync(id, ct).ConfigureAwait(false) is { } file
                    ? Results.File(file.Content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", file.FileName)
                    : Results.NotFound())
            .RequirePermission(BillingPermissions.InvoicesView, companyWide: true);

        group.MapPost("/timesheets/{id:guid}/invoice", async (Guid id, InvoiceService service, CancellationToken ct) =>
                await service.CreateFromTimesheetAsync(id, ct).ConfigureAwait(false) is var result && result.IsSuccess ? Results.Ok(new { id = result.Value }) : Problem(result.Error))
            .RequirePermission(BillingPermissions.InvoicesManage, companyWide: true);

        group.MapPut("/invoices/{id:guid}", async (Guid id, InvoiceEditInput input, InvoiceService service, CancellationToken ct) =>
                ToHttp(await service.EditAsync(id, input, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.InvoicesManage, companyWide: true);

        group.MapDelete("/invoices/{id:guid}", async (Guid id, InvoiceService service, CancellationToken ct) =>
                ToHttp(await service.DeleteAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.InvoicesManage, companyWide: true);

        group.MapPost("/invoices/{id:guid}/notes", async (Guid id, NoteInput input, InvoiceService service, CancellationToken ct) =>
                await service.CreateNoteAsync(id, input, ct).ConfigureAwait(false) is var result && result.IsSuccess ? Results.Ok(new { id = result.Value }) : Problem(result.Error))
            .RequirePermission(BillingPermissions.InvoicesManage, companyWide: true);

        group.MapPost("/invoices/{id:guid}/submit", async (Guid id, InvoiceService service, CancellationToken ct) =>
                ToHttp(await service.SubmitAsync(id, ct).ConfigureAwait(false)))
            .RequirePermission(BillingPermissions.InvoicesManage, companyWide: true);
    }

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}
