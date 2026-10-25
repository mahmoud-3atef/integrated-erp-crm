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

## Adding workers (2026-10-25)

The user asked to add one worker or many. The lists are picked rather than typed, and a sheet is checked before anything is created.

The user's decisions:
- **Numbers:** new workers take the old system's series (`BSS{N:6}`), after the highest number already used. The workers added now are tests only. At the switchover, the last old number is set as the start (Settings › Numbering, sequence «الرقم الوظيفي للعمالة»), and the old system closes.
- **Required:**
  - the English name;
  - the nationality and the profession (from their lists);
  - the supplier or sponsor;
  - the iqama number or the border number;
  - the arrival date;
  - for a worker not on the company's sponsorship (any sponsor other than «Care-Pro …»), the supplier's monthly cost. It becomes the worker's cost card, effective from the arrival date and not before 2025-01-01.

How it works:
- **Permission:** `workforce.workers.create` («إضافة عمالة»).
- **Where:** a button on the workers list opens the dialog.
- **One worker:** a form whose nationality, professions, supplier and cost method are drop-downs. The supplier's cost appears when the supplier is not the company.
- **Many from Excel:**
  1. Download the template (`GET /workers/new/template`). Its drop-down lists come from the system's lists, and the identity columns are text.
  2. Upload it (`POST /workers/new/read`). Every row is checked, and nothing is created.
  3. The table shows each wrong value on its row:
     - a typed nationality that is not in the list, with what was typed shown;
     - a missing cost;
     - an iqama that belongs to someone else, or that is repeated in the sheet;
     - a missing identity number;
     - an arrival date in the future.
  4. Fix it in the table and press «فحص مرة أخرى» (`POST /workers/new/check`), or fix the sheet and upload it again.
  5. «اعتماد وإنشاء» (`POST /workers/new`) is enabled only when every row is clean. It checks everything again, then creates all the rows or none, in one transaction.
- **What is created:** a worker created here is marked `CreatedHere`, and its CRM id is its own id, so the sync never finds, changes or removes it. Its status is «new» until a delivery order places it.
- **Migration:** `WorkerCreatedHere` adds the column `created_here`.

## Adding employees (2026-10-25)

The user asked for the same on the staff page, with an employee's own data. An employee has no sponsor and no border number. What matters is the profession (the position's job title), the nationality, the salary, the department and the position.

- **Permission:** `staff.manage` (the same as the former «موظف جديد», whose dialog this replaces).
- **Required:** each of these is required:
  - the name;
  - the nationality, from its list;
  - the hire date;
  - the commercial registration;
  - the department;
  - the position: one of the department's, with a free seat, counting the rows above it in the same sheet;
  - the basic salary, above zero.
- **Optional:** the Arabic name, the ID or iqama number (refused if another current employee holds it, or if it is repeated in the sheet), the probation days (90 by default, 0 to 180), the allowances, the mobile number and the email.
- **The template:** drop-down lists for the nationality, the registration, the department and the job title. Its hidden «القوائم» sheet lists each department's positions with their free seats.
- **The flow:** the same as for workers:
  1. Read the sheet and check it (`/api/v1/staff/employees/new/read`).
  2. Fix the rows in the table, or in the sheet uploaded again (`…/new/check`).
  3. «اعتماد وإنشاء» (`POST …/employees/new`) creates all the rows or none.
- **Numbers:** they follow the «staff» sequence (Settings › Numbering), skipping any number already held.
