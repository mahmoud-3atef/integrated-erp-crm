// The company's staff and organisation (src/Modules/Staff/.../Api/StaffEndpoints.cs).
import { request, upload } from './auth';
import type { ApprovalStatus } from './workflow';

export type StaffStatus = 'Active' | 'Probation' | 'Suspended' | 'Left';
export const staffStatuses: StaffStatus[] = ['Active', 'Probation', 'Suspended', 'Left'];
export type StaffTab = 'all' | 'active' | 'probation' | 'ending' | 'incomplete' | 'left';

export interface StaffRow {
  id: string;
  employeeNo: string;
  name: string;
  nameEn: string;
  nationalityAr: string | null;
  nationalityEn: string | null;
  departmentAr: string | null;
  departmentEn: string | null;
  jobTitleAr: string | null;
  jobTitleEn: string | null;
  status: StaffStatus;
  legacyStatusAr: string | null;
  hireDate: string | null;
  probationEndsOn: string | null;
  contractEndsOn: string | null;
  completeness: number;
}

export interface StaffPage {
  items: StaffRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StaffKpis {
  employees: number;
  active: number;
  probation: number;
  suspended: number;
  left: number;
  probationEndingIn30: number;
  contractsEndingIn90: number;
  contractsEndingIn60: number;
  contractsEndingIn30: number;
  incomplete: number;
  vacancies: number;
  departmentsWithVacancies: number;
}

export interface NamedRef {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface Salary {
  id: string;
  effectiveFrom: string;
  basic: number;
  housing: number;
  food: number;
  transport: number;
  mobile: number;
  project: number;
  other: number;
  total: number;
  source: 'OldSystem' | 'Hire' | 'Change';
  reason: string | null;
  createdByName: string;
  createdAt: string;
}

export type SalaryValues = Pick<Salary, 'basic' | 'housing' | 'food' | 'transport' | 'mobile' | 'project' | 'other'>;

export interface StaffPayDetails {
  bankName: string | null;
  iban: string | null;
  accountHolder: string | null;
  gosiSince: string | null;
}

export interface BulkUpdateResult {
  rows: number;
  employees: number;
  changes: number;
  rejected: number;
  applied: boolean;
  items: { row: number; employeeId: string; employeeNo: string; name: string; field: string; from: string | null; to: string | null }[];
  problems: { row: number; employeeNo: string | null; field: string | null; problem: string; value: string | null }[];
}

export interface StaffProfile {
  id: string;
  employeeNo: string;
  nameAr: string | null;
  nameEn: string;
  idNumber: string | null;
  nationalityCode: string | null;
  nationalityAr: string | null;
  nationalityEn: string | null;
  birthDate: string | null;
  mobile: string | null;
  email: string | null;
  gosiNo: string | null;
  status: StaffStatus;
  legacyStatusAr: string | null;
  legacyStatusEn: string | null;
  sponsor: string | null;
  hireDate: string | null;
  probationEndsOn: string | null;
  legalEntity: NamedRef | null;
  department: NamedRef | null;
  positionId: string | null;
  jobTitle: NamedRef | null;
  grade: string | null;
  manager: NamedRef | null;
  contractStartsOn: string | null;
  contractMonths: number | null;
  contractEndsOn: string | null;
  annualLeaveDays: number | null;
  leaveBalance: number | null;
  leaveConsumed: number | null;
  leaveOldConsumed: number | null;
  leaveRemaining: number | null;
  salary: Salary | null;
  salaryChanges: number;
  completeness: number;
  missing: string[];
  createdByName: string;
  createdAt: string;
  canEdit: boolean;
  canSeeSalary: boolean;
  canChangeSalary: boolean;
  payDetails: StaffPayDetails | null;
  canManageBank: boolean;
}

export interface StaffEvent {
  kind: 'Created' | 'Changed' | 'Salary';
  at: string;
  by: string;
  changes: Record<string, { old?: unknown; new?: unknown }> | null;
  salary: Salary | null;
}

export interface Position {
  id: string;
  departmentId: string;
  jobTitleId: string;
  jobTitleAr: string;
  jobTitleEn: string;
  gradeId: string | null;
  grade: string | null;
  reportsToId: string | null;
  seats: number;
  isActive: boolean;
  occupants: NamedRef[];
}

export interface Department {
  id: string;
  parentId: string | null;
  nameAr: string;
  nameEn: string;
  costCenter: string | null;
  manager: NamedRef | null;
  sortOrder: number;
  isActive: boolean;
  employees: number;
  positions: Position[];
}

export interface Structure {
  departments: Department[];
  employees: number;
  unassigned: number;
  vacancies: number;
}

export interface JobTitle {
  id: string;
  nameAr: string;
  nameEn: string;
  occupationCode: string | null;
  isActive: boolean;
  positions: number;
}

export interface Grade {
  id: string;
  code: string;
  nameAr: string;
  minBasic: number | null;
  maxBasic: number | null;
  isActive: boolean;
  positions: number;
}

export interface Catalog {
  jobTitles: JobTitle[];
  grades: Grade[];
}

export interface StaffQuery {
  search?: string;
  tab?: StaffTab;
  departmentId?: string;
  legalEntityId?: string;
  sort?: string;
  desc?: boolean;
  page?: number;
  pageSize?: number;
}

export const actionKinds = ['Promotion', 'Transfer', 'SalaryChange', 'Acting', 'ConfirmProbation', 'ExtendProbation', 'EndProbation', 'RenewContract', 'NotRenew'] as const;
export type ActionKind = (typeof actionKinds)[number];
export type ActionStatus = 'Draft' | 'InApproval' | 'Returned' | 'Rejected' | 'Applied';

export interface ActionRow {
  id: string;
  actionNo: string;
  employeeId: string;
  employeeName: string;
  kind: ActionKind;
  effectiveFrom: string;
  status: ActionStatus;
  createdByName: string;
  createdAt: string;
  appliedAt: string | null;
}

export interface Place {
  legalEntity: NamedRef | null;
  department: NamedRef | null;
  jobTitle: NamedRef | null;
  grade: string | null;
}

export interface StaffActionDetail {
  id: string;
  actionNo: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  kind: ActionKind;
  effectiveFrom: string;
  reason: string;
  status: ActionStatus;
  awaitingApproval: boolean;
  before: Place;
  after: Place;
  oldSalaryTotal: number | null;
  newSalary: SalaryValues | null;
  newSalaryTotal: number | null;
  actingAllowance: number | null;
  actingUntil: string | null;
  oldProbationEndsOn: string | null;
  newProbationEndsOn: string | null;
  oldContractEndsOn: string | null;
  newContractKind: 'Fixed' | 'Open' | null;
  newContractMonths: number | null;
  newContractEndsOn: string | null;
  createdByName: string;
  createdAt: string;
  appliedAt: string | null;
  lastComment: string | null;
  canResubmit: boolean;
  canSeeSalary: boolean;
  approval: ApprovalStatus | null;
}

export interface Contract {
  id: string;
  kind: 'Fixed' | 'Open';
  startsOn: string;
  months: number | null;
  endsOn: string | null;
  probationDays: number;
  noticeDays: number;
  status: 'Active' | 'Renewed' | 'Ended';
  actionId: string | null;
  notes: string | null;
  createdByName: string;
  createdAt: string;
}

export interface ActionInput {
  kind: ActionKind;
  effectiveFrom: string;
  reason: string;
  newLegalEntityId: string | null;
  newDepartmentId: string | null;
  newPositionId: string | null;
  newSalary: SalaryValues | null;
  actingAllowance: number | null;
  actingUntil: string | null;
  newProbationEndsOn: string | null;
  newContractKind: 'Fixed' | 'Open' | null;
  newContractMonths: number | null;
  newContractEndsOn: string | null;
}

const base = '/api/v1/staff';

const qs = (q: StaffQuery) => {
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== false && v !== null) p.set(k, String(v));
  });
  return p.toString();
};

