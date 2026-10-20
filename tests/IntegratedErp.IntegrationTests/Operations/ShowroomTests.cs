using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Operations.Application;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Workforce.Application;
using IntegratedErp.Modules.Workforce.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Operations;

[Collection(DatabaseTestGroup.Name)]
public sealed class ShowroomTests(TestDatabase database)
{
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];

    [SkippableFact]
    public async Task A_worker_in_housing_shows_with_the_profile_and_photos_and_the_presentation_hides_what_is_internal()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        Guid tenantId;
        using (var scope = database.Scope(system: true))
        {
            tenantId = (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync($"sr-{Guid.NewGuid():N}"[..16], "شركة الصالة", "Showroom Co", default)).Value.Id;
        }

        var crm = new FakeCrm();
        var country = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين", ["new_nameenglish"] = "Philippines" });
        crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = "MARIA SANTOS CRUZ", ["new_empidnumber"] = "BSS0700", ["new_idnumber"] = "2070000000",
            ["statuscode"] = 279640001, ["new_employeetype"] = 2, ["new_nationalityid"] = country.ToString(), ["new_totalsalary"] = 1500m,
        }, created: new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        using (var scope = database.Scope(tenantId, user: "crm-sync"))
        {
            var db = scope.ServiceProvider.GetRequiredService<CrmSyncDbContext>();
            var sync = ActivatorUtilities.CreateInstance<CrmSyncService>(scope.ServiceProvider, (ICrmSource)crm, Options.Create(new CrmSyncOptions()));
            db.Runs.Add(new SyncRun(SyncMode.Incremental, "test", DateTimeOffset.UtcNow));
            await db.SaveChangesAsync();
            Assert.True(await sync.RunNextAsync(scope.ServiceProvider.GetRequiredService<ReferenceImportService>(), scope.ServiceProvider.GetServices<ICrmStagingConsumer>().ToList(), default));
        }

        using (var scope = database.Scope(tenantId, user: "marketing"))
        {
            var workerId = await scope.ServiceProvider.GetRequiredService<WorkforceDbContext>().Workers.Where(w => w.WorkerNo == "BSS0700").Select(w => w.Id).SingleAsync();
            var profiles = scope.ServiceProvider.GetRequiredService<WorkerShowcaseService>();
            var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));

            // Codes must be in their lists; values in their sets.
            Assert.True((await profiles.UpdateAsync(workerId, new WorkerProfileInput("NOT_A_SPECIALTY", [], [], null, null, null, null, null, null, null), default)).IsFailure);
            Assert.True((await profiles.UpdateAsync(workerId, new WorkerProfileInput("WAITER", [], [], "X", null, null, null, null, null, null), default)).IsFailure);
            Assert.True((await profiles.UpdateAsync(workerId, new WorkerProfileInput("WAITER", [], [], null, today.AddYears(-10), null, null, null, null, null), default)).IsFailure);
            Assert.True((await profiles.UpdateAsync(workerId, new WorkerProfileInput("waiter", ["TABLE_SERVICE", "BUFFET"], ["TL", "EN"], "F", today.AddYears(-30), "CHRISTIAN", "SECONDARY", 3, "نادلة بخبرة", "Experienced waitress"), default)).IsSuccess);

            // Only images are kept; the photo comes back as stored.
            Assert.True((await profiles.AddPhotoAsync(workerId, new MemoryStream("not an image"u8.ToArray()), 12, default)).IsFailure);
            var photo = await profiles.AddPhotoAsync(workerId, new MemoryStream(Png), Png.Length, default);
            Assert.True(photo.IsSuccess);
            var file = await profiles.PhotoAsync(workerId, photo.Value, default);
            Assert.Equal("image/png", file!.ContentType);
            await file.Content.DisposeAsync();

            var profile = (await profiles.GetAsync(workerId, default))!;
            Assert.Equal(("WAITER", 2, "TL"), (profile.Specialty, profile.Skills.Count, profile.Languages[0]));
            Assert.Equal(photo.Value, Assert.Single(profile.Photos));

            var showroom = scope.ServiceProvider.GetRequiredService<Showroom>();
            var inside = Assert.Single((await showroom.GetAsync(false, default)).Workers);
            Assert.Equal(("MARIA SANTOS CRUZ", "WAITER", 30), (inside.Name, inside.Specialty!.Code, inside.Age!.Value));
            Assert.True(inside.IsNew);

            // The presentation for a customer: the first name, and nothing internal.
            var shown = await showroom.GetAsync(true, default);
            var card = Assert.Single(shown.Workers);
            Assert.Equal("MARIA", card.Name);
            Assert.Null(card.Since);
            Assert.Null(card.DaysAvailable);
            Assert.Null(card.LastReturnReason);
            Assert.Null(shown.OldestDays);
            Assert.Equal(("WAITER", 1), (shown.BySpecialty.Single().Code, shown.BySpecialty.Single().Count));
            Assert.NotNull(await showroom.FileAsync(workerId, true, default));
        }
    }
}
