# HR UI Design System Specification

**Product:** Enterprise ERP — Human Resources Module  
**Design direction:** Approved Modern SaaS payroll workspace with enhanced KPI cards  
**Version:** 1.0 — 19 October 2026  
**Status:** Design reference approved; implementation NOT authorized  
**Primary language/direction:** Arabic / RTL, with English identifiers and optional LTR localization

> **MANDATORY AGENT INSTRUCTION — READ-ONLY DESIGN BRIEF**
> Read and understand this document, inspect the existing UI architecture only when explicitly permitted, and prepare recommendations. **Do not create, edit, delete, migrate, install, deploy, commit, or run modifying commands against project files, databases, infrastructure, or configurations until the user explicitly authorizes implementation.** Approval of this design document is not approval to implement it. Ask before choosing a UI framework or replacing an existing component library.

## 1. Scope and design intent

Build a consistent visual and interaction language across HR screens: payroll runs, employee directory/profile, attendance, leave, contracts, recruitment, organizational structure, allowances/deductions, approvals, documents, and reports. The approved reference is the **first Modern SaaS layout**, refined with the **latest enhanced payroll KPI cards**: five distinct cards, mini trend charts, prior-month comparison, absolute difference, and an employee coverage visualization. Preserve the broad layout: dark navy right-side navigation, light canvas, white content surfaces, payroll workflow stepper, financial KPI strip, large dense payroll grid, and contextual employee details panel.

The mockups are **visual references only**. Their names, dates, numbers, trends, labels and calculations are illustrative, not requirements or validated business rules. The UI must never compute payroll or approval status from mockup figures.

### Goals
- Financial-grade clarity and fast scanning for HR and payroll operators.
- Maximum useful data density without sacrificing readability.
- Consistent navigation, actions, status patterns, filters, and detail views.
- Strong Arabic RTL support and reliable mixed Arabic/English/numeric rendering.
- Responsive desktop-first behavior, keyboard accessibility, and high performance.
- No regressions in payroll logic, permissions, approvals, or existing system performance.

### Non-goals
- Redesigning business workflows or financial formulas.
- Changing database schema, API contracts, security policy, or approval logic.
- Selecting or migrating to a new frontend framework without investigation and authorization.

## 2. Existing technical environment and integration constraints

Known backend context: **.NET 10 / C# modular monolith**, **ASP.NET Core Minimal APIs**, **Entity Framework Core 10**, **SQL Server 2022**, module contracts, audit logging, and an outbox pattern. The **frontend stack has not been verified**. The agent must first identify the actual rendering stack, styles, build pipeline, component library, routing, localization solution, and existing UI constraints when authorized to inspect. Do not assume React, Blazor, Razor Pages, Angular, or any other frontend framework.

UI changes should remain presentational where possible. Existing API payloads, authorization, audit behavior, business calculations, and approval semantics must remain authoritative. Request separate approval for backend changes. Prefer incremental adoption with shared tokens and components over a big-bang rewrite.

## 3. Foundation tokens

All values below are **proposed implementation tokens**, to be confirmed against the existing brand and contrast checks; they are not claims that these exact hex values were extracted from the mockup.

### 3.1 Colors

| Token | Value | Usage |
|---|---|---|
| `--hr-navy-950` | `#082B49` | Primary right navigation background |
| `--hr-navy-900` | `#0B3558` | Navigation hover/secondary surfaces |
| `--hr-primary-600` | `#2563EB` | Primary actions, active tab, selected rows |
| `--hr-primary-700` | `#1D4ED8` | Primary hover |
| `--hr-canvas` | `#F6F8FC` | Main page background |
| `--hr-surface` | `#FFFFFF` | Cards, panels, grid |
| `--hr-surface-muted` | `#F1F5F9` | Table headers, alternate surfaces |
| `--hr-border` | `#E2E8F0` | Borders, separators |
| `--hr-text` | `#0F2747` | Main headings and numbers |
| `--hr-text-muted` | `#64748B` | Labels, secondary text |
| `--hr-success` | `#059669` | Completed/positive status when semantically valid |
| `--hr-warning` | `#D97706` | Pending/review warning |
| `--hr-danger` | `#DC2626` | Errors, exceptions, destructive actions |
| `--hr-info` | `#2563EB` | Informational states |
| `--hr-violet` | `#7C3AED` | Employee-count visual accent |

**Critical rule:** A rise in deductions or payroll costs is not automatically good. Use neutral comparison colors unless business-defined semantics justify green/red. Always pair color with a textual label or icon; never encode meaning with color alone.

### 3.2 Typography

