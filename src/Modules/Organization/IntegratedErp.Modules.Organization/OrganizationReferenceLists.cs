using IntegratedErp.BuildingBlocks.Reference;

namespace IntegratedErp.Modules.Organization;

/// <summary>Company-wide reference lists. Each later module declares its own lists the same way.</summary>
internal static class OrganizationReferenceLists
{
    public const string Nationalities = "nationalities";
    public const string Professions = "professions";
    public const string Cities = "cities";
    public const string Banks = "banks";
    public const string ReturnReasons = "return_reasons";

    public static readonly ReferenceListDefinition[] All =
    [
        new(Nationalities, "الجنسيات", "Nationalities", "جنسيات العمالة والموظفين والعملاء.", "Nationalities of workers, staff and customers."),
        new(Professions, "المهن", "Professions", "المهن المعتمدة للعمالة والموظفين.", "Professions of workers and staff."),
        new(Cities, "المدن", "Cities", "مدن مواقع العمل والفروع والسكن.", "Cities of work sites, branches and housing."),
        new(Banks, "البنوك", "Banks", "البنوك المستخدمة في تحويل الرواتب والتحصيل.", "Banks used for salary transfers and collections."),
        new(
            ReturnReasons,
            "أسباب إرجاع العمالة",
            "Worker return reasons",
            "أسباب إعادة العامل من المشروع إلى السكن.",
            "Why a worker is returned from a project to housing.",
            [
                new("CLIENT_NO_REASON", "أعاده العميل دون سبب", "Returned by the customer without a reason"),
                new("WORKER_REFUSED", "رفض العامل العمل", "Worker refused to work"),
                new("SICK", "مرض العامل", "Worker is sick"),
                new("WORKER_ABUSED", "إساءة إلى العامل", "Worker was mistreated"),
                new("CONTRACT_ENDED", "انتهاء العقد مع العميل أو إلغاؤه", "Customer contract ended or was cancelled"),
                new("OTHER", "سبب آخر", "Other reason"),
            ]),
    ];
}
