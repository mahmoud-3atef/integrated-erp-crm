import { request } from './auth';
import type { ApprovalStatus } from './workflow';

// The settlements (src/Modules/Payroll/.../Api/SettlementEndpoints.cs, docs/03-migration-plan/18): a vacation paid in
// advance or the end of the service. Every figure comes from the server; the page never adds them up.

export type SettlementKind = 'Vacation' | 'EndOfService';
export type SettlementParty = 'Staff' | 'Worker';
export type SettlementStatus = 'Draft' | 'InApproval' | 'Returned' | 'Approved' | 'Paid' | 'Cancelled';
export const endReasons = ['ContractEnd', 'EmployerTermination', 'Resignation', 'ForceMajeure', 'Death', 'Probation', 'Article80'] as const;
export type EndReason = (typeof endReasons)[number];

export interface SettlementItem {
  id: string;
  settlementNo: string;
  kind: SettlementKind;
  party: SettlementParty;
  personId: string;
  personNo: string;
  name: string;
  reason: EndReason | null;
  leaveFrom: string | null;
  lastDay: string;
  serviceYears: number;
  totalAdditions: number;
  totalDeductions: number;
  net: number;
  status: SettlementStatus;
  awaitingApproval: boolean;
  createdAt: string;
}

export interface SettlementCounts {
  drafts: number;
  inApproval: number;
  oldestInApproval: string | null;
  approved: number;
  approvedNet: number;
  paidThisMonth: number;
  paidThisMonthNet: number;
  staff: number;
  workers: number;
}

export interface SettlementList {
  counts: SettlementCounts;
  total: number;
  items: SettlementItem[];
}

export interface SettlementLine {
  lineNo: number;
  side: 'Addition' | 'Deduction';
  code: string;
  days: number;
  rate: number;
  amount: number;
  reference: string | null;
  sourcePeriod: string | null;
}

export interface SettlementDetail {
  id: string;
  settlementNo: string;
  kind: SettlementKind;
  party: SettlementParty;
  personId: string;
  personNo: string;
  name: string;
  departmentAr: string | null;
  departmentEn: string | null;
  jobTitleAr: string | null;
  jobTitleEn: string | null;
  reason: EndReason | null;
  term: 'Indefinite' | 'Fixed';
  contractEndsOn: string | null;
  leaveRequestId: string | null;
  leaveRequestNo: string | null;
  leaveFrom: string | null;
  leaveTo: string | null;
  hireDate: string;
  lastDay: string;
  period: string;
  wage: number;
  unpaidFrom: string | null;
  unpaidDays: number;
  serviceDays: number;
  excludedDays: number;
  serviceYears: number;
  leaveDays: number;
  awardFull: number;
  awardFactor: number;
  deductFullAdvance: boolean;
  otherAdditions: number;
  custody: number;
  otherDeductions: number;
  notes: string | null;
  totalAdditions: number;
  totalDeductions: number;
  net: number;
  status: SettlementStatus;
  awaitingApproval: boolean;
  canEdit: boolean;
  canPay: boolean;
  createdAt: string;
  createdByName: string;
  calculatedAt: string;
  approvedAt: string | null;
  approvedByName: string | null;
  lastComment: string | null;
  paidOn: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  paidByName: string | null;
  lines: SettlementLine[];
  approval: ApprovalStatus | null;
}

export interface SettlementLeave {
  requestId: string;
  requestNo: string;
  employeeId: string;
  employeeNo: string;
  name: string;
  from: string;
  to: string;
  days: number;
}

/** A worker on the company's sponsorship (the dialog's search). */
export interface SettlementWorker {
  id: string;
  workerNo: string;
  name: string;
  sponsor: string | null;
  placement: string;
  projectName: string | null;
}

export interface SettlementQuery {
  party?: SettlementParty;
  kind?: SettlementKind | '';
  status?: string;
  search?: string;
  sort?: string;
  desc?: boolean;
  page: number;
  pageSize: number;
}

export interface SettlementEdit {
  reason: EndReason | null;
  lastDay: string | null;
  term: string | null;
  contractEndsOn: string | null;
  otherAdditions: number;
  custody: number;
  otherDeductions: number;
  deductFullAdvance: boolean;
  notes: string | null;
}

const base = '/api/v1/payroll/settlements';

export const settlementsApi = {
  list: (q: SettlementQuery) => {
    const p = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) });
    if (q.party) p.set('party', q.party);
    if (q.kind) p.set('kind', q.kind);
    if (q.status) p.set('status', q.status);
    if (q.search) p.set('search', q.search);
    if (q.sort) p.set('sort', q.sort);
    if (q.desc !== undefined) p.set('desc', String(q.desc));
    return request<SettlementList>('GET', `${base}?${p.toString()}`);
  },
  get: (id: string) => request<SettlementDetail>('GET', `${base}/${id}`),
  leaves: () => request<SettlementLeave[]>('GET', `${base}/leaves`),
  workers: (search: string) => request<SettlementWorker[]>('GET', `${base}/workers?search=${encodeURIComponent(search)}`),
  create: (input: {
    kind: SettlementKind;
    party?: SettlementParty;
    leaveRequestId?: string;
    employeeId?: string;
    reason?: EndReason;
    lastDay?: string;
    term?: string;
    contractEndsOn?: string | null;
    leaveFrom?: string;
    leaveTo?: string;
  }) =>
    request<{ id: string }>('POST', base, input),
  update: (id: string, input: SettlementEdit) => request<void>('PUT', `${base}/${id}`, input),
  submit: (id: string) => request<void>('POST', `${base}/${id}/submit`),
  pay: (id: string, input: { paidOn: string; method: string; reference: string | null }) => request<void>('POST', `${base}/${id}/pay`, input),
  cancel: (id: string, comment: string | null) => request<void>('POST', `${base}/${id}/cancel`, { comment }),
};
