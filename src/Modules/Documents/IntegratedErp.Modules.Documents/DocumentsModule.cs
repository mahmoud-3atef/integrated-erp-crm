using IntegratedErp.BuildingBlocks.Email;
using IntegratedErp.BuildingBlocks.Modules;
using IntegratedErp.BuildingBlocks.Persistence;
using IntegratedErp.BuildingBlocks.Reference;
using IntegratedErp.BuildingBlocks.Storage;
using IntegratedErp.Modules.Documents.Api;
using IntegratedErp.Modules.Documents.Application;
using IntegratedErp.Modules.Documents.Contracts;
using IntegratedErp.Modules.Documents.Infrastructure;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IntegratedErp.Modules.Documents;

/// <summary>
/// Documents module: file storage (folder now, S3-compatible later), attachments on any record with a type,
/// expiry date and the owning record's permissions, and notifications in the system and by email.
/// </summary>
public sealed class DocumentsModule : IModule
{
    private long _maxRequestBytes;

    public string Name => DocumentsContracts.ModuleName;

    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddModuleDbContext<DocumentsDbContext>(configuration, DocumentsDbContext.SchemaName);
        services.AddOptions<DocumentsOptions>().Bind(configuration.GetSection(DocumentsOptions.Section));
        services.AddFileStorage(configuration);
        services.AddEmail(configuration);
        services.AddScoped<AttachmentService>();
        services.AddScoped<NotificationService>();
        services.AddScoped<INotifier>(sp => sp.GetRequiredService<NotificationService>());
        services.AddHostedService<EmailDispatcher>();
        services.AddReferenceLists(DocumentTypes.List);

        // The multipart body may be a little larger than the file itself.
        var maxMb = configuration.GetValue($"{DocumentsOptions.Section}:MaxFileSizeMb", 20);
        _maxRequestBytes = (maxMb + 1) * 1024L * 1024L;
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapDocumentsEndpoints(_maxRequestBytes);
}

internal static class DocumentTypes
{
    public static readonly ReferenceListDefinition List = new(
        AttachmentService.DocumentTypesList,
        "أنواع المستندات",
        "Document types",
        "تصنيف المرفقات على السجلات، مثل السجل التجاري والعقود والهويات.",
        "How attachments are classified, such as commercial registrations, contracts and IDs.",
        [
            new("COMMERCIAL_REGISTRATION", "السجل التجاري", "Commercial registration"),
            new("VAT_CERTIFICATE", "شهادة التسجيل في ضريبة القيمة المضافة", "VAT registration certificate"),
            new("CONTRACT", "عقد", "Contract"),
            new("ID_DOCUMENT", "هوية أو إقامة", "ID or residence permit"),
            new("PASSPORT", "جواز سفر", "Passport"),
            new("OTHER", "مستند آخر", "Other document"),
        ]);
}
