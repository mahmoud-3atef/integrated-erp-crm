# 21 — Cutover from the old system, and removing the migration code

| | |
|---|---|
| **Status** | Plan reviewed by the user on 22 October 2026 (decisions in §8). Nothing is built yet: Phase 1 starts when the user asks. |
| **Date** | 22 October 2026 |
| **Asked for by the user** | «عمليات النقل مش محتاج يبقي كود النقل جزء من المشروع الحالي لان احنا بعد نقل البيانات هنقفل النظام القديم تماما … ممكن نبني بعد كدة اكواد استيراد بيانات بس هتكون من ملفات اكسيل» |

## 1. The principle

The old system (CarePro, Dynamics CRM 2011) is closed for good once its data has been brought over. After that:

- **The product holds no code that knows the old system:**
  - no CRM sync;
  - no CRM staging copy;
  - no import that reads `new_*` entities;
  - no report that reads the old invoices live.
- **The data that was brought stays.** It is now the new system's own data: workers, projects, the timesheets made from old invoices, opening balances, histories. The `crm_id` and `from_old_system` columns can stay as plain historical references. Nothing reads the CRM through them.
- **Data for a new company or site** comes later through **Excel imports** with our own templates (§7), never through code tied to CarePro.

## 2. Why not remove it today

Today the new system still reads from the old one every few minutes. Its daily screens depend on that:

- **Workforce:**
  - `WorkerImportService` builds people and worker files from `new_employee`;
  - `HistoryBuilder` builds the period ledger from work starts, housing orders and vacations;
  - `InvoiceCheckBuilder` checks the old invoices against the ledger.
- **Commercial:**
  - `CommercialImportService` builds customers, contracts and projects (`account`, `new_project`);
  - `PricingImportService` reads current prices from work starts.
- **Operations:** `DeliveryOrderImportService` and `ReturnOrderImportService` copy the old delivery and housing orders, read-only, into the lists.
- **Housing:** `HousingReleaseService` frees the rooms of workers who left housing in the old system.
- **Billing:**
  - `OpeningBalanceImport`: the open old invoices as opening balances;
  - `LegacyTimesheetImport`: old invoices from June 2026 as draft timesheets.
- **Reports:**
  - `LegacyInvoices` and `LegacyTasks` read the staging copy live;
  - they feed `ExecutiveReport`, `CeoReport`, `ProfitReport` and `ManagementDashboard`.
- **Organization, through CrmSync's `ReferenceImportService`:** nationalities, professions and the other lookups.
- **Host:**
  - `CrmSyncModule` in `Program.cs`;
  - the «crm» health check;
  - the «مزامنة CRM» admin page (`CrmSyncPage.tsx`, `api/crmSync.ts`).

In all, 11 services in 7 modules, plus the host and one page. If we remove the sync before the new system does each job itself, workers, projects, prices and the period ledger stop updating, and the reports go empty.

## 3. What has to be true before cutover (the readiness gate)

For every job the old system still does, the new system must do it, and people must be doing it there:

| Job done in the old system today | Must be done in the new system |
|---|---|
| A new worker or a change to a worker file | Workforce: create and edit a worker |
| A new customer, contract or project | Commercial: create and edit them |
| A work start or delivery to a project | Operations: delivery orders that write the period ledger |
| A return to housing, or a transfer | Operations and Housing: return and housing orders |
| A vacation, or an exit | Leave and Workforce |
| A price change | Commercial: price packages |
| A monthly invoice | Billing: timesheet, then invoice |
| Collection | Billing: receipts |
| Tasks | Tasks in the new system (the management dashboard «المهام» tab reads the old tasks today) |

Each row is checked with the user before the cutover date is set. Any row that is not ready either blocks the cutover or gets an agreed manual workaround.

## 4. Data that stays as data, and where it lives

Some screens show the old system's history. Not all of it has a home in the new system's own tables yet:

| History | Today | After cutover |
|---|---|---|
| Workers, projects, customers, contracts, prices | Already copied into the modules' tables | Stays as is |
| Period ledger (work, housing, vacation) | Built into Workforce's tables | Stays. New periods come from the new system's orders. |
| Old delivery and housing orders | Copied into Operations' tables (read-only) | Stays |
| Old invoices from June 2026 | Draft timesheets (doc 20) | Stays |
| Open old invoices | Opening balances in Billing | Stays |
| **Old invoices before June 2026, and old tasks** | **Read live** from the staging copy by the reports | **Decision A below** |

**Decision A: the old reports' history.** The executive, CEO, profit and management reports count old invoices and tasks.

- **A1 (chosen by the user, 2026-10-22):** at cutover, freeze what the reports need into a small read-only `archive` schema: invoices, their lines and tasks, with only the columns the reports use. The reports read the archive for months before cutover and the new system's invoices after. The archive is data with no code that knows the CRM. The rest of the staging copy is dropped.
- **A2:** keep the full staging copy as a frozen database. It is simpler, but it keeps CRM shapes (`new_*` JSON) inside the product.
- **A3:** the reports start at the cutover month. The old history stays only in a backup.

## 5. Phases

### Phase 0 — now until cutover (no change to how things run)