export const staffApi = {
  employees: (q: StaffQuery) => request<StaffPage>('GET', `${base}/employees?${qs(q)}`),
  kpis: () => request<StaffKpis>('GET', `${base}/employees/kpis`),
  userLinks: () => request<{ userId: string; employeeId: string; nameAr: string; nameEn: string }[]>('GET', `${base}/user-links`),
  linkUser: (userId: string, employeeId: string | null) => request<void>('PUT', `${base}/user-links/${userId}`, { employeeId }),
  pick: (search: string) => request<NamedRef[]>('GET', `${base}/employees/pick?search=${encodeURIComponent(search)}`),
  profile: (id: string) => request<StaffProfile>('GET', `${base}/employees/${id}`),
  history: (id: string) => request<StaffEvent[]>('GET', `${base}/employees/${id}/history`),
  hire: (input: { nameAr: string | null; nameEn: string; hireDate: string; probationDays: number; legalEntityId: string | null; departmentId: string | null; positionId: string | null; salary: SalaryValues }) =>
    request<{ id: string }>('POST', `${base}/employees`, input),
  importOld: () => request<{ created: number; updated: number; left: number }>('POST', `${base}/employees/import`),
  setPersonal: (id: string, input: { nameAr: string | null; nameEn: string; idNumber: string | null; nationalityCode: string | null; birthDate: string | null; mobile: string | null; email: string | null; gosiNo: string | null }) =>
    request<void>('PUT', `${base}/employees/${id}/personal`, input),
  setJob: (id: string, input: { legalEntityId: string | null; departmentId: string | null; positionId: string | null; hireDate: string | null; probationEndsOn: string | null; status: StaffStatus }) =>
    request<void>('PUT', `${base}/employees/${id}/job`, input),
  setContract: (id: string, input: { startsOn: string | null; months: number | null; endsOn: string | null }) => request<void>('PUT', `${base}/employees/${id}/contract`, input),
  changeSalary: (id: string, input: { effectiveFrom: string; salary: SalaryValues; reason: string }) => request<void>('POST', `${base}/employees/${id}/salary`, input),
  setPayDetails: (id: string, input: StaffPayDetails) => request<void>('PUT', `${base}/employees/${id}/pay-details`, input),
  updateTemplateUrl: (lang: string) => `${base}/employees/update-template?lang=${lang}`,
  bulkUpdate: (file: File, apply: boolean) => {
    const form = new FormData();
    form.append('file', file);
    return upload<BulkUpdateResult>(`${base}/employees/bulk-update?apply=${apply}`, form);
  },
  nationalities: () => request<{ code: string; nameAr: string; nameEn: string }[]>('GET', `${base}/nationalities`),
  structure: () => request<Structure>('GET', `${base}/structure`),
  contracts: (id: string) => request<Contract[]>('GET', `${base}/employees/${id}/contracts`),
  requestAction: (id: string, input: ActionInput) => request<{ id: string }>('POST', `${base}/employees/${id}/actions`, input),
  actions: (q: { employeeId?: string; status?: string }) => request<ActionRow[]>('GET', `${base}/actions?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString()}`),
  action: (id: string) => request<StaffActionDetail>('GET', `${base}/actions/${id}`),
  resubmit: (id: string) => request<void>('POST', `${base}/actions/${id}/resubmit`),
  catalog: () => request<Catalog>('GET', `${base}/catalog`),
  saveDepartment: (id: string | null, input: { nameAr: string; nameEn: string | null; parentId: string | null; costCenter: string | null; managerId: string | null; sortOrder: number; isActive: boolean }) =>
    request<{ id: string }>(id ? 'PUT' : 'POST', id ? `${base}/departments/${id}` : `${base}/departments`, input),
  deleteDepartment: (id: string) => request<void>('DELETE', `${base}/departments/${id}`),
  savePosition: (id: string | null, input: { departmentId: string; jobTitleId: string; gradeId: string | null; reportsToId: string | null; seats: number; isActive: boolean }) =>
    request<{ id: string }>(id ? 'PUT' : 'POST', id ? `${base}/positions/${id}` : `${base}/positions`, input),
  deletePosition: (id: string) => request<void>('DELETE', `${base}/positions/${id}`),
  saveJobTitle: (id: string | null, input: { nameAr: string; nameEn: string | null; occupationCode: string | null; isActive: boolean }) =>
    request<{ id: string }>(id ? 'PUT' : 'POST', id ? `${base}/job-titles/${id}` : `${base}/job-titles`, input),
  saveGrade: (id: string | null, input: { code: string; nameAr: string; minBasic: number | null; maxBasic: number | null; isActive: boolean }) =>
    request<{ id: string }>(id ? 'PUT' : 'POST', id ? `${base}/grades/${id}` : `${base}/grades`, input),
};
