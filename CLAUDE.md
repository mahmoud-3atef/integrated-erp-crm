# Project instructions

## HR UI design system (binding for all HR screens)

The full specification is [docs/02-target-architecture/15-hr-ui-design-system.md](docs/02-target-architecture/15-hr-ui-design-system.md)
(v1.0, 19 October 2026, approved by the user as the design reference). Read it before any work on an HR screen:

- payroll runs and the payroll grid;
- employees: directory and profile;
- attendance, shifts, leave, contracts and recruitment;
- organization structure;
- allowances and deductions;
- HR approvals, documents and reports.

### Approval gates (from §14 of the spec)

Each gate needs the user's explicit go-ahead in chat. Approving the design is not approval to implement it.

| Gate | What is allowed |
|---|---|
| 0 | Read the spec and summarize it. |
| 1 | Discovery: inspect the code and write a gap analysis, with no edits. |
| 2 | Plan: component map, milestones, API dependencies, risks, test plan and wireframes. Wait for approval. |
| 3 | Code: only the approved scope, in small reversible changes with tests and screenshots. |
| 4 | Review: the user reviews the result. Deploying or migrating a database needs its own approval. |

The user's standing deploy routine (three commands, run by the user) is unchanged and still applies.

### Rules that always apply to HR screens

**Layout**
- Dark navy navigation on the right and a light canvas, with white cards (radius 12px).
- Page anatomy, in this order:
  - `PageHeader`: breadcrumb, title, status and period;
  - one primary action, with secondary actions and an overflow menu;
  - `WorkflowStepper`, with stages that come from the workflow engine;
  - the KPI row;
  - tabs and filters;
  - a dense data grid;
  - a details drawer of 420–520px.
- No coloured hero band on HR pages.

**Payroll KPI strip**
- Five cards, each with a pastel tint, a round icon, the value with «ر.س», mini trend bars, the comparison period named, and the previous value with the difference.
- The cards and their accents:
  - employee coverage: violet;
  - base salaries: blue;
  - allowances: green;
  - deductions: amber;
  - net: rose (not an error).
- All figures come from the backend run snapshot. A page of the client must never be summed into a total.
- When a value is unknown, show `—` with a tooltip, never 0 and never a made-up trend.
- A rise in cost or deductions is not "good": comparisons use neutral colours, and colour is never the only signal.

**Payroll grid**
- Grouped headers for allowances and deductions.
- Identity columns frozen at the RTL start edge, with a sticky header and a sticky totals row. Each total says whether it covers the page or the whole filtered run.
- Paging, filtering and sorting run on the server.
- Comfortable and compact density.
- No inline editing of payroll values. Any adjustment goes through domain validation, permissions and the audit trail.

**Tokens** (spec §3; to be checked against the brand and contrast)
- Colours: navy `#082B49`, primary `#2563EB`, canvas `#F6F8FC`, border `#E2E8F0`, text `#0F2747`, muted text `#64748B`.
- Status colours: success `#059669`, warning `#D97706`, danger `#DC2626`, violet `#7C3AED`.
- Font: IBM Plex Sans Arabic with tabular numerals.
- Sizes:
  - body 13–14px, title 22–24px, KPI value 25–30px;
  - inputs and buttons 34–40px high;
  - rows 38–42px (compact) or 46–52px (comfortable).

**RTL**
- Use logical CSS properties.
- Wrap IDs, codes, e-mail addresses, phone numbers and Latin text in `<bdi>` or `dir="ltr"`.
- All text goes through translation keys: فصحى Arabic and correct English, with ar/en parity.

**Accessibility**
- Aim for WCAG 2.2 AA: visible focus, a keyboard-operable drawer and dialogs, and focus returned to the control that opened them.

**Data safety**
- Salaries never go into logs, URLs or browser storage.
- Permissions are enforced on the server, and exports respect role and scope.

**States**
- Every screen has loading (skeletons), empty, error with retry, permission-denied and no-results states.

### Approved payroll run page (reference)

The user approved [assets/payroll-run-approved.webp](docs/02-target-architecture/assets/payroll-run-approved.webp) on 2026-10-19 as the target design. From the top of the page down:

- **Header:** title «مسير الرواتب» with a description, a period selector (‹ نوفمبر 2026 ›) and a status chip.
- **Toolbar:** إعادة الحساب، استيراد بيانات، تصدير Excel، المزيد، and one primary action «إجراءات المسير».
- **The compact approval bar** (see below).
- **Five KPI cards:**
  - employees, with a coverage donut and counts of active, stopped and contract-ended;
  - deductions;
  - allowances;
  - base salaries;
  - net.
- **Tabs:** قائمة الموظفين، الملخص المالي، الاستقطاعات (n)، البدلات (n)، الرسوم البيانية.
- **Filter bar:** search, columns, status, department and a «تصفية» button.
- **The grid:**
  - columns: checkbox, #, employee with initials avatar, number, department, job, status chip, base;
  - grouped البدلات (food, housing, transport, other) and total allowances;
  - deductions, net, and the row actions «تفاصيل» and ⋯;
  - a sticky total row, and paging with a page-size selector («عرض 1 - 10 من إجمالي 1,028 موظف»).
