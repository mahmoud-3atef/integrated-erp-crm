using IntegratedErp.BuildingBlocks.Security;
using IntegratedErp.IntegrationTests.CrmSync;
using IntegratedErp.Modules.Commercial.Application;
using IntegratedErp.Modules.CrmSync.Application;
using IntegratedErp.Modules.CrmSync.Contracts;
using IntegratedErp.Modules.CrmSync.Domain;
using IntegratedErp.Modules.CrmSync.Infrastructure;
using IntegratedErp.Modules.Identity.Domain;
using IntegratedErp.Modules.Identity.Infrastructure;
using IntegratedErp.Modules.Operations.Application;
using IntegratedErp.Modules.Organization.Application.Organization;
using IntegratedErp.Modules.Workflow.Application;
using IntegratedErp.Modules.Workflow.Contracts;
using IntegratedErp.Modules.Workflow.Domain;
using IntegratedErp.Modules.Workflow.Infrastructure;
using IntegratedErp.Modules.Workforce.Contracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace IntegratedErp.IntegrationTests.Operations;

[Collection(DatabaseTestGroup.Name)]
public sealed class MovementTests(TestDatabase database)
{
    private static readonly DateTime Created2025 = new(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    [SkippableFact]
    public async Task Worker_movements_follow_where_the_worker_is_and_change_their_periods_when_approved()
    {
        Skip.IfNot(TestDatabase.IsAvailable, "No SQL Server available for integration tests.");
        var tenantId = await CreateCompanyAsync();
        var crm = new FakeCrm();
        var philippines = crm.Add(CrmEntities.Country, new() { ["new_name"] = "الفلبين", ["new_nameenglish"] = "Philippines" });
        var labour = crm.Add(CrmEntities.Profession, new() { ["new_name"] = "عامل", ["new_code"] = "6132115", ["new_professionenglish"] = "labour" });
        var riyadh = crm.Add("new_project", new() { ["new_name"] = "مشروع الرياض", ["new_code"] = "pro00800", ["new_contracttype"] = 2, ["statecode"] = 0 }, created: Created2025);
        crm.Add("new_project", new() { ["new_name"] = "مشروع جدة", ["new_code"] = "pro00801", ["new_contracttype"] = 2, ["statecode"] = 0 }, created: Created2025);
        var working = Worker(crm, "BSS0401", philippines, labour, 100000000, riyadh, "مشروع الرياض");
        crm.Add("new_empwork", new()
        {
            ["new_employeeid"] = working.ToString(), ["new_projectid"] = riyadh.ToString(), ["new_projectidname"] = "مشروع الرياض",
            ["new_startdate"] = "2026-08-01T09:00:00Z", ["new_serviceprice"] = 3000m, ["statecode"] = 0, ["new_number"] = "SW-0401",
        }, created: Created2025);
        var other = Worker(crm, "BSS0404", philippines, labour, 100000000, riyadh, "مشروع الرياض");
        crm.Add("new_empwork", new()
        {
            ["new_employeeid"] = other.ToString(), ["new_projectid"] = riyadh.ToString(), ["new_projectidname"] = "مشروع الرياض",
            ["new_startdate"] = "2026-08-01T09:00:00Z", ["new_serviceprice"] = 2800m, ["statecode"] = 0, ["new_number"] = "SW-0404",
        }, created: Created2025);
        Worker(crm, "BSS0402", philippines, labour, 1, null, null); // new: arriving
        Worker(crm, "BSS0403", philippines, labour, 279640001, null, null); // in housing
        await SyncAndImportAsync(tenantId, crm);

        var (creator, manager) = await PeopleAsync(tenantId);
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));
        Guid a, b, c, d, jeddahId;
        using (var scope = database.Scope(tenantId, user: creator.ToString()))
        {
            var directory = scope.ServiceProvider.GetRequiredService<IWorkforceDirectory>();
            (a, b, c) = ((await directory.SearchAsync("BSS0401", 5, default)).Single().Id, (await directory.SearchAsync("BSS0402", 5, default)).Single().Id,
                (await directory.SearchAsync("BSS0403", 5, default)).Single().Id);
            d = (await directory.SearchAsync("BSS0404", 5, default)).Single().Id;
            jeddahId = (await scope.ServiceProvider.GetRequiredService<DeliveryOrderQueries>().ProjectsAsync(default)).Single(p => p.Name == "مشروع جدة").Id;
            var options = await scope.ServiceProvider.GetRequiredService<PricingQueries>().OptionsAsync(null, default);
            Assert.True((await scope.ServiceProvider.GetRequiredService<PricingService>().CreateAsync(
                new PackageInput(jeddahId, options.Professions.Single().Code, options.Nationalities.Single().Code, 1500m, 1300m, 200m, true, 0m, false, new DateOnly(2026, 1, 1), null, null),
                default)).IsSuccess);

            // What each worker can have, from where they are.
            var service = scope.ServiceProvider.GetRequiredService<MovementService>();
            Assert.Equal(["Arrival", "FinalExit"], (await service.OptionsAsync(b, null, default))!.Allowed.Order());
            Assert.Contains("VacationDeparture", (await service.OptionsAsync(a, null, default))!.Allowed);
            Assert.Equal("validation.movement_not_allowed", (await service.CreateAsync(Input("Arrival", c, today), default)).Error.Code);
            Assert.Equal("validation.movement_delay_reason", (await service.CreateAsync(Input("Suspension", c, today.AddDays(-5)) with { SuspensionReason = "Sickness" }, default)).Error.Code);
            Assert.Equal("validation.movement_reason", (await service.CreateAsync(Input("Suspension", c, today), default)).Error.Code);

            // B arrives: into housing, without pay there.
            await RunAsync(scope, service, Input("Arrival", b, today) with { Place = "سكن العزيزية" });

            // A leaves on vacation on the customer: still billed on the project at the work's price.
            await RunAsync(scope, service, Input("VacationDeparture", a, today) with { VacationKind = "Client", ExpectedReturnOn = today.AddDays(30) });

            // C is suspended for sickness; D leaves on a regular vacation.
            await RunAsync(scope, service, Input("Suspension", c, today) with { SuspensionReason = "Sickness" });
            await RunAsync(scope, service, Input("VacationDeparture", d, today) with { VacationKind = "Regular" });
        }

