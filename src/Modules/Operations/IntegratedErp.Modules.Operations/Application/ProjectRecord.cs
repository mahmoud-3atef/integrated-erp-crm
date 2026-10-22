using System.Globalization;
using IntegratedErp.Modules.Commercial.Contracts;
using IntegratedErp.Modules.Identity.Contracts;
using IntegratedErp.Modules.Workflow.Contracts;

namespace IntegratedErp.Modules.Operations.Application;

/// <summary>
/// A project as a related table of an approval screen (an order's project): every field of it, with its customer's and
/// its contract's, for the processes' conditions — the manager also as a user (the account signing in with the CRM
/// owner's Windows account), so a condition can compare them with a user field of the order.
/// </summary>
internal static class ProjectRecord
{
    private static readonly RecordFieldOption[] ContractTypes =
    [
        new("CostPlus", "التكلفة زائد الرسوم", "Cost plus"),
        new("TotalCost", "التكلفة الإجمالية", "Total cost"),
        new("TotalCostMultiSalaries", "التكلفة الإجمالية برواتب متعددة", "Total cost, several salaries"),
    ];

    private static readonly RecordFieldOption[] ContractStatuses =
    [
        new("Valid", "ساري", "Valid"),
        new("WantsRenewal", "يرغب في التجديد", "Wants renewal"),
        new("NoRenewal", "لا يرغب في التجديد", "No renewal"),
        new("Canceled", "ملغى", "Canceled"),
        new("Expired", "انتهت مدته", "Expired"),
    ];

    /// <summary>Every field of a project (its customer's and its contract's with it).</summary>
    public static readonly RecordField[] Fields =
    [
        new("code", "رمز المشروع", "Project code", RecordFieldType.Text, Updatable: false),
        new("name", "اسم المشروع", "Project name", RecordFieldType.Text, Updatable: false),
        new("name_ar", "الاسم العربي", "Arabic name", RecordFieldType.Text, Updatable: false),
        new("name_en", "الاسم الإنجليزي", "English name", RecordFieldType.Text, Updatable: false),
        new("manager_user", "مدير المشروع (المستخدم)", "Project manager (user)", RecordFieldType.User, Updatable: false),
        new("manager", "اسم مدير المشروع", "Project manager's name", RecordFieldType.Text, Updatable: false),
        new("manager_login", "حساب دخول مدير المشروع", "Project manager's sign-in", RecordFieldType.Text, Updatable: false),
        new("commercial_registration", "السجل التجاري", "Commercial registration", RecordFieldType.Text, Updatable: false),
        new("city", "المدينة", "City", RecordFieldType.Text, Updatable: false),
        new("sector", "القطاع", "Sector", RecordFieldType.Text, Updatable: false),
        new("contact_name", "مسؤول العميل", "Customer's person in charge", RecordFieldType.Text, Updatable: false),
        new("contact_mobile", "جوال مسؤول العميل", "Their mobile", RecordFieldType.Text, Updatable: false),
        new("contact_emails", "بريد مسؤول العميل", "Their email", RecordFieldType.Text, Updatable: false),
        new("active", "المشروع نشط", "Project active", RecordFieldType.Boolean, Updatable: false),
        new("created_on", "تاريخ إنشاء المشروع", "Project created on", RecordFieldType.Date, Updatable: false),
        new("customer", "العميل", "Customer", RecordFieldType.Text, Updatable: false),
        new("customer_no", "رقم العميل", "Customer number", RecordFieldType.Text, Updatable: false),
        new("customer_vat", "الرقم الضريبي للعميل", "Customer VAT number", RecordFieldType.Text, Updatable: false),
        new("customer_city", "مدينة العميل", "Customer city", RecordFieldType.Text, Updatable: false),
        new("contract_no", "رقم العقد", "Contract number", RecordFieldType.Text, Updatable: false),
        new("contract_type", "نوع العقد", "Contract type", RecordFieldType.Choice, Updatable: false, ContractTypes),
        new("contract_status", "حالة العقد", "Contract status", RecordFieldType.Choice, Updatable: false, ContractStatuses),
        new("contract_starts", "بداية العقد", "Contract start", RecordFieldType.Date, Updatable: false),
        new("contract_ends", "نهاية العقد", "Contract end", RecordFieldType.Date, Updatable: false),
    ];

    public static async Task<IReadOnlyDictionary<string, string?>?> ReadAsync(IProjectDirectory projects, IUserDirectory users, Guid projectId, CancellationToken cancellationToken)
    {
        if (await projects.DetailsAsync(projectId, cancellationToken).ConfigureAwait(false) is not { } p)
        {
            return null;
        }

        // The manager as a user here: the account that signs in with the CRM owner's Windows account.
        var managerUser = p.ManagerLogin is { } login && (await users.UsersByLoginsAsync([login], cancellationToken).ConfigureAwait(false)).TryGetValue(login, out var managerId)
            ? managerId.ToString()
            : null;
        static string? Day(DateOnly? d) => d?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        return new Dictionary<string, string?>
        {
            ["code"] = p.Code,
            ["name"] = p.Name,
            ["name_ar"] = p.NameAr,
            ["name_en"] = p.NameEn,
            ["manager_user"] = managerUser,
            ["manager"] = p.Manager,
            ["manager_login"] = p.ManagerLogin,
            ["commercial_registration"] = p.CommercialRegistration,
            ["city"] = p.City,
            ["sector"] = p.Sector,
            ["contact_name"] = p.ContactName,
            ["contact_mobile"] = p.ContactMobile,
            ["contact_emails"] = p.ContactEmails,
            ["active"] = p.IsActive ? "true" : "false",
            ["created_on"] = p.CrmCreatedAt is { } created ? Day(DateOnly.FromDateTime(created.UtcDateTime)) : null,
            ["customer"] = p.CustomerName,
            ["customer_no"] = p.CustomerNo,
            ["customer_vat"] = p.CustomerVatNumber,
            ["customer_city"] = p.CustomerCity,
            ["contract_no"] = p.ContractNo,
            ["contract_type"] = p.ContractType,
            ["contract_status"] = p.ContractStatus,
            ["contract_starts"] = Day(p.ContractStartsOn),
            ["contract_ends"] = Day(p.ContractEndsOn),
        };
    }
}