- Preferred Arabic font: **IBM Plex Sans Arabic**; fallback: `Tajawal`, `Segoe UI`, `Arial`, sans-serif. Load fonts only from approved/licensed local or organization-approved sources.
- Numeric data: tabular numerals (`font-variant-numeric: tabular-nums`), consistent decimal precision, right alignment in RTL numeric columns unless user testing establishes another convention.
- Body: 13–14px; secondary: 12px; page title: 22–24px / 700; section title: 16–18px / 600; KPI value: 25–30px / 700.
- Avoid excessive font weights and tiny table text. Minimum body/table text target: 12px, with user-selectable comfortable density.
- Use locale-aware formatters for currency, date, and numbers. Preserve employee IDs and invoice/reference codes as exact strings.

### 3.3 Spacing, geometry, elevation

- Base spacing unit: 4px. Preferred gaps: 8 / 12 / 16 / 24px.
- Page padding: 20–24px desktop, 12–16px tablet.
- Card radius: 12px; inputs/buttons: 8px; badges: pill.
- Card border: 1px subtle neutral; shadow: restrained (`0 2px 12px rgba(15,39,71,.05)`).
- Input/button height: 34–40px; compact table row: 38–42px; comfortable: 46–52px.
- Sidebar: approximately 220–240px expanded; support collapsed mode only if consistent with existing shell.
- Keep visible focus rings at least 2px; hover states subtle, not layout-shifting.

## 4. Application shell and page anatomy

**Desktop RTL composition:** right navigation sidebar; top utility bar; breadcrumbs; page title/status/period; action toolbar; workflow progress; KPI row; tabs/filter toolbar; data grid; optional contextual drawer. The exact order of action toolbar and stepper can adapt to available width, but maintain consistent page hierarchy.

Shared page regions:
1. `AppShell` — navigation, global search, notifications, profile.
2. `PageHeader` — breadcrumb, title, description, record/run status, period selector.
3. `PageActions` — primary action, secondary actions, overflow; permission-aware.
4. `WorkflowStepper` — server-derived stages, accessible labels, timestamps when available.
5. `KpiCardGroup` — payroll-specific metrics or domain-specific HR metrics.
6. `ContentTabs` — data, summary, exceptions, analytics, etc.
7. `FilterToolbar` — search, status, department, date/period, saved view, column selector.
8. `EnterpriseDataGrid` — compact, scalable table.
9. `DetailsDrawer` — record context without losing table selection or filters.

Use a **single primary action** per page. Destructive/irreversible actions require a confirmation dialog, authorization checks, and a clearly described consequence. Do not infer that the current visual action order is the correct financial workflow.

## 5. Approved enhanced payroll KPI cards

**Five cards are required** in the desktop payroll header:

| Card | Main metric | Supporting content | Accent |
|---|---|---|---|
| Employee coverage | Employees included in this payroll run | Coverage/status breakdown; counts of excluded or exceptional employees if available | Violet |
| Base salaries | Total base salaries | Mini trend; prior comparable period; absolute and percentage change | Blue |
| Allowances | Total allowances | Mini trend; prior comparable period; absolute and percentage change | Green |
| Deductions | Total deductions | Mini trend; prior comparable period; absolute and percentage change | Amber |
| Net payroll | Total net payroll | Mini trend; prior comparable period; absolute and percentage change | Rose/red accent (not an error state) |

**Visual anatomy:** subtle pastel tint, small circular icon, descriptive label, prominent value and unit `ر.س`, mini spark bars/line, clearly labeled comparison, and a small footer with previous-period value and difference. Employee card may use a compact donut for coverage **only when both numerator and denominator are defined and accurate**; otherwise show a simple count and status breakdown. All mini charts must have accessible text equivalents.

**Financial correctness:** metrics must come from the same authoritative payroll snapshot and scope. Confirm definitions of base salary, allowances, deductions, net, excluded employees, and payroll period with the domain owner. Comparisons must use equivalent periods and explicitly state the comparison period. For missing data show `—` with explanatory tooltip; never fabricate trends or show zero as a substitute for unknown. Currency rounding and totals must follow existing business rules; do not sum rounded row displays to invent an authoritative total.

**Responsive:** five cards across when space permits; 3+2 or 2-column wrapping on smaller desktops/tablets; single-column on narrow phones. Keep card heights consistent per row and avoid chart labels that crowd the number.

## 6. Payroll page specification

### 6.1 Header and workflow

Display payroll run reference, payroll month/year, period boundaries, status badge, and authorized actions: recalculate, import, export Excel, review, approve, lock/close as applicable. Only display enabled actions when allowed by server-authoritative permissions and workflow state. Actions with side effects must show progress and server confirmation. Prevent duplicate submission and handle concurrent updates gracefully.

