// GOSI and Saudization (src/Modules/Payroll/.../Api/GosiEndpoints.cs).
import { request } from './auth';
import type { GosiCategory } from './staffPayroll';

const base = '/api/v1/payroll/gosi';

export type GosiMemberKind = 'Staff' | 'Worker';
export type GosiFlag = 'not_registered' | 'wage_update';
export type GosiTaskKind = 'Register' | 'WageUpdate' | 'Exclude';
export const gosiTaskKinds: GosiTaskKind[] = ['WageUpdate', 'Register', 'Exclude'];

export interface GosiStatementLine {
  kind: GosiMemberKind;
  personId: string;
  no: string;
  name: string;
  category: GosiCategory | '';
  base: number;
  employee: number;
  employer: number;
  flag: GosiFlag | null;
}

export interface GosiCategorySum {
  category: GosiCategory | '';
  members: number;
  base: number;
  employee: number;
  employer: number;
}

export interface GosiStatement {
  legalEntityId: string;
  period: string;
  members: number;
  staff: number;
  workers: number;
  base: number;
  saudiBase: number;
  nonSaudiBase: number;
  employee: number;
  employer: number;
  hazards: number;
  due: number;
  invoice: number | null;
  invoiceNote: string | null;
  invoiceBy: string | null;
  difference: number | null;
  approvedRuns: number;
  openRuns: number;
  categories: GosiCategorySum[];
  items: GosiStatementLine[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GosiTask {
  id: string;
  kind: GosiTaskKind;
  status: 'Open' | 'Done' | 'Resolved';
  employeeId: string;
  employeeNo: string;
  name: string;
  oldWage: number | null;
  newWage: number | null;
  eventOn: string | null;
  createdAt: string;
  doneOn: string | null;
  doneByName: string | null;
  reference: string | null;
}

export interface GosiTaskClose {
  doneOn: string;
  wage: number | null;
  gosiNo: string | null;
  since: string | null;
  reference: string | null;
}

export interface SaudizationRow {
  legalEntityId: string;
  nameAr: string;
  nameEn: string;
  total: number;
  saudis: number;
  staffSaudis: number;
  workerSaudis: number;
  halfCounted: number;
  counted: number;
  percent: number;
  requiredPercent: number | null;
  needed: number;
  below: boolean;
}

export interface SaudizationTarget {
  legalEntityId: string;
  nameAr: string | null;
  nameEn: string | null;
  requiredPercent: number | null;
}

export interface SaudizationSettings {
  fullWage: number;
  targets: SaudizationTarget[];
}

export interface GosiStatementQuery {
  legalEntityId: string;
  period: string;
  search?: string;
  kind?: '' | GosiMemberKind | 'flags';
  page: number;
  pageSize: number;
}

export const gosiApi = {
  statement: (q: GosiStatementQuery) => {
    const p = new URLSearchParams({ legalEntityId: q.legalEntityId, period: q.period, page: String(q.page), pageSize: String(q.pageSize) });
    if (q.search) p.set('search', q.search);
    if (q.kind) p.set('kind', q.kind);
    return request<GosiStatement>('GET', `${base}/statement?${p.toString()}`);
  },
  saveInvoice: (input: { legalEntityId: string; period: string; amount: number; note: string | null }) => request<void>('PUT', `${base}/invoices`, input),
  tasks: (status: 'open' | 'done') => request<GosiTask[]>('GET', `${base}/tasks?status=${status}`),
  closeTask: (id: string, input: GosiTaskClose) => request<void>('POST', `${base}/tasks/${id}/close`, input),
  saudization: () => request<SaudizationRow[]>('GET', `${base}/saudization`),
  saudizationSettings: () => request<SaudizationSettings>('GET', `${base}/saudization/settings`),
  saveSaudizationSettings: (input: SaudizationSettings) => request<void>('PUT', `${base}/saudization/settings`, input),
};
