using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.Modules.Documents.Application;
using IntegratedErp.Modules.Organization.Contracts;
using IntegratedErp.SharedKernel;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Net.Http.Headers;

namespace IntegratedErp.Modules.Documents.Api;

/// <summary>Attachments (access follows the owning record) and the signed-in user's own notifications.</summary>
internal static class DocumentsEndpoints
{
    public static void MapDocumentsEndpoints(this IEndpointRouteBuilder endpoints, long maxRequestBytes)
    {
        var group = endpoints.MapGroup("/api/v1/documents").WithTags("Documents").RequireAuthorization(PlatformPolicies.CompanyUser);

        // Document types to classify uploads (labels only; any signed-in company user may read them).
        group.MapGet("/document-types", async (IReferenceData referenceData, CancellationToken ct) =>
            Results.Ok(await referenceData.ListAsync(AttachmentService.DocumentTypesList, ct).ConfigureAwait(false)));

        group.MapGet("/attachments", async (string ownerType, Guid ownerId, AttachmentService service, CancellationToken ct) =>
            ToHttp(await service.ListAsync(ownerType, ownerId, ct).ConfigureAwait(false)));

        // Multipart upload. CSRF is covered by the platform's X-ERP-CSRF header check, so the framework
        // antiforgery token is not used here.
        group.MapPost("/attachments", async (HttpRequest request, AttachmentService service, CancellationToken ct) =>
        {
            if (!request.HasFormContentType)
            {
                return Results.Problem("A multipart form is required.", statusCode: StatusCodes.Status400BadRequest, title: "validation.file_empty");
            }

            var form = await request.ReadFormAsync(ct).ConfigureAwait(false);
            var file = form.Files.GetFile("file");
            if (file is null || !Guid.TryParse(form["ownerId"], out var ownerId))
            {
                return Results.Problem("File and owner are required.", statusCode: StatusCodes.Status400BadRequest, title: "validation.file_empty");
            }

            DateOnly? expiresOn = DateOnly.TryParse(form["expiresOn"], System.Globalization.CultureInfo.InvariantCulture, out var date) ? date : null;
            await using var content = file.OpenReadStream();
            var result = await service.UploadAsync(
                new UploadInput(form["ownerType"].ToString(), ownerId, form["documentType"].ToString(), file.FileName, file.Length, content, expiresOn, form["notes"].ToString()),
                ct).ConfigureAwait(false);
            return ToHttp(result, StatusCodes.Status201Created);
        })
        .DisableAntiforgery()
        .WithMetadata(new RequestSizeLimitAttribute(maxRequestBytes));

        group.MapGet("/attachments/{id:guid}/content", async (Guid id, AttachmentService service, HttpContext http, CancellationToken ct) =>
        {
            var result = await service.OpenAsync(id, ct).ConfigureAwait(false);
            if (result.IsFailure)
            {
                return Problem(result.Error);
            }

            // Always a download (never rendered inline), with the type we validated at upload.
            http.Response.Headers[HeaderNames.CacheControl] = "private, no-store";
            return Results.File(result.Value.Content, result.Value.ContentType, result.Value.FileName);
        });

        group.MapDelete("/attachments/{id:guid}", async (Guid id, AttachmentService service, CancellationToken ct) =>
            ToHttp(await service.DeleteAsync(id, ct).ConfigureAwait(false)));

        group.MapGet("/notifications", async (NotificationService service, CancellationToken ct) =>
            Results.Ok(await service.MineAsync(ct).ConfigureAwait(false)));

        group.MapPost("/notifications/{id:guid}/read", async (Guid id, NotificationService service, CancellationToken ct) =>
            ToHttp(await service.MarkReadAsync(id, ct).ConfigureAwait(false)));

        group.MapPost("/notifications/read-all", async (NotificationService service, CancellationToken ct) =>
        {
            await service.MarkAllReadAsync(ct).ConfigureAwait(false);
            return Results.NoContent();
        });
    }

    private static IResult ToHttp<T>(Result<T> result, int successStatus = StatusCodes.Status200OK) =>
        result.IsSuccess ? Results.Json(result.Value, statusCode: successStatus) : Problem(result.Error);

    private static IResult ToHttp(Result result) => result.IsSuccess ? Results.NoContent() : Problem(result.Error);

    private static IResult Problem(Error error) => Results.Problem(
        error.Message,
        statusCode: error.Code.StartsWith("forbidden.", StringComparison.Ordinal) ? StatusCodes.Status403Forbidden
            : error.Code.StartsWith("not_found.", StringComparison.Ordinal) ? StatusCodes.Status404NotFound
            : StatusCodes.Status400BadRequest,
        title: error.Code);
}