        await DecideAllAsync(tenantId, manager, 4);
        using (var scope = database.Scope(tenantId, user: creator.ToString()))
        {
            var ledger = scope.ServiceProvider.GetRequiredService<IPeriodLedger>();
            var directory = scope.ServiceProvider.GetRequiredService<IWorkforceDirectory>();
            Assert.Equal(("Housing", "سكن العزيزية", false), Head(await ledger.PeriodsAsync(b, default)) is var hb ? (hb.Kind, hb.ProjectName, hb.PaySalary) : default);
            Assert.True((await directory.CardsAsync([b], default)).Single().Available);

            var vacation = (await ledger.PeriodsAsync(a, default))[0];
            Assert.Equal(("ClientVacation", "مشروع الرياض", 3000m), (vacation.Kind, vacation.ProjectName, vacation.TotalPrice));
            Assert.Equal("Vacation", (await directory.CardsAsync([a], default)).Single().Placement);
            var spans = await ledger.WorkAsync(null, today, today, default);
            Assert.Contains(spans, s => s.WorkerId == a && s.TotalPrice == 3000m && s.EndsOn is null); // billed
            Assert.Equal("Suspended", (await ledger.PeriodsAsync(c, default))[0].Kind);

            // A back from vacation straight to a new project, at its package price; meanwhile A cannot have another movement.
            var service = scope.ServiceProvider.GetRequiredService<MovementService>();
            var options = (await service.OptionsAsync(a, null, default))!;
            Assert.Equal(("مشروع الرياض", 3000m), (options.PreviousProjectName, options.PreviousPrice));
            await RunAsync(scope, service, Input("VacationReturn", a, today.AddDays(2)) with { ReturnTo = "NewProject", ProjectId = jeddahId });
            Assert.Equal("conflict.movement_worker_busy", (await service.CreateAsync(Input("Absconding", a, today.AddDays(3)), default)).Error.Code);

            // C's suspension lifted (back to housing), then C leaves for good.
            await RunAsync(scope, service, Input("SuspensionLift", c, today.AddDays(2)));

            // D, on a regular vacation (not billed), back to the same project: at the price they had there (no package on it).
            Assert.DoesNotContain(spans, s => s.WorkerId == d && s.EndsOn is null);
            await RunAsync(scope, service, Input("VacationReturn", d, today.AddDays(3)) with { ReturnTo = "SameProject" });
        }

        await DecideAllAsync(tenantId, manager, 3);
        using (var scope = database.Scope(tenantId, user: creator.ToString()))
        {
            var ledger = scope.ServiceProvider.GetRequiredService<IPeriodLedger>();
            var work = (await ledger.PeriodsAsync(a, default))[0];
            Assert.Equal(("Work", "مشروع جدة", 3000m, today.AddDays(2)), (work.Kind, work.ProjectName, work.TotalPrice, work.StartsOn));
            Assert.Equal(today.AddDays(2), (await ledger.PeriodsAsync(a, default))[1].EndsOn); // the vacation ends the day work starts
            Assert.Equal("Housing", (await ledger.PeriodsAsync(c, default))[0].Kind);
            var back = (await ledger.PeriodsAsync(d, default))[0];
            Assert.Equal(("Work", "مشروع الرياض", 2800m, false), (back.Kind, back.ProjectName, back.TotalPrice, back.IsSpecialPrice));

            var service = scope.ServiceProvider.GetRequiredService<MovementService>();
            await RunAsync(scope, service, Input("FinalExit", c, today.AddDays(4)) with { ExitKind = "FinalExit" });
        }