`WorkflowStepper` stages (illustrative): Preparation → Review → Approval → Closure. Actual stage names and transitions must come from the real workflow engine, not be hard-coded from the mockup.

### 6.2 Tabs

Recommended: Employee list (default), Financial summary, Exceptions, Allowances, Deductions, Analytics. Tabs may be tailored to actual domain capabilities. Preserve selected tab in URL or view state where practical.

### 6.3 Payroll grid columns

Recommended starting set, not an enforced database schema:

| Group | Example columns |
|---|---|
| Identity | Selection, employee name, employee number, department, job title, employment status |
| Attendance / period | Paid days, absence days, unpaid leave, overtime (if relevant) |
| Base | Base salary |
| Allowances | Housing, transport, other, total allowances |
| Deductions | Social insurance, absence, advances/loans, other, total deductions |
| Results | Gross pay (if defined), net pay, currency, calculation/exception status |
| Actions | View details, authorized adjustments, history |

Use grouped column headers for allowances and deductions. **Freeze employee identity columns at the RTL start edge**; keep key totals visible when possible. Support horizontal scroll without squeezing columns to unreadable widths. Row actions should not require hover alone.

Grid features: server-side pagination/filter/sort, configurable density, saved column visibility/order, search, filter chips, multi-select, bulk actions only when authorized, sticky header, sticky totals summary, empty/error/loading states, keyboard navigation, and export of the explicitly defined scope. Provide page count and record count. Distinguish *current page totals* from *entire filtered payroll totals* in labels.

### 6.4 Details drawer

Open on row click or explicit Details action; preserve list position and selection. Width approximately 420–520px on desktop, full-screen on narrow screens. Sections: employee identity; current payroll breakdown; base; allowance lines; deduction lines; net amount; calculation explanation where supported; audit/history; exceptions. Every amount must carry its currency and period context. Provide a clear close button and return focus to the invoking control.

**No unapproved inline editing** of payroll values. If adjustment is supported, it must use existing domain validation, permissions, audit trail, and confirmation.

## 7. Shared component contracts

Use framework-neutral component specifications first. Adapt naming and implementation to the **existing** frontend technology.

| Component | Required props / behavior |
|---|---|
| `HrPageHeader` | title, breadcrumbs, subtitle, status, period, actions |
| `HrKpiCard` | label, value, unit, icon, accent, comparisonLabel, previousValue, deltaValue, deltaPercent, trendData, loading/error |
| `HrWorkflowStepper` | stages, currentStage, completedStages, disabled states, descriptions |
| `HrFilterBar` | query, filters, activeChips, reset, savedView |
| `HrDataGrid` | stable row key, column schema, server query state, selection, density, pinned columns, totals scope |
| `HrStatusBadge` | status code, localized label, semantic tone, optional icon |
| `HrDetailsDrawer` | selected record, tabs/sections, loading/error, close, focus management |
| `HrConfirmDialog` | operation, impact summary, cancel/confirm, pending state |
| `HrEmptyState` | concise reason and context-appropriate recovery action |
| `HrSkeleton` | shape-matched loading placeholder without layout jumps |

Component APIs above are conceptual, **not executable contracts**. Prefer existing design-system primitives if already present. Keep shared components presentation-oriented; place business logic in the current application/service layer.

## 8. RTL and localization rules

- Set document/container direction correctly (`dir="rtl"` for Arabic). Use logical CSS properties (`margin-inline-start`, `inset-inline-end`, `border-start-start-radius`) rather than hard-coded left/right.
- Keep Arabic navigation, table reading order, drawer placement, pagination, and icons directionally consistent. Do not mirror logos or universally mirror all icons.
- Isolate employee IDs, email addresses, phone numbers, currency codes, and Latin text with `dir="ltr"` or `<bdi>` as appropriate.
- Use centralized translation keys; never bake user-visible strings into shared components.
- Use locale-aware dates and currencies, but preserve unambiguous payroll period labels and export formats.
- Verify long Arabic labels, truncation with accessible full text, and mixed-script search.

## 9. Accessibility and interaction quality

Target WCAG 2.2 AA where feasible: text contrast >=4.5:1, meaningful non-text contrast >=3:1, visible focus, semantic controls and table headers, descriptive action labels, keyboard-operable dropdowns/drawers/dialogs, screen-reader announcements for status updates, and reduced-motion preference. Ensure touch targets are practical on mobile. Never rely only on red/green coloring for financial meaning.

Loading states should be localized and distinguish background refresh from blocking operations. Show explicit validation errors, permission-denied states, and retry options. Avoid silent failures.

## 10. Performance and data safety

