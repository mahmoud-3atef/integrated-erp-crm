# Workflow Engine — Screen-Independent Design (Dynamics CRM–class)
Version: 0.1 draft — 2026-10-22
Status: Proposal for approval. Implementation NOT authorized.
Builds on: 16-approval-workflow-ui.md (the approval bar stays as approved), 14-platform-and-technical-architecture.md.

## 1. Why
Today a process belongs to a **screen**. Each screen's adapter declares, by hand, the fields a process can see, the few
related tables it can test, and what it can update. So:
- a related table shows in a condition only where someone wrote it (the transfer order's projects), and «تحديث سجل»
  sees only the record itself;
- every new field or table needs code in the screen's adapter;
- processes can only start when a document is sent for approval.

Goal: one workflow module that knows the system's **tables, fields and links** by itself, independent of any screen or
action, as Dynamics CRM's workflows work on its entity metadata.

## 2. Principles
1. **Metadata, not hand lists.** Tables, fields, types, choices and links come from the modules' EF Core models (every
   module already describes them). A screen is only "an entity + its page + its statuses + its codes".
2. **The owning module stays the owner.** The workflow module reads through the module's read provider and changes data
   only through the module's commands (its domain rules, permissions and audit). It never writes another module's table.
3. **No rule bypass.** No "approve anything", no permission overrides, no direct column writes.
4. **Arabic-first, RTL**, one approval UX (spec 16).
5. **Versioned processes**, an instance runs the version it started on (as today).

## 3. Architecture
```
 Modules (Operations, Staff, Leave, Billing, Payroll, Commercial, Workforce, Identity…)
   │  register their entities  ──►  Entity Catalog (Workflow)  ◄── EF Core IModel of each module
   │  read provider (by id)    ──►  Record Reader  (values of a record and its N:1 chain)
   │  commands (update/create) ◄──  Action Runner   (update, create, assign, status, run code)
   │  domain events (outbox)   ──►  Trigger Dispatcher (create / update of fields / status / scheduled / on demand)
   ▼
 Process Definitions (versions, JSON) ─► Engine (cursor, stages, tasks, decisions) ─► History · Tasks · Notifications
```

### 3.1 Entity catalog
- Each module registers the entities it opens to workflows (e.g. Project, Customer, Contract, Worker, Employee,
  Department, User, DeliveryOrder, TransferOrder, ReturnOrder, WorkerMovement, LeaveRequest, Advance, Penalty,
  Invoice, Receipt, Timesheet, PayrollRun, Settlement, InternalRequest…).
- From EF Core metadata: every scalar property → field (key, Arabic/English label, type: Text, Number, Money, Date,
  Boolean, Choice (enum → options), User, Lookup); every navigation / foreign key → **lookup** to another entity.
- Labels: Arabic/English names come from the module's resource keys (translation files), not hard-coded strings.
- Hidden by default: ids, tenant id, row versions, secrets (bank account numbers, salaries for users without
  `staff.salaries.view`). A module can mark a field `Sensitive` (shown only to permitted designers and never logged).
- **Updatable** fields are declared by the owning module (attribute or fluent `.Workflow().Updatable()`), each mapped
  to a domain command, so «تحديث سجل» lists all fields and enables only these (others shown locked with the reason).

### 3.2 Related tables (lookups)
- N:1 chains from the record, up to **3 levels** (proposal): e.g. TransferOrder → Project → Customer;
  LeaveRequest → Employee → Department → Manager (User).
- Usable in **every step**: conditions, values, update targets (updatable fields only), assignees and recipients
  (any User field on the chain), notification texts.