        await DecideAllAsync(tenantId, manager, 1);
        using (var scope = database.Scope(tenantId, user: creator.ToString()))
        {
            var card = (await scope.ServiceProvider.GetRequiredService<IWorkforceDirectory>().CardsAsync([c], default)).Single();
            Assert.Equal(("Exited", false), (card.Placement, card.Available));
            Assert.Empty((await scope.ServiceProvider.GetRequiredService<MovementService>().OptionsAsync(c, null, default))!.Allowed);

            var list = await scope.ServiceProvider.GetRequiredService<MovementQueries>().ListAsync(null, "Executed", null, default);
            Assert.Equal(8, list.Rows.Count);
            Assert.Equal(0, list.Open);
            var detail = (await scope.ServiceProvider.GetRequiredService<MovementQueries>().GetAsync(list.Rows.First(r => r.Type == "FinalExit").Id, default))!;
            Assert.Equal(("Executed", "Out", "Housing"), (detail.Status, detail.OpensPeriod, detail.FromPlacement));
            Assert.StartsWith("EX-", detail.MovementNo, StringComparison.Ordinal);
            Assert.False(detail.CanCancelApproved); // the creator has no permission on any type

            // Each type has its own permissions to change or cancel it after its approval.
            var service = scope.ServiceProvider.GetRequiredService<MovementService>();
            var arrival = list.Rows.Single(r => r.Type == "Arrival").Id;
            Assert.Equal("forbidden.movement_type", (await service.AmendAsync(arrival, new MovementAmendInput(today.AddDays(1), null, "سكن الملز", null, "وصل في اليوم التالي"), default)).Error.Code);
        }

