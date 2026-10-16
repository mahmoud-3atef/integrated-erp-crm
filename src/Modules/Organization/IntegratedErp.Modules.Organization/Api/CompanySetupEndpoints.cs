using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Organization.Api;

/// <summary>Company setup screens: commercial registrations, branches, reference lists, modules (current company).</summary>
internal static class CompanySetupEndpoints
{
    public sealed record UpdateLegalEntityRequest(string NameAr, string NameEn, string CommercialRegistrationNo, string? VatNumber, bool IsActive);

    public sealed record BranchRequest(string? Code, string NameAr, string NameEn, Guid? LegalEntityId, string? City, bool IsActive = true);

    public sealed record ReferenceItemRequest(string? Code, string NameAr, string NameEn, int SortOrder, bool IsActive = true);

    public static void MapCompanySetupEndpoints(this RouteGroupBuilder group)
    {
        group.MapPut("/legal-entities/{id:guid}", async (Guid id, UpdateLegalEntityRequest r, CompanySetupService service, CancellationToken ct) =>
                ToHttp(await service.UpdateLegalEntityAsync(id, r.NameAr, r.NameEn, r.CommercialRegistrationNo, r.VatNumber, r.IsActive, ct).ConfigureAwait(false)))
            .RequirePermission(OrganizationPermissions.LegalEntitiesManage, companyWide: true);

        group.MapGet("/legal-entities/{id:guid}/history", async (Guid id, CompanySetupService service, CancellationToken ct) =>
                Results.Ok(await service.HistoryAsync(AuditEntityTypes.LegalEntity, id, ct).ConfigureAwait(false)))
            .RequirePermission(OrganizationPermissions.LegalEntitiesView);

        group.MapGet("/branches", async (CompanySetupService service, CancellationToken ct) =>
                Results.Ok(await service.ListBranchesAsync(ct).ConfigureAwait(false)))
            .RequirePermission(OrganizationPermissions.BranchesView);

        group.MapPost("/branches", async (BranchRequest r, CompanySetupService service, CancellationToken ct) =>
                ToHttp(await service.CreateBranchAsync(r.Code ?? string.Empty, r.NameAr, r.NameEn, r.LegalEntityId, r.City, ct).ConfigureAwait(false), StatusCodes.Status201Created))
            .RequirePermission(OrganizationPermissions.BranchesManage, companyWide: true);

        group.MapPut("/branches/{id:guid}", async (Guid id, BranchRequest r, CompanySetupService service, CancellationToken ct) =>
                ToHttp(await service.UpdateBranchAsync(id, r.NameAr, r.NameEn, r.LegalEntityId, r.City, r.IsActive, ct).ConfigureAwait(false)))
            .RequirePermission(OrganizationPermissions.BranchesManage, companyWide: true);

        group.MapGet("/branches/{id:guid}/history", async (Guid id, CompanySetupService service, CancellationToken ct) =>
                Results.Ok(await service.HistoryAsync(AuditEntityTypes.Branch, id, ct).ConfigureAwait(false)))
            .RequirePermission(OrganizationPermissions.BranchesView);

        group.MapGet("/reference-lists", async (CompanySetupService service, CancellationToken ct) =>
                Results.Ok(await service.ListReferenceListsAsync(ct).ConfigureAwait(false)))
            .RequirePermission(OrganizationPermissions.ReferenceView);

        group.MapGet("/reference-lists/{list}/items", async (string list, CompanySetupService service, CancellationToken ct) =>
                ToHttp(await service.ListItemsAsync(list, ct).ConfigureAwait(false)))
            .RequirePermission(OrganizationPermissions.ReferenceView);

        group.MapPost("/reference-lists/{list}/items", async (string list, ReferenceItemRequest r, CompanySetupService service, CancellationToken ct) =>
                ToHttp(await service.CreateItemAsync(list, r.Code ?? string.Empty, r.NameAr, r.NameEn, r.SortOrder, ct).ConfigureAwait(false), StatusCodes.Status201Created))
            .RequirePermission(OrganizationPermissions.ReferenceManage, companyWide: true);

        group.MapPut("/reference-lists/{list}/items/{id:guid}", async (string list, Guid id, ReferenceItemRequest r, CompanySetupService service, CancellationToken ct) =>
                ToHttp(await service.UpdateItemAsync(list, id, r.NameAr, r.NameEn, r.SortOrder, r.IsActive, ct).ConfigureAwait(false)))
            .RequirePermission(OrganizationPermissions.ReferenceManage, companyWide: true);

        group.MapGet("/reference-lists/{list}/items/{id:guid}/history", async (string list, Guid id, CompanySetupService service, CancellationToken ct) =>
                Results.Ok(await service.HistoryAsync(AuditEntityTypes.ReferenceItem, id, ct).ConfigureAwait(false)))
            .RequirePermission(OrganizationPermissions.ReferenceView);

        // Which modules this deployment has and which are switched on.
        group.MapGet("/modules", (ModuleRegistry registry) => Results.Ok(registry.Describe()))
            .RequirePermission(OrganizationPermissions.ModulesView);
    }

    private static IResult ToHttp<T>(Result<T> result, int successStatus = StatusCodes.Status200OK) =>
        result.IsSuccess
            ? Results.Json(result.Value, statusCode: successStatus)
            : Results.Problem(
                result.Error.Message,
                statusCode: result.Error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
                    : result.Error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict
                    : StatusCodes.Status400BadRequest,
                title: result.Error.Code);
}