- Do not fetch all payroll employees on initial load. Prefer server pagination and selective projection; use virtualization only when it demonstrably helps and works with sticky/pinned columns and accessibility.
- Debounce search; cancel stale requests; avoid duplicate fetches and excessive component re-renders.
- Compute financial summaries on the authoritative backend or existing service; never treat client-side sums of a page as run totals.
- Do not expose salary data in client logs, analytics payloads, URLs, or browser storage without explicit authorization and review.
- Enforce access control server-side; hiding buttons is not security.
- Export must respect role permissions, applied scope, sensitive-data handling, and audit requirements.
- Measure load time and interaction performance against a baseline from the existing system before claiming improvement.

## 11. Responsive behavior

| Width | Recommended behavior |
|---|---|
| >=1440px | Full sidebar, five KPI cards, grid and optional details drawer |
| 1024–1439px | Sidebar may collapse; KPI wrap; drawer overlays or reduces grid width with minimum column constraints |
| 768–1023px | Two/three KPI columns; horizontal-scroll grid; drawer overlay |
| <768px | Compact header; KPI stack; prioritized columns or mobile record list; full-screen details |

Breakpoints are design recommendations and must be adapted to the current shell and actual content. Desktop payroll operations take priority, but mobile views must remain usable.

## 12. Screen patterns across HR

| Screen | Shared patterns | Domain-specific content |
|---|---|---|
| Employee directory | Header, KPI, filters, grid, drawer | Employment status, sponsor/company, employee profile |
| Employee profile | Header, tabs, status, audit | Personal/work data, contracts, documents, payroll links |
| Attendance | Header, date range, filters, grid, exceptions | Shifts, clock events, lateness, absence |
| Leave | Header, request status, grid, workflow | Balance, request period, approvals |
| Payroll | Enhanced KPI, workflow, grid, drawer | Financial breakdown and net salary |
| Contracts | Header, statuses, grid, drawer | Contract periods, renewals, attachments |
| Recruitment | Header, funnel KPIs, filters, cards/grid | Candidate stages and interview activity |
| Approvals | Header, stepper, action controls, history | Assigned tasks, delegation, decision log |
| HR reports | Filters, KPIs, tables, export | Authorized analytics and aggregation |

Do not force a payroll-specific KPI layout onto screens where it is not meaningful; reuse the same visual language, spacing, and interaction contracts.

## 13. State matrix and acceptance checklist

For each major screen/component validate:

- [ ] Default, loading, empty, error, offline/retry (if applicable), permission denied, and no-results states.
- [ ] RTL Arabic, mixed Arabic/English IDs, long labels, and optional LTR locale.
- [ ] Keyboard and screen-reader access, focus return from drawer/dialog, visible focus.
- [ ] Compact and comfortable grid density, sticky columns, horizontal scroll, stable column widths.
- [ ] Pagination/filter/sort/export operate on the correct server-side scope.
- [ ] Payroll KPIs reconcile to authoritative run data, with documented definitions and rounding.
- [ ] Prior-month comparison uses equivalent periods; missing comparisons are explicit.
- [ ] Approval/lock actions are permission-gated and backed by authoritative workflow state.
- [ ] No unauthorized inline payroll edits or leakage of sensitive data.
- [ ] Layout works at desktop, tablet, and mobile widths without overlap or clipped actions.
- [ ] Performance is benchmarked against current screen, not assumed.
- [ ] Shared components match approved colors, spacing, typography, and states.

## 14. Agent workflow and approval gates

**Gate 0 — NOW: Read only.** Read this document; summarize the approved design, identify uncertainties, and await user instruction. No code changes or commands that mutate the project.

**Gate 1 — Authorized discovery.** Only after explicit user permission, inspect frontend stack, existing components, payroll screen, current localization, and permission model. Produce a gap analysis and implementation proposal. Do not edit.

**Gate 2 — Authorized implementation plan.** Submit component map, phased milestones, API dependencies, risk assessment, performance/accessibility test plan, and screenshots/wireframes. Await explicit approval.

**Gate 3 — Authorized coding.** Implement only the approved scope in small reversible changes; keep domain logic and APIs intact unless separately authorized. Include tests and visual comparisons.

**Gate 4 — Review and release.** User reviews screenshots and acceptance criteria. Do not deploy, migrate databases, or alter production without a separate explicit approval.

### First response required from an AI agent

After reading this file, the agent should respond with:
1. A concise summary of the approved visual direction and enhanced payroll KPI cards.
2. The existing frontend details it needs verified (without assuming a framework).
3. Any unclear business definitions, especially payroll totals, coverage, trends, and workflow statuses.
4. A statement that it **will not begin implementation until the user explicitly instructs it to proceed**.

**END OF SPECIFICATION**