        using (var scope = database.Scope(tenantId, user: manager.ToString()))
        {
            var service = scope.ServiceProvider.GetRequiredService<MovementService>();
            var ledger = scope.ServiceProvider.GetRequiredService<IPeriodLedger>();
            var list = await scope.ServiceProvider.GetRequiredService<MovementQueries>().ListAsync(null, "Executed", null, default);
            var arrival = list.Rows.Single(r => r.Type == "Arrival").Id;
            var exit = list.Rows.Single(r => r.Type == "FinalExit").Id;
            var suspension = list.Rows.Single(r => r.Type == "Suspension").Id;

            // The arrival changed (the manager may change arrivals): its housing period follows the new day and place.
            Assert.Equal("validation.movement_amend_reason", (await service.AmendAsync(arrival, new MovementAmendInput(today.AddDays(1), null, "سكن الملز", null, " "), default)).Error.Code);
            Assert.True((await service.AmendAsync(arrival, new MovementAmendInput(today.AddDays(1), null, "سكن الملز", null, "وصل في اليوم التالي"), default)).IsSuccess);
            Assert.Equal(("Housing", today.AddDays(1), "سكن الملز"), Head(await ledger.PeriodsAsync(b, default)) is var hb ? (hb.Kind, hb.StartsOn, hb.ProjectName) : default);
            var amended = (await scope.ServiceProvider.GetRequiredService<MovementQueries>().GetAsync(arrival, default))!;
            Assert.Equal(("وصل في اليوم التالي", true, false), (amended.AmendNote, amended.CanAmend, amended.CanCancelApproved));

            // A final exit cancelled (the manager may cancel final exits, not suspensions): C is back in housing.
            Assert.Equal("forbidden.movement_type", (await service.CancelApprovedAsync(suspension, "خطأ", default)).Error.Code);
            Assert.True((await service.CancelApprovedAsync(exit, "لم يغادر", default)).IsSuccess);
            Assert.Equal(("Housing", (DateOnly?)null), Head(await ledger.PeriodsAsync(c, default)) is var hc ? (hc.Kind, hc.EndsOn) : default);
            Assert.Equal("CanceledAfterApproval", (await scope.ServiceProvider.GetRequiredService<MovementQueries>().GetAsync(exit, default))!.Status);
            Assert.Equal("conflict.movement_not_amendable", (await service.CancelApprovedAsync(exit, "مرة أخرى", default)).Error.Code);
        }
    }

    private static PeriodInfo Head(IReadOnlyList<PeriodInfo> periods) => periods[0];

    private static MovementInput Input(string type, Guid worker, DateOnly on) =>
        new(type, worker, on, null, null, null, null, null, null, false, null, null, null, null, null);

    private static async Task RunAsync(IServiceScope scope, MovementService service, MovementInput input)
    {
        var saved = await service.CreateAsync(input, default);
        Assert.True(saved.IsSuccess, saved.IsFailure ? saved.Error.Code : null);
        Assert.Null(saved.Value.SubmitError);
        Assert.Equal("InApproval", (await scope.ServiceProvider.GetRequiredService<MovementQueries>().GetAsync(saved.Value.Id, default))!.Status);
    }

    /// <summary>The operations manager approves their open tasks.</summary>
    private async Task DecideAllAsync(Guid tenantId, Guid manager, int expected)
    {
        using var scope = database.Scope(tenantId, user: manager.ToString());
        var workflow = scope.ServiceProvider.GetRequiredService<WorkflowDbContext>();
        var tasks = await workflow.WorkItems.Where(w => w.AssigneeUserId == manager && w.Status == WorkItemStatus.Pending).OrderBy(w => w.CreatedAt).ToListAsync();
        Assert.Equal(expected, tasks.Count);
        foreach (var task in tasks)
        {
            var decided = await scope.ServiceProvider.GetRequiredService<ApprovalEngine>().DecideAsync(task.Id, Decision.Approve, "موافق", null, default);
            Assert.True(decided.IsSuccess, decided.IsFailure ? decided.Error.Code : null);
        }
    }

    private async Task<(Guid Creator, Guid OperationsManager)> PeopleAsync(Guid tenantId)
    {
        using var scope = database.Scope(tenantId, user: "setup");
        var identity = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var catalog = scope.ServiceProvider.GetRequiredService<PermissionCatalog>();
        async Task<Guid> PersonAsync(string name, params string[] permissions)
        {
            var user = UserAccount.Create(name, null);
            identity.Users.Add(user);
            var membership = new Membership(user.Id, tenantId);
            identity.Memberships.Add(membership);
            var role = Role.Create($"r-{Guid.NewGuid():N}"[..20], name, name, ["operations.movements.view", .. permissions], catalog).Value;
            identity.Roles.Add(role);
            identity.RoleAssignments.Add(new RoleAssignment(membership.Id, role.Id, null, tenantId));
            await identity.SaveChangesAsync();
            return user.Id;
        }

        return (await PersonAsync("منسق العمليات", "operations.movements.manage", "commercial.prices.manage"), await PersonAsync("مدير العمليات", "operations.movements.approve", "operations.movements.arrival.amend", "operations.movements.final_exit.cancel_approved"));
    }

    private static Guid Worker(FakeCrm crm, string number, Guid nationality, Guid profession, int status, Guid? project, string? projectName) =>
        crm.Add(CrmEntities.Employee, new()
        {
            ["new_name"] = $"WORKER {number}", ["new_empidnumber"] = number, ["new_idnumber"] = $"2{number[3..]}00000",
            ["statuscode"] = status, ["new_employeetype"] = 2, ["new_projectid"] = project?.ToString(), ["new_projectidname"] = projectName,
            ["new_projectjoingdate"] = project is null ? null : "2026-07-31T21:00:00Z",
            ["new_nationalityid"] = nationality.ToString(), ["new_professionid"] = profession.ToString(), ["new_totalsalary"] = 1500m,
        }, created: Created2025);

    private async Task<Guid> CreateCompanyAsync()
    {
        using var scope = database.Scope(system: true);
        var code = $"mv-{Guid.NewGuid():N}"[..16];
        return (await scope.ServiceProvider.GetRequiredService<OrganizationService>().CreateTenantAsync(code, "شركة الحركات", "Movements Co", default)).Value.Id;
    }

    private async Task SyncAndImportAsync(Guid tenantId, FakeCrm crm)
    {
        using var scope = database.Scope(tenantId, user: "crm-sync");
        var db = scope.ServiceProvider.GetRequiredService<CrmSyncDbContext>();
        var sync = ActivatorUtilities.CreateInstance<CrmSyncService>(scope.ServiceProvider, (ICrmSource)crm, Options.Create(new CrmSyncOptions()));
        db.Runs.Add(new SyncRun(SyncMode.Incremental, "test", DateTimeOffset.UtcNow));
        await db.SaveChangesAsync();
        var consumers = scope.ServiceProvider.GetServices<ICrmStagingConsumer>().ToList();
        Assert.True(await sync.RunNextAsync(scope.ServiceProvider.GetRequiredService<ReferenceImportService>(), consumers, default));
    }
}
