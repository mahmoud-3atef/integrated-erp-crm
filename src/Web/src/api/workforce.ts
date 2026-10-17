// Workers and staff (src/Modules/Workforce/.../Api/WorkforceEndpoints.cs). Read-only in the parallel phase.
import { request } from './auth';

export type Placement = 'Working' | 'New' | 'Housing' | 'Vacation' | 'Suspended' | 'Exited' | 'Absconded' | 'Other';
export type WorkerKind = 'Worker' | 'Staff';

/** Monthly salary (SAR); `project` is what the old screen showed as the project allowance. */
export interface Salary {
  basic: number;
  housing: number;
  food: number;
  transport: number;
  overtime: number;
  other: number;
  project: number;
  hardship: number;
  total: number;
}

export interface WorkerRow {
  id: string;
  workerNo: string;
  name: string;
  kind: WorkerKind;
  placement: Placement;
  crmStatus: number | null;
  statusAr: string | null;
  statusEn: string | null;
  iqama: string | null;
  professionAr: string | null;
  professionEn: string | null;
  nationalityAr: string | null;
  nationalityEn: string | null;
  sponsor: string | null;
  projectName: string | null;
  projectJoinedOn: string | null;
  workDays: number | null;
  /** Null without the salary permission. */
  salary: Salary | null;
}

export interface WorkerList {
  total: number;
  counts: Partial<Record<Placement, number>>;
  items: WorkerRow[];
}

export interface Identifier {
  type: 'Iqama' | 'Passport' | 'BorderNumber' | 'Visa' | 'WorkPermit' | 'Gosi';
  number: string;
  expiresOn: string | null;
  isCurrent: boolean;
}

export interface WorkerDetail {
  summary: WorkerRow;
  iqamaProfessionAr: string | null;
  iqamaProfessionEn: string | null;
  recruitmentAgent: string | null;
  arrivedOn: string | null;
  maritalStatus: number | null;
  contract: { startsOn: string | null; months: number | null; endsOn: string | null };
  leave: { annualDays: number | null; balance: number | null; consumed: number | null; oldConsumed: number | null; remaining: number | null };
  crmCreatedAt: string | null;
  removedInCrm: boolean;
  identifiers: Identifier[];
}

export interface WorkerQuery {
  search?: string;
  placement?: Placement | '';
  sort?: 'name' | 'joined' | 'salary' | 'number';
  desc?: boolean;
  page: number;
  pageSize: number;
}

const base = '/api/v1/workforce';

/** Workers and company staff are separate lists (and permissions) on the server. */
export const kindPath = (kind: WorkerKind) => (kind === 'Staff' ? 'staff' : 'workers');

export const workforceApi = {
  list: (kind: WorkerKind, q: WorkerQuery) => {
    const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) });
    if (q.search) params.set('search', q.search);
    if (q.placement) params.set('placement', q.placement);
    if (q.sort) params.set('sort', q.sort);
    if (q.desc) params.set('desc', 'true');
    return request<WorkerList>('GET', `${base}/${kindPath(kind)}?${params.toString()}`);
  },
  get: (kind: WorkerKind, id: string) => request<WorkerDetail>('GET', `${base}/${kindPath(kind)}/${id}`),
  periods: (kind: WorkerKind, id: string) => request<WorkerPeriod[]>('GET', `${base}/${kindPath(kind)}/${id}/periods`),
};

/** A period of the worker's timeline (period ledger): endsOn is the first day after it (null while open). */
export interface WorkerPeriod {
  id: string;
  kind: string;
  projectId: string | null;
  projectName: string | null;
  startsOn: string;
  endsOn: string | null;
  sourceType: string;
  sourceId: string;
  sourceNo: string;
  closedByNo: string | null;
  packageNo: string | null;
  salary: number | null;
  serviceFee: number | null;
  housing: number | null;
  transport: number | null;
  totalPrice: number | null;
  isSpecialPrice: boolean;
}
