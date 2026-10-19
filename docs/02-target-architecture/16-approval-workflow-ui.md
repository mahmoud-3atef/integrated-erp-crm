# ERP Global Approval Workflow UI Specification
Version: 1.1 — 2026-10-19
Status: Compact inline design approved; implementation NOT authorized.
Supersedes: v1.0 action layout. Preserve existing approval logic and module contracts.

## 1. Purpose and scope
Define one reusable, Arabic-first, RTL approval and task user experience across every ERP module that has workflow-linked records. This specification extends the approved HR Modern SaaS design and applies globally to payroll, leave, recruitment, procurement, finance, contracts, operations and future modules.

## 2. Final approved interaction decision — Compact Inline Approval Bar
- The **Approve** and **Reject** buttons must be on the **same horizontal row** as the stage progression, immediately flanking the **current active stage**: **Approve on its visual right** and **Reject on its visual left** in the Arabic RTL desktop layout. Do not place these actions in a separate row or below the stepper.
- The current stage remains visibly highlighted in blue; completed stages show green checkmarks and upcoming stages are muted. Use labels and icons, never color alone.
- The workflow bar should target **56–64px overall height on desktop** including its internal content (where labels fit); it is a target, not a mandate to clip labels or reduce accessibility. No second dedicated action row on desktop.
- **View All Stages** is a compact secondary button at the end of the bar; opens a history/details drawer without navigation.
- **Return for Review**, Delegate, Request Clarification, and other less frequent permitted actions live in a compact **More** overflow menu near the current stage (or a contextual action in the drawer), avoiding an oversized bar. A business policy may elevate Return only if there is enough space without breaking the single-row layout.
- Actions are visible **only** for the current authorized task actor(s), based on server-returned availableActions for the specific record and task. Other viewers see a read-only bar.
- If a workflow has many stages (e.g., 8–10), preserve legibility by showing current stage, nearby steps, and a collapsed indicator such as “+5 مراحل”; the full sequence remains in the drawer. Never squeeze all stages into unreadable labels.
- A stage may have multiple active tasks or parallel approvers. Display the stage as active and the user-specific action context; do not assume a single approver or a single linear path.

## 3. Component anatomy
### 3.1 GlobalCompactApprovalBar (replaces multi-row ApprovalWorkspace header)
**Location:** directly below the page header/record metadata and above KPIs and data grids, globally across ERP modules with workflow-enabled records. Do not replicate the bar inside each module.

**Desktop single-row anatomy (RTL visual reading order):**
1. Compact workflow status/record reference where space permits.
2. Completed/nearby stage nodes and connectors.
3. **Approve** button immediately on the **visual right** of the current stage.
4. **Current stage node** with stage title and concise state/assignee tooltip or accessible description.
5. **Reject** button immediately on the **visual left** of the current stage.
6. Upcoming/nearby stages and connectors.
7. **View All Stages** and optional overflow controls at the edge.

The component must not rely on raw DOM ordering to achieve visual placement: test actual RTL rendering, tab order, and screen-reader reading order. Approve/Reject are actions for the current task, **not** decorations or transitions between stages. The inline placement must not falsely suggest approval is a stage node.

**Sizing and density:** desktop height target 56–64px; buttons about 32–36px high with comfortable hit areas, restrained padding, stage labels kept to one line where possible with tooltips/full names in the drawer. Preserve sufficient focus outlines and text contrast. Do not shrink fonts below the design system's accessible minimum. Keep the existing page toolbar separate; do not repeat workflow buttons there.

**Responsive behavior:**
- Wide desktop: full compact single-row layout, Approve / Active stage / Reject together.
- Medium desktop/tablet: collapse distant stages into count chips; preserve inline action proximity to active stage.
- Narrow/mobile: allow horizontal stepper scrolling or a compact stage summary; use a sticky action region when needed to maintain minimum touch targets, even if the strict desktop single-row arrangement cannot fit. Do not clip or hide a permitted decision.
- The history drawer overlays page content rather than permanently reducing the payroll table width; close or replace any conflicting record details drawer.

**UI states:** loading skeleton; no workflow; no current task; actionable; read-only; parallel tasks; returned/reopened; completed; rejected; error/stale state. On terminal workflows hide action buttons and show outcome with history access.

