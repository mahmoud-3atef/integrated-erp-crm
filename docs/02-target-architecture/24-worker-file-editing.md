# Editing the worker file (2026-10-25)

The user asked for editing on the worker page, each part with its own permission: the worker's data, the salary and the cost.

## The user's decisions

1. **Synchronisation:** the old system wins. In the parallel phase, the next change of a worker's record in the CRM brings its values back. Editors see this note in the form and under the tabs.
2. **Salary:** both ways.
   - A direct edit, for those holding the permission.
   - A salary change request that goes through approval.
3. **Fields:** every field of the data sections.
   - The exceptions are the project, the status and the work days, which come from the delivery, return and transfer orders (the period ledger).

## Permissions

| Permission | Allows |
|---|---|
| `workforce.workers.edit` | Changing the worker's data. «تعديل» appears on four sections: basic data, job and project, contract, and leave. |
| `workforce.workers.salary_edit` | Changing the salary directly. «تعديل» appears on the salary section. |
| `workforce.salary_changes.request` | Requesting a salary change. «طلب تعديل» appears on the salary section. |
| `workforce.salary_changes.approve` | The default process's approver. |
| `workforce.costs.manage` (existing) | Entering the worker's cost on the cost tab. |

Notes:
- The salary buttons appear only to those who already see salaries.
- A staff file (company staff) stays read-only here; staff have their own employment actions.

## What happens

- **The data** (`PUT /api/v1/workforce/workers/{id}/data`). This covers:
  - the names, the iqama and its expiry, and the nationality;
  - the arrival date, the professions, the supplier and the agent;
  - the contract dates and the leave balances.

  Validation:
  - nationalities and professions must come from their reference lists;
  - an iqama held by another person is refused;
  - the contract's end is computed from its start and months when not given.
- **The salary directly** (`PUT …/salary`). The total is the sum of the parts, and no part may be below zero.
- **A salary change** (`POST …/salary-changes`):
  - it is numbered `SAL-{YYYY}-{N:5}`;
  - it keeps the salary before it;
  - it goes to the process «اعتماد تعديل رواتب العمالة» (screen `workforce.salary_change`). By default this is one approval stage whose code «تطبيق الراتب الجديد على ملف العامل» puts the new salary on the file;
  - returned or rejected, the file stays unchanged;
  - a worker can have only one change in approval at a time.
- **The change's page** (`/workforce/salary-changes/{id}`) shows:
  - the shared approval bar;
  - the effective date, the difference and the reason;
  - a before/after table.

  The worker's salary section lists the changes with their status.
- **Audit:** every save goes through the audit log (who, when, before and after).

## Deployment

- **Migration:** `WorkerSalaryChange` adds the table `workforce.salary_change` with its row-level security policy. `Deploy-Erp.ps1` applies it.
- **Roles:** the four new permissions are given to roles from the roles page.