- Any new import from the old system is marked temporary in its summary: «يُحذف مع المزامنة عند التحويل (doc 21)». It goes in this document's list (§9).
- No new product feature may depend on `ICrmStaging`. A new screen reads the module's own tables.

### Phase 1 — preparation (before the date)

1. **Close the readiness gate (§3)** with the user, row by row.
2. **Decision A**, and if A1, build the `archive` schema and point the reports at it, with tests.
3. **A dry run on a copy of production:**
   - a full sync;
   - every import;
   - a comparison of counts and totals with the old system (workers, projects, open balances, invoices from June 2026);
   - write down how long it takes.
4. **Write the cutover-day script** (§6) and rehearse it on the test copy.

### Phase 2 — cutover day

See §6.

### Phase 3 — removal (a separate release after cutover)

1. Remove every `ICrmStagingConsumer` and live staging reader listed in §2 from the modules, and their registrations in each `*Module.cs`.
2. Remove the `IntegratedErp.Modules.CrmSync` and `.Contracts` projects, `CrmSyncModule` from `Program.cs`, the «crm» health check, the `CrmSync:*` settings and the admin page with its route and menu item.
3. Remove the old-system-only endpoints and UI:
   - «نقل فواتير النظام القديم» and `POST /timesheets/import-legacy`;
   - the opening balance import trigger;
   - any similar ones.
4. A migration drops the `crmsync` schema (after the backup in §6). Under A1 it keeps the `archive` schema.
5. **Keep the code itself in git history:**
   - tag the last commit that has it: `legacy-migration-final`;
   - nothing is copied into another folder of the repository.
6. **Tests:**
   - remove the sync tests;
   - add an architecture test: no module references `CrmSync`, and no source file contains `new_` entity names outside migrations and the archive.

### Phase 4 — Excel imports (later, when needed)

See §7.

## 6. Cutover-day script (draft)

| Step | Who |
|---|---|
| 1. Announce the freeze. Users stop writing in the old system. | User |
| 2. Back up the old CRM database (kept forever, read-only). | User / IT |
| 3. Back up the new system's database. | User |
| 4. Run a final full sync, then every import in order: reference data, workers and history, customers/contracts/projects, prices, orders, housing release, opening balances, legacy timesheets. | User runs one script; Claude prepares it |
| 5. Compare counts and totals with the old system, as in the dry run. | Claude prepares the report; the user signs off |
| 6. Under A1, freeze the archive. | Script |
| 7. Turn the sync off: empty `CrmSync:ConnectionString` and stop the worker. | User |
| 8. Users start working in the new system only. The old system stays readable for questions, with no writes. | User |
| 9. After an agreed period, for example one month with no surprises, release Phase 3. | User approves |

Roll back if step 5 fails: restore the new system's backup, re-enable the sync, and keep working in the old system.

## 7. Excel imports (Phase 4)

These are for a new company or site, not for CarePro.

- **Templates:** one Excel template per entity, made by the new system with its own columns in فصحى and English:
  - workers;
  - customers;
  - projects and contracts;
  - prices;
  - opening balances;
  - work periods.
  - There are no `new_*` names anywhere.
- **Validate before saving:**
  - the file is checked first: required fields, lookups, duplicates (identity numbers), dates and amounts;
  - the result shows the errors row by row;
  - nothing is saved until the file is clean.
- **Save and audit:**
  - the save goes through each module's own commands, with the same rules, permissions and audit trail as a screen;
  - there are no direct writes to tables.
- **Order and permissions:**
  - one «استيراد البيانات» screen in Administration lists the imports in the order they depend on each other;
  - each import needs its own permission.
- **Every import is tested** with a valid and an invalid file.

Phase 4 has its own plan and approval when a real need comes.

## 8. The user's decisions (22 October 2026)

1. **Decision A: A1.** At cutover, the reports' history is frozen into a read-only `archive` schema.
2. **The readiness gate (§3): agreed.** It is reviewed with the user row by row before the date is set.
3. **How long the old system stays readable, and when Phase 3 is released:** decided once the new system is complete.
4. **HeadOffice is not brought over.** It was used only to prepare the head office staff's timesheets, and the new system already keeps the head office staff apart. Its 4 invoices (H-F00002/3/4/6) stay outside the timesheets and go to the archive with the rest of the history.

## 9. Temporary code to remove in Phase 3 (kept current until then)

| Module | Code |
|---|---|
| CrmSync | the whole module and its contracts |
| Workforce | `WorkerImportService`, `HistoryBuilder`, `InvoiceCheckBuilder` |
| Commercial | `CommercialImportService`, `PricingImportService` |
| Operations | `DeliveryOrderImportService`, `ReturnOrderImportService` |
| Housing | `HousingReleaseService` |
| Billing | `OpeningBalanceImport`, `LegacyTimesheetImport` and its endpoint, dialog and texts |
| Reports | `LegacyInvoices` and `LegacyTasks` (replaced by the archive under A1) |
| Host and Web | `CrmSyncModule` in `Program.cs`, the «crm» health check, `CrmSyncPage.tsx`, `api/crmSync.ts`, its route and menu item |
