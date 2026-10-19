// The company workers' payroll runs (src/Modules/Payroll/.../Api/PayrollEndpoints.cs).
import { request } from './auth';
import type { ApprovalStatus } from './workflow';

export type PayrollStatus = 'Draft' | 'InApproval' | 'Returned' | 'Approved';
export type PayrollExclusionKind = 'TimesheetNotApproved' | 'NoTimesheet' | 'PaidElsewhere' | 'NetNotPositive';
export const payrollNotes = ['absence', 'joined', 'left', 'multi_project', 'salary_split', 'late', 'net_not_positive'] as const;
export type PayrollNote = (typeof payrollNotes)[number];

export interface PayrollRunItem {
  id: string;
  runNo: string;
  group: string;
  legalEntityId: string;
  legalEntityName: string;
  from: string;
  to: string;
  status: PayrollStatus;
  awaitingApproval: boolean;
  workers: number;
  excluded: number;
  net: number;
  createdAt: string;
  approvedAt: string | null;
}

export interface PayrollTotals {
  workers: number;
  excluded: number;
  paidDays: number;
  base: number;
  housing: number;
  food: number;
  transport: number;
  otherAllowances: number;
  overtime: number;
  additions: number;
  allowances: number;
  deductions: number;
  net: number;
}

export interface PayrollPastRun {
  id: string;
  runNo: string;
  from: string;
  to: string;
  totals: PayrollTotals;
}

export interface PayrollRun {
  id: string;
  runNo: string;
  group: string;
  legalEntityId: string;
  legalEntityName: string;
  from: string;
  to: string;
  status: PayrollStatus;
  awaitingApproval: boolean;
  canEdit: boolean;
  canDelete: boolean;
  createdAt: string;
  createdByName: string;
  calculatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  lastComment: string | null;
  totals: PayrollTotals;
  previous: PayrollPastRun | null;
  trend: PayrollPastRun[];
  coverage: { eligible: number; paid: number; timesheetNotApproved: number; noTimesheet: number; paidElsewhere: number; netNotPositive: number };
  projects: { projectCrmId: string; projectName: string; workers: number; net: number }[];
  notes: Partial<Record<PayrollNote, number>>;
  approval: ApprovalStatus | null;
}

export interface PayrollLine {
  id: string;
  workerId: string;
  workerNo: string;
  name: string;
  professionCode: string | null;
  professionAr: string | null;
  professionEn: string | null;
  statusAr: string | null;
  statusEn: string | null;
  projectCrmId: string;
  projectName: string;
  projects: number;
  monthlySalary: number;
  paidDays: number;
  absenceDays: number;
  base: number;
  housing: number;
  food: number;
  transport: number;
  otherAllowances: number;
  overtime: number;
  additions: number;
  allowances: number;
  deductions: number;
  net: number;
  notes: PayrollNote[];
}

export type PayrollSums = Omit<PayrollTotals, 'excluded'>;

export interface PayrollLinePage {
  items: PayrollLine[];
  total: number;
  page: number;
  pageSize: number;
  sums: PayrollSums;
}

export interface PayrollSource {
  timesheetLineId: string;
  timesheetId: string;
  timesheetNo: string;
  projectCrmId: string;
  projectName: string;
  lineFrom: string;
  lineTo: string;
  workDays: number;
  dayDivisor: number;
  absenceDays: number;
  paySalary: number;
  salaryPart: number;
  overtime: number;
  overtimeHours: number;
  clientAdditions: number;
  clientDeductions: number;
  customerLoans: number;
  internalAdditions: number;
  internalDeductions: number;
  net: number;
}

export interface PayrollLineDetail {
  line: PayrollLine;
  clientAdditions: number;
  internalAdditions: number;
  clientDeductions: number;
  customerLoans: number;
  internalDeductions: number;
  sources: PayrollSource[];
}

export interface PayrollExclusion {
  id: string;
  kind: PayrollExclusionKind;
  workerId: string;
  workerNo: string;
  name: string;
  projectName: string | null;
  reference: string | null;
}

export interface SponsorLink {
  sponsor: string;
  legalEntityId: string | null;
  legalEntityName: string | null;
}

export interface LineQuery {
  search?: string;
  note?: string;
  project?: string;
  sort?: string;
  desc?: boolean;
  page?: number;
  pageSize?: number;
}

const base = '/api/v1/payroll';

const query = (q: LineQuery) => {
  const p = new URLSearchParams();
  if (q.search?.trim()) p.set('search', q.search.trim());
  if (q.note) p.set('note', q.note);
  if (q.project) p.set('project', q.project);
  if (q.sort) p.set('sort', q.sort);
  if (q.desc) p.set('desc', 'true');
  if (q.page) p.set('page', String(q.page));
  if (q.pageSize) p.set('pageSize', String(q.pageSize));
  return p.toString();
};

export const payrollApi = {
  runs: (legalEntityId?: string) => request<PayrollRunItem[]>('GET', `${base}/runs${legalEntityId ? `?legalEntityId=${legalEntityId}` : ''}`),
  nextPeriod: (legalEntityId: string) => request<{ from: string; to: string }>('GET', `${base}/runs/next-period?legalEntityId=${legalEntityId}`),
  create: (input: { legalEntityId: string; from: string; to: string }) => request<{ id: string }>('POST', `${base}/runs`, input),
  get: (id: string) => request<PayrollRun>('GET', `${base}/runs/${id}`),
  lines: (id: string, q: LineQuery) => request<PayrollLinePage>('GET', `${base}/runs/${id}/lines?${query(q)}`),
  line: (id: string, lineId: string) => request<PayrollLineDetail>('GET', `${base}/runs/${id}/lines/${lineId}`),
  exclusions: (id: string) => request<PayrollExclusion[]>('GET', `${base}/runs/${id}/exclusions`),
  excelUrl: (id: string, q: LineQuery) => `${base}/runs/${id}/excel?${query({ ...q, page: undefined, pageSize: undefined })}`,
  recalculate: (id: string) => request<void>('POST', `${base}/runs/${id}/recalculate`),
  submit: (id: string) => request<void>('POST', `${base}/runs/${id}/submit`),
  remove: (id: string) => request<void>('DELETE', `${base}/runs/${id}`),
  sponsors: () => request<SponsorLink[]>('GET', `${base}/sponsors`),
  linkSponsors: (links: { sponsor: string; legalEntityId: string | null }[]) => request<void>('PUT', `${base}/sponsors`, links),
};