- **The side panel «سير موافقات المسير»:**
  - the numbered stages with actor, date and notes;
  - the current stage's approver card;
  - an optional approval note (0/500), with Approve, Reject and Return actions;
  - the stage attachments.

The names and figures in the image are illustrative. In the real page all stages, permissions and totals come from the server.

## Global approval bar (binding for every module with workflow-linked records)

The full specification is [docs/02-target-architecture/16-approval-workflow-ui.md](docs/02-target-architecture/16-approval-workflow-ui.md) (v1.2, 22 October 2026). Its §0 holds the user's v1.2 decisions and wins over the rest of the spec.

**Layout**
- One shared `GlobalCompactApprovalBar` sits under the page header and above the KPIs and grids. It is never re-implemented inside a module.
- It is the old system's approval track made compact (about 110px): a header line, then the stages as initials circles with the time each took on the links.
  - «موافقة» and «رفض» sit side by side after the current (blue) stage, followed by «⋯».
  - Completed stages show a green check and upcoming stages are muted.
  - Return, Delegate and similar actions go in a «More» menu.
  - «View all stages» opens an `ApprovalHistoryDrawer` of 480–560px. Only one drawer is open at a time.
- Many stages collapse into a chip such as «+5 مراحل». The bar supports parallel approvers.

**Actions**
- «موافقة» and «رفض» show to every reader while the approval runs. A user without the task gets a no-permission popup; the server still decides every action. The «⋯» menu lists only the actions the server allows.
- «موافقة» decides in one click, with no dialog unless the stage asks for fields on approval.
- `DecisionDialog`: Reject, Return and Delegate need a reason, and Return asks for its target step when there is more than one.
- Concurrency: show «This task was already processed», refresh, and never allow a double approval.

**Responsive**
- Collapse distant stages first.
- On mobile, use a sticky action area. A permitted decision is never hidden.

**States**
- Loading, no workflow, actionable, read-only, parallel, returned or reopened, completed, rejected, and error or stale.

### Decisions confirmed by the user (2026-10-19)

1. **Approval buttons:** where the payroll image and spec v1.1 disagree, follow spec v1.1: Approve on the right of the current stage and Reject on its left, in the same row.
2. **«سير الموافقات»:** it is not a permanent side panel. It is the history drawer, opened by «عرض كل المراحل», so the grid keeps the full width.
3. **Colours:** the blue `#2563EB` primary and the HR tokens apply inside HR screens and the approval bar. The rest of the app keeps its current tones.
4. **The first payroll run (4.1) is for company-sponsored workers.** The grid shows the project in place of the department and the profession in place of the job, with the worker's status.
5. **Approval backend:** concurrency and idempotency (record version and idempotency key) and a choice of return target are authorized as backend changes for the approval bar.
6. **Commercial registrations:** the company has two, and a worker's registration comes from the old system's sponsor («Care-Pro - 05», «Care-pro - 07»), linked once in `payroll.sponsor_registration`. A payroll run covers one registration.
7. **Unpaid days:** days in housing are not paid. Only the work periods on approved timesheets are paid.
8. **Employee file (staff profile page): exception to the HR tokens.** It follows the old system's latest employee screen (`C:\Cl\Project-Update\project05-10-2026\...\HR_EmployeeDetails.aspx` and `content/css/pages/hr-employee-details.css`, 2026-10-14) in its navy colours: the hero with the facts, the dark «ملخص عام» card, pill tabs, and boxes titled on their border with «تعديل». The wireframe is [wf-staff-profile.png](docs/02-target-architecture/assets/wf-staff-profile.png). The organisation pages keep the HR design.
9. **Staff directory (`/hr/employees`): exception to the HR page anatomy (2026-10-24).** It is laid out as the workers list (docs/02-target-architecture/22). The changes:
   - no page header and no KPI row;
   - one toolbar with the search, the status (the former tabs), the department, the registration, the actions and the total;
   - the applied filters as chips;
   - a navy table head with the employee column held in place.

### Already verified (answers §2 of the spec for this repository)

- **Frontend:**
  - React 19 + TypeScript with Vite, and MUI 9 with Emotion and the Stylis RTL plugin.
  - Translations through i18next (`src/Web/src/i18n/ar.json` and `en.json`).
  - Routing with React Router.
  - Shared parts are in `src/Web/src/components`: `RecordLayout`, `ListLayout`, `WizardDialog`, `ApprovalTimeline` and the workflow `RecordApproval`/`StageTracker`.
- **Backend:** .NET 10 modular monolith with Minimal APIs and EF Core.
- **Approvals:** come from the shared workflow engine (`/api/v1/workflow`).
