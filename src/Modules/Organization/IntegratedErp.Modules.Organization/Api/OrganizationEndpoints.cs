using IntegratedErp.BuildingBlocks.Context;
using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Organization.Api;

/// <summary>Tenants (platform administrators) and the current company's legal entities (by permission).</summary>
internal static class OrganizationEndpoints
{
    public sealed record CreateTenantRequest(string Code, string NameAr, string NameEn);

    public sealed record CreateLegalEntityRequest(string Code, string NameAr, string NameEn, string CommercialRegistrationNo, string? VatNumber);

    public static void MapOrganizationEndpoints(this RouteGroupBuilder group)
    {
        // Creating a tenant is a platform (cross-tenant) operation.
        group.MapPost("/tenants", async (CreateTenantRequest request, ExecutionContextAccessor context, OrganizationService service, CancellationToken ct) =>
        {
            context.RunAsSystem("platform-admin");
            return ToHttp(await service.CreateTenantAsync(request.Code, request.NameAr, request.NameEn, ct).ConfigureAwait(false), StatusCodes.Status201Created);
        }).WithName("CreateTenant").RequireAuthorization(PlatformPolicies.PlatformAdmin);

        group.MapGet("/tenants", async (OrganizationService service, CancellationToken ct) =>
            Results.Ok(await service.ListTenantsAsync(ct).ConfigureAwait(false)))
            .WithName("ListTenants").RequireAuthorization(PlatformPolicies.PlatformAdmin);

        group.MapPost("/legal-entities", async (CreateLegalEntityRequest request, ITenantContext tenant, OrganizationService service, CancellationToken ct) =>
        {
            if (tenant.TenantId is null)
            {
                return Results.Problem("A tenant is required.", statusCode: StatusCodes.Status400BadRequest);
            }

            var result = await service.CreateLegalEntityAsync(request.Code, request.NameAr, request.NameEn, request.CommercialRegistrationNo, request.VatNumber, ct).ConfigureAwait(false);
            return ToHttp(result, StatusCodes.Status201Created);
        }).WithName("CreateLegalEntity").RequirePermission(OrganizationPermissions.LegalEntitiesManage);

        group.MapGet("/legal-entities", async (OrganizationService service, CancellationToken ct) =>
            Results.Ok(await service.ListLegalEntitiesAsync(ct).ConfigureAwait(false)))
            .WithName("ListLegalEntities").RequirePermission(OrganizationPermissions.LegalEntitiesView);
    }

    private static IResult ToHttp<T>(Result<T> result, int successStatus) =>
        result.IsSuccess
            ? Results.Json(result.Value, statusCode: successStatus)
            : Results.Problem(
                result.Error.Message,
                statusCode: result.Error.Code.StartsWith("conflict.", StringComparison.Ordinal) ? StatusCodes.Status409Conflict : StatusCodes.Status400BadRequest,
                title: result.Error.Code);
}
