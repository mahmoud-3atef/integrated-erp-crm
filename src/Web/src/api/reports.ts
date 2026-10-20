// The executive report (src/Modules/Reports/.../Api/ReportsEndpoints.cs).
import { request } from './auth';

const base = '/api/v1/reports/executive';

/** A figure with the same figure of the period before (null when it cannot be known). */
export interface Figure {
  value: number | null;
  previous: number | null;
}

export interface Period {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  /** While the period runs, its movements compare with as many days of the period before. */
  movesPreviousTo: string;
}

export interface MonthMoves {
  month: string;
  starts: number;
  returns: number;
}

export interface MonthMoney {
  month: string;
  invoiced: number;
  collected: number;
  rate: number | null;
}

export interface Rank {
  key: string;
  name: string;
  count: number;
}

export interface ProjectMoves {
  projectCrmId: string | null;
  name: string;
  manager: string | null;
  starts: number;
  returns: number;
}

export interface Coverage {
  month: string | null;
  full: number;
  partial: number;
  missing: number;
  workersNotInvoiced: number;
  gaps: { projectCrmId: string; name: string; manager: string | null; worked: number; invoiced: number; hasInvoice: boolean }[];
}

export interface Overview {
  period: Period;
  activeProjects: number;
  onJob: number;
  inHousing: number;
  starts: Figure;
  returns: Figure;
  net: Figure;
  invoiced: Figure;
  invoiceCount: Figure;
  collectionRate: Figure;
  overdue60: number;
  totalDebt: number;
  moves: MonthMoves[];
  money: MonthMoney[];
  startsByManager: Rank[];
  projects: ProjectMoves[];
  coverage: Coverage;
  financeVisible: boolean;
}

export interface Aging {
  bucket: number;
  count: number;
  amount: number;
  percent: number;
}

export interface Debtor {
  projectCrmId: string | null;
  name: string;
  manager: string | null;
  outstanding: number;
  invoiced: number;
  collected: number;
  rate: number;
  openInvoices: number;
  oldestDays: number;
}

export interface ManagerCollection {
  manager: string;
  projects: number;
  invoices: number;
  invoiced: number;
  collected: number;
  outstanding: number;
  rate: number;
}

export interface InvoiceRow {
  crmId: string;
  no: string;
  projectCrmId: string | null;
  projectName: string;
  manager: string | null;
  workers: number;
  total: number;
  collected: number;
  remaining: number;
  rate: number;
  status: number;
  statusAr: string;
  statusEn: string;
  to: string;
  createdOn: string;
  ageDays: number;
}

export interface Finance {
  period: Period;
  invoiced: Figure;
  beforeVat: Figure;
  vat: Figure;
  invoiceCount: Figure;
  workers: Figure;
  collected: Figure;
  collectionRate: Figure;
  remaining: Figure;
  totalDebt: number;
  openInvoices: number;
  overdue60: number;
  overdue60Invoices: number;
  overdue60Share: number | null;
  dso: number | null;
  money: MonthMoney[];
  statuses: { code: number; nameAr: string; nameEn: string; count: number; total: number }[];
  aging: Aging[];
  debtors: Debtor[];
  managers: ManagerCollection[];
  invoices: InvoiceRow[];
  invoicesTotal: number;
}

export interface MoveRow {
  workerNo: string;
  name: string;
  kind: 'Work' | 'Housing';
  on: string;
  projectCrmId: string | null;
  project: string | null;
  manager: string | null;
}

/** What a list behind a clicked figure narrows to. */
export interface Drill {
  project?: string | null;
  manager?: string | null;
  status?: number | null;
  bucket?: number | null;
  month?: string | null;
  kind?: 'Work' | 'Housing' | null;
  open?: boolean;
}

function query(from: string, to: string, extra: Record<string, string | number | boolean | null | undefined> = {}) {
  const p = new URLSearchParams({ from, to });
  for (const [k, v] of Object.entries(extra)) if (v !== null && v !== undefined && v !== '') p.set(k, String(v));
  return p.toString();
}

export const reportsApi = {
  overview: (from: string, to: string) => request<Overview>('GET', `${base}/overview?${query(from, to)}`),
  finance: (from: string, to: string, project?: string | null) => request<Finance>('GET', `${base}/finance?${query(from, to, { project })}`),
  invoices: (from: string, to: string, drill: Drill) => request<InvoiceRow[]>('GET', `${base}/invoices?${query(from, to, { ...drill })}`),
  moves: (from: string, to: string, drill: Drill) => request<MoveRow[]>('GET', `${base}/moves?${query(from, to, { ...drill })}`),
  invoicesExcel: (from: string, to: string, drill: Drill) => `${base}/invoices?${query(from, to, { ...drill, excel: true })}`,
  movesExcel: (from: string, to: string, drill: Drill) => `${base}/moves?${query(from, to, { ...drill, excel: true })}`,
};

// The workforce movement report (the same endpoints file, /api/v1/reports/movement).
const movementBase = '/api/v1/reports/movement';

export interface MonthMovement {
  month: string;
  starts: number;
  returns: number;
  arrivals: number;
  averageStint: number | null;
}

export interface ArrivalRow {
  workerNo: string;
  name: string;
  sponsor: string | null;
  arrivedOn: string;
  placement: string;
  firstWorkOn: string | null;
  firstProject: string | null;
  /** To the first work, or to today while not delivered. */
  days: number;
  workDays: number;
  housingDays: number;
}

export interface ReturnRow {
  workerNo: string;
  name: string;
  on: string;
  reason: string;
  projectCrmId: string | null;
  project: string | null;
  manager: string | null;
  housing: string | null;
}

export interface WaitingRow {
  workerNo: string;
  name: string;
  since: string;
  days: number;
  housing: string | null;
  fromProjectCrmId: string | null;
  fromProject: string | null;
  manager: string | null;
}

export interface Movement {
  period: Period;
  starts: Figure;
  returns: Figure;
  arrivals: Figure;
  arrivalsDelivered: number;
  net: Figure;
  averageStint: Figure;
  waiting: number;
  oldestWaitingDays: number | null;
  months: MonthMovement[];
  startsByManager: Rank[];
  startsByProject: Rank[];
  reasons: Rank[];
  newWorkers: ArrivalRow[];
  newWorkersTotal: number;
}

/** What a movement list narrows to. */
export interface MovementDrill extends Drill {
  reason?: string | null;
  delivered?: boolean | null;
}

export type MovementList = 'moves' | 'arrivals' | 'returns' | 'waiting';

export const movementApi = {
  overview: (from: string, to: string) => request<Movement>('GET', `${movementBase}?${query(from, to)}`),
  list: <T,>(list: MovementList, from: string, to: string, drill: MovementDrill) => request<T[]>('GET', `${movementBase}/${list}?${query(from, to, { ...drill })}`),
  excel: (list: MovementList, from: string, to: string, drill: MovementDrill) => `${movementBase}/${list}?${query(from, to, { ...drill, excel: true })}`,
};