- 1:N (child rows, e.g. an order's lines) through aggregate fields declared by the module (count, sum, "any line
  where…"), not free joins.

### 3.3 Triggers
| Trigger | Example |
|---|---|
| On submit (today) | Leave request sent for approval |
| On create | A new worker movement is created |
| On update of chosen fields | Project's manager changed; contract end date changed |
| On status change | Invoice becomes Issued |
| Scheduled / recurring | Contract ends in 30 days → notify sales |
| On demand | A user runs a process from the record |
Raised from each module's **outbox** (already present in every module schema), so the engine does not poll tables.

### 3.4 Steps
| Step | Notes |
|---|---|
| Approval stage | as today: assignees (user, role, permission, user field on any related table, manager of…), Any/All/majority, delegation, return target, required fields |
| Condition (if / else if / else) | JsonLogic rules, nested AND/OR groups, dynamic values |
| Wait condition | wait until a rule is true (e.g. "status = Delivered"), with a **timeout** branch |
| Timer / escalation | "not decided in 48h → remind / escalate / auto-return" |
| Update record | the record or a related record; values: fixed, from a field, or a formula |
| Create record | through the owning module's create command (e.g. create a task, an internal request) |
| Assign / change status | through module commands |
| Notify / email | in-app and email; texts with field placeholders from any related table |
| Run code | the module's named actions (today's «تشغيل كود») |
| Child process | start another process on a related record and optionally wait for it |
| Parallel branches | run branches together, continue when all / any end |
| Stop | approved / rejected / canceled |

### 3.5 Values and conditions
- **Conditions** stored as **JsonLogic** (portable): evaluated on the server (.NET) and previewed in the editor (JS)
  with the same result.
- **Dynamic values**: a fixed value, a chosen user, a field of the record or of a related table (same type), or a
  formula (dates: today ± n days; numbers; text concat).
- The editor offers "**Try on a record**": pick a record, see which branch and which approvers the process would take.

## 4. Ready libraries (proposed)
| Need | Library | Licence | Why |
|---|---|---|---|
| Tables & fields | EF Core metadata (`IModel`) | — (in use) | the source of the catalog; no hand lists |
| Conditions & formulas | **JsonLogic** — `JsonLogic` (json-everything, .NET) + `json-logic-js` (web) | MIT | same rules both sides, nested groups, arithmetic/date ops, extensible operators |
| Formulas (alternative) | NCalc | MIT | richer expressions if JsonLogic is not enough |
| Timers, waits, escalations | **Quartz.NET** (SQL Server job store) | Apache-2.0 | durable schedules across restarts, clustering later (cloud) |
| Visual designer | **React Flow** (xyflow) | MIT | process as a diagram next to the step list; RTL-capable custom nodes |
| Record status rules (optional) | Stateless | Apache-2.0 | module-side state machines for allowed transitions |

Evaluated and **not** recommended as the engine:
- **Elsa Workflows 3** (MIT): strongest open .NET engine, but its designer is Blazor (not RTL/Arabic) and it brings its
  own persistence, security and tasks — a second system beside our approvals, tasks and RLS.
- **Workflow Core**: light, but barely maintained.
- **Camunda / Zeebe**: BPMN power, but Java services to run on-premises.
- **Temporal / Dapr Workflow**: workflows as code, not for administrators' designs.
Exact versions and .NET 10 compatibility are verified before adoption.

## 5. Security and data safety
- Designers need `workflow.processes.manage`; sensitive fields need their own view permission to appear.
- Every update/create runs as the module command with the deciding user's identity; the engine's own "system" actor is
  used only for timers and is audited as such.
- No salary, IBAN or national id values in history, logs or notification texts unless the field is permitted.

## 6. Migration of today's processes
- Screens' declared fields map 1:1 to catalog fields (same keys), so published processes keep working.
- The transfer order's relations become catalog lookups; existing "relation.field" rules are converted on load.
- Required codes («تشغيل كود») stay as they are.

## 7. Milestones
1. **Catalog + reader**: catalog from EF Core for all modules; record reader with N:1 chains; screens on it, no behaviour change. Tests: catalog snapshot per module; reading chains; RLS respected.
2. **Editor everywhere**: table → field pickers in conditions, values, update, assignees, recipients, texts, required fields; JsonLogic; "try on a record".
3. **Updatable fields**: per entity, reviewed with the business (one table at a time); update/create through commands.
4. **Triggers & time**: outbox triggers (create / field update / status / scheduled / on demand); waits, timeouts, escalations with Quartz.NET.
5. **More steps**: create record, child process, parallel branches, email.
6. **Visual designer** with React Flow.

## 8. Decisions needed
1. Update step: all fields **shown**, only the module-declared updatable ones **editable** (proposed) — or all editable.
2. Related tables depth: **3 levels** (proposed) — or 1.
3. Approve the library choices in §4.
