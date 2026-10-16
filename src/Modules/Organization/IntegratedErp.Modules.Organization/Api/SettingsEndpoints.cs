using IntegratedErp.Modules.Organization.Application.Settings;
using IntegratedErp.Modules.Organization.Domain.Settings;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IntegratedErp.Modules.Organization.Api;

/// <summary>
/// Settings endpoints. Until authentication arrives (slice 0.4) they are mapped only when
/// <c>Modules:Organization:DevEndpoints</c> is true (Development).
/// </summary>
internal static class SettingsEndpoints
{
    public sealed record SetSettingRequest(
        string Key,
        SettingScopeType ScopeType,
        Guid? TenantId,
        Guid? ScopeId,
        string Value,
        DateOnly EffectiveFrom);

    public static void MapSettingsEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/settings/{key}", async (
            string key,
            Guid? tenantId,
            Guid? legalEntityId,
            Guid? customerId,
            Guid? contractId,
            Guid? projectId,
            DateOnly? asOf,
            SettingsService service,
            CancellationToken cancellationToken) =>
        {
            var context = new SettingContext(tenantId, legalEntityId, customerId, contractId, projectId);
            var date = asOf ?? DateOnly.FromDateTime(DateTime.UtcNow);
            var value = await service.GetEffectiveValueAsync(key, context, date, cancellationToken).ConfigureAwait(false);

            return value is null ? Results.NotFound() : Results.Text(value, "application/json");
        }).WithName("GetEffectiveSetting");

        group.MapPut("/settings", async (SetSettingRequest request, SettingsService service, CancellationToken cancellationToken) =>
        {
            SettingScope scope;
            try
            {
                scope = request.ScopeType switch
                {
                    SettingScopeType.System => SettingScope.System,
                    SettingScopeType.Tenant => SettingScope.ForTenant(request.TenantId ?? Guid.Empty),
                    _ => SettingScope.For(request.ScopeType, request.TenantId ?? Guid.Empty, request.ScopeId ?? Guid.Empty),
                };
            }
            catch (ArgumentException ex)
            {
                return Results.Problem(ex.Message, statusCode: StatusCodes.Status400BadRequest);
            }

            var result = await service.SetValueAsync(request.Key, scope, request.Value, request.EffectiveFrom, cancellationToken).ConfigureAwait(false);

            return result.IsSuccess
                ? Results.NoContent()
                : Results.Problem(result.Error.Message, statusCode: StatusCodes.Status409Conflict, title: result.Error.Code);
        }).WithName("SetSetting");
    }
}
