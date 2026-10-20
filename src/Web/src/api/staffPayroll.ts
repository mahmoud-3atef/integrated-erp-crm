// The staff payroll runs (src/Modules/Payroll/.../Api/StaffPayrollEndpoints.cs).
import { request } from './auth';
import type { PayrollStatus } from './payroll';
import type { ApprovalStatus } from './workflow';

export const staffNotes = ['joined', 'left', 'no_iban', 'no_attendance', 'salary_changed', 'deferred', 'above_cap', 'no_gosi_rate', 'net_not_positive'] as const;
export type StaffNote = (typeof staffNotes)[number];
export type StaffItemKind = 'Installment' | 'PenaltyDays' | 'PenaltyAmount' | 'Suspension' | 'Other' | 'Addition' | 'Deduction';
export type GosiCategory = 'SaudiLegacy' | 'SaudiNew' | 'NonSaudi';
export const gosiCategories: GosiCategory[] = ['SaudiLegacy', 'SaudiNew', 'NonSaudi'];
export type LateMode = 'None' | 'PerMinute';

export interface StaffTotals {
  employees: number;
  noSalary: number;
  withoutIban: number;
  joiners: number;
  leavers: number;
  paidDays: number;
  basic: number;
  housing: number;
  otherAllowances: number;
  overtime: number;
  additions: number;
  allowances: number;
  absence: number;
  penalties: number;
  advances: number;
  otherDeductions: number;
  gosiEmployee: number;
  gosiEmployer: number;
  deductions: number;
  deferred: number;
  net: number;
}

export interface StaffRunItem {
  id: string;
  runNo: string;
  legalEntityId: string;
  legalEntityName: string;
  period: string;
  from: string;
  to: string;
  status: PayrollStatus;
  awaitingApproval: boolean;
  employees: number;
  net: number;
  createdAt: string;
  approvedAt: string | null;
}

export interface StaffRun {
  id: string;
  runNo: string;
  legalEntityId: string;
  legalEntityName: string;
  period: string;
  from: string;
  to: string;
  status: PayrollStatus;
  awaitingApproval: boolean;
  canEdit: boolean;
  createdAt: string;
  createdByName: string;
  calculatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  lastComment: string | null;
  totals: StaffTotals;
  previous: { id: string; runNo: string; period: string; totals: StaffTotals } | null;
  trend: { id: string; runNo: string; period: string; totals: StaffTotals }[];
  departments: { departmentId: string | null; nameAr: string | null; nameEn: string | null; employees: number; gross: number; deductions: number; net: number; gosiEmployer: number }[];
  gosi: { category: GosiCategory; employees: number; base: number; employee: number; employer: number }[];
  notes: Partial<Record<StaffNote, number>>;
  approval: ApprovalStatus | null;
}

export interface StaffLine {
  id: string;
  employeeId: string;
  employeeNo: string;
  name: string;
  departmentAr: string | null;
  departmentEn: string | null;
  jobTitleAr: string | null;
  jobTitleEn: string | null;
  monthlySalary: number;
  serviceDays: number;
  paidDays: number;
  basic: number;
  housing: number;
  otherAllowances: number;
  overtime: number;
  additions: number;
  allowances: number;
  absence: number;
  penalties: number;
  advances: number;
  otherDeductions: number;
  gosiEmployee: number;
  deductions: number;
  deferred: number;
  net: number;
  notes: StaffNote[];
}

export interface StaffLineSums {
  employees: number;
  basic: number;
  housing: number;
  otherAllowances: number;
  overtime: number;
  allowances: number;
  absence: number;
  penalties: number;
  advances: number;
  otherDeductions: number;
  gosiEmployee: number;
  deductions: number;
  net: number;
}

export interface StaffLinePage {
  items: StaffLine[];
  total: number;
  page: number;
  pageSize: number;
  sums: StaffLineSums;
}

export interface StaffItem {
  id: string;
  kind: StaffItemKind;
  sourceId: string;
  reference: string;
  description: string;
  period: string | null;
  days: number;
  due: number;
  deducted: number;
  deferred: boolean;
  aboveCap: boolean;
}

export interface StaffLineDetail {
  line: StaffLine;
  monthlyBasic: number;
  unpaidDays: number;
  absenceOnly: number;
  lateMinutes: number;
  late: number;
  sickPartDays: number;
  sickPart: number;
  overtimeHours: number;
  gross: number;
  gosiCategory: GosiCategory;
  gosiBase: number;
  gosiEmployer: number;
  capLimit: number;
  bankName: string | null;
  iban: string | null;
  items: StaffItem[];
  adjustments: { id: string; kind: 'Addition' | 'Deduction'; amount: number; reason: string; createdByName: string; createdAt: string }[];
}