### 3.2 ApprovalHistoryDrawer
RTL: drawer opens from the logical start side (right for RTL), unless occupied by a different details drawer; only one primary drawer is open at a time. Suggested desktop width 480–560px; mobile full-screen sheet.
- Workflow instance ID, initiated by/on, overall status and current step.
- Full stage timeline, including all historical attempts, rework cycles, skipped stages and future planned stages.
- For each stage: stage title/number, status, assignee(s), decision rule (any-one/all/quorum), assigned/completed times, action actor, comment, attachments and delegation/escalation events.
- Distinguish planned stages from instantiated tasks; do not pretend future assignees or dates are known if unresolved.
- Read-only access to prior-stage details subject to permissions; link to document/attachment viewers through secure endpoints.

### 3.3 DecisionDialog
On Approve/Reject/Return, show a confirmation dialog with record title/ID, current step, action, and any downstream effect if available.
- Reject and Return require a reason. Approve comment is optional unless configured by policy.
- Return requires choosing an allowed target step if multiple are configured.
- For high-impact workflows, require explicit acknowledgement and/or step-up authentication if configured.
- Prevent duplicate submission; display progress, success, conflict and retry states.

## 4. State model
Workflow statuses: NotStarted, InProgress, Approved, Rejected, Returned, Cancelled, Suspended, Completed.
Stage statuses: Pending, Active, Approved, Rejected, Returned, Skipped, Cancelled.
Task statuses: Assigned, Claimed, Completed, Delegated, Expired, Cancelled.
The authoritative state is the workflow backend; the UI does not invent transitions.

## 5. Cross-module integration contract (conceptual, not implementation)
Every module embeds a shared ApprovalWorkspace with inputs: moduleKey, entityType, recordId, displayReference, and optional pageContext.
Backend supplies a permission-filtered ApprovalViewModel containing: instanceId, workflowStatus, stages[], activeTasks[], history[], availableActions[], etag/version, currentUserTaskContext, and links to attachments.
Actions submit instanceId, taskId, decision, reason/comment, optional returnTargetStageId, expectedVersion, and idempotencyKey. The backend validates task ownership, permissions, transition policy, record version, and audit logging transactionally.
Do not couple module data tables to the approval engine database. Integrate through published module contracts/APIs, respecting Modular Monolith boundaries.

## 6. Global design tokens
Follow approved HR Modern SaaS: background #F6F8FC, primary #2563EB, navy sidebar, white cards, restrained borders, IBM Plex Sans Arabic or the project's approved font, RTL-first alignment. Use semantic tokens for success/warning/danger rather than hard-coded colors in business components. The approved global approval bar is a single compact desktop row (56–64px target) with Approve on the visual right of the current stage and Reject on its visual left. Dense data tables retain maximum vertical space. On small screens use a sticky action area when necessary for accessible touch targets.

## 7. Security, accessibility, and performance
- Never trust client-side permissions; authorize every action server-side.
- Record who acted, on which task, when, outcome, comment and before/after state in tamper-resistant audit trails.
- Handle concurrent approval attempts using optimistic concurrency; show 'This task was already processed' and refresh.
- Use semantic buttons, keyboard navigation, visible focus, accessible labels and color-independent status labels.
- Localize Arabic/English labels and timestamps; store UTC and render locale-aware times. Respect LTR for reference codes.
- Fetch summary/stage data lazily as appropriate; paginate long histories and attachments; avoid blocking payroll grids.

## 8. Example scenarios
Payroll: preparation -> HR review -> financial approval -> closing. Approve/Reject/Return appear for authorized financial approver at the active step. All other users can see the permitted timeline.
Leave request: employee submission -> line manager -> HR -> completed. Same shared component, different stage definitions and policies.
Purchase order: requester -> budget owner -> procurement -> finance. Supports parallel sign-offs when configured.

## 9. Acceptance criteria
1. Same visual and interaction contract across modules using GlobalCompactApprovalBar.
2. Approve and Reject appear inline on the same desktop row, visually flanking the active stage (Approve right, Reject left), and only for authorized current-task actors.
2a. Desktop bar targets 56–64px, with no dedicated second action row; large stage counts collapse gracefully.
3. All stages and historical decisions viewable in a drawer, permission-filtered.
4. Reject/Return require reasons and enforce backend rules.
5. Concurrent decisions cannot produce double approvals.
6. RTL, responsive, keyboard and screen-reader support.
7. Stage history accurately represents repeated/reopened stages and parallel approval.
8. No module-specific duplication of approval UI logic.

## 10. AI Agent operating instructions
READ and understand this document first. Inspect the existing frontend framework, component conventions, workflow contracts, permission model, and design tokens. Produce a gap analysis and proposed implementation plan for user review. **DO NOT edit source code, create migrations, install dependencies, or change live workflows without explicit user authorization.** This specification defines UI/UX expectations, not authorization to implement.