export interface StaffDeferred {
  lineId: string;
  employeeId: string;
  employeeNo: string;
  name: string;
  kind: StaffItemKind;
  reference: string;
  description: string;
  due: number;
  deducted: number;
  deferred: number;
}

export interface StaffRunChecks {
  period: string;
  from: string | null;
  to: string | null;
  attendanceClosed: boolean;
  employees: number;
  noSalary: number;
  withoutIban: number;
  withoutRegistration: number;
  existingRunNo: string | null;
  earlierOpenRunNo: string | null;
}

export interface PaySettings {
  overtimePremiumPercent: number;
  hoursPerDay: number;
  lateMode: LateMode;
  monthlyCapPercent: number;
}

export interface GosiRate {
  id: string;
  category: GosiCategory;
  effectiveFrom: string;
  employeePercent: number;
  employerPercent: number;
  minBase: number;
  maxBase: number;
}

export type GosiRateInput = Omit<GosiRate, 'id'>;

export interface StaffEmployeeRun {
  runId: string;
  lineId: string;
  runNo: string;
  period: string;
  status: PayrollStatus;
  paidDays: number;
  gross: number;
  deductions: number;
  net: number;
}

export interface StaffLineQuery {
  search?: string;
  department?: string;
  note?: string;
  sort?: string;
  desc?: boolean;
  page?: number;
  pageSize?: number;
}

const base = '/api/v1/payroll/staff';
const query = (q: StaffLineQuery) => {
  const p = new URLSearchParams();
  if (q.search?.trim()) p.set('search', q.search.trim());
  if (q.department) p.set('department', q.department);
  if (q.note) p.set('note', q.note);
  if (q.sort) p.set('sort', q.sort);
  if (q.desc) p.set('desc', 'true');
  if (q.page) p.set('page', String(q.page));
  if (q.pageSize) p.set('pageSize', String(q.pageSize));
  return p.toString();
};

export const staffPayrollApi = {
  checks: (legalEntityId: string, period: string) => request<StaffRunChecks>('GET', `${base}/checks?legalEntityId=${legalEntityId}&period=${period}`),
  runs: (q: { legalEntityId?: string; tab?: string } = {}) => {
    const p = new URLSearchParams();
    if (q.legalEntityId) p.set('legalEntityId', q.legalEntityId);
    if (q.tab) p.set('tab', q.tab);
    return request<StaffRunItem[]>('GET', `${base}/runs?${p.toString()}`);
  },
  create: (input: { legalEntityId: string; period: string }) => request<{ id: string }>('POST', `${base}/runs`, input),
  get: (id: string) => request<StaffRun>('GET', `${base}/runs/${id}`),
  lines: (id: string, q: StaffLineQuery) => request<StaffLinePage>('GET', `${base}/runs/${id}/lines?${query(q)}`),
  line: (id: string, lineId: string) => request<StaffLineDetail>('GET', `${base}/runs/${id}/lines/${lineId}`),
  deferred: (id: string) => request<StaffDeferred[]>('GET', `${base}/runs/${id}/deferred`),
  excelUrl: (id: string, q: StaffLineQuery) => `${base}/runs/${id}/excel?${query({ ...q, page: undefined, pageSize: undefined })}`,
  recalculate: (id: string) => request<void>('POST', `${base}/runs/${id}/recalculate`),
  submit: (id: string) => request<void>('POST', `${base}/runs/${id}/submit`),
  remove: (id: string) => request<void>('DELETE', `${base}/runs/${id}`),
  addAdjustment: (id: string, input: { employeeId: string; kind: 'Addition' | 'Deduction'; amount: number; reason: string }) => request<void>('POST', `${base}/runs/${id}/adjustments`, input),
  removeAdjustment: (id: string, adjustmentId: string) => request<void>('DELETE', `${base}/runs/${id}/adjustments/${adjustmentId}`),
  employeeLines: (employeeId: string) => request<StaffEmployeeRun[]>('GET', `${base}/employees/${employeeId}/lines`),
  settings: () => request<PaySettings>('GET', `${base}/settings`),
  saveSettings: (input: PaySettings) => request<void>('PUT', `${base}/settings`, input),
  gosiRates: () => request<GosiRate[]>('GET', `${base}/gosi-rates`),
  saveGosiRate: (id: string | null, input: GosiRateInput) => (id ? request<{ id: string }>('PUT', `${base}/gosi-rates/${id}`, input) : request<{ id: string }>('POST', `${base}/gosi-rates`, input)),
};
