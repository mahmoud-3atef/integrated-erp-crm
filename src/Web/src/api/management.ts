// The executive dashboard as it was in the old system (src/Modules/Reports/.../Api/ReportsEndpoints.cs, /api/v1/reports/management).
import { request } from './auth';
import type { Finance, InvoiceRow, Overview, Rank } from './reports';

const base = '/api/v1/reports/management';

export interface StartRow {
  workerNo: string;
  name: string;
  projectCrmId: string | null;
  project: string | null;
  manager: string | null;
  /** The work period's monthly service price (null: not found). */
  price: number | null;
  startsOn: string;
  endsOn: string | null;
  status: 'Working' | 'Ended' | 'NotStarted';
  days: number;
}

export interface Delivery {
  total: number;
  byManager: Rank[];
  byProject: Rank[];
  rows: StartRow[];
}

export type HousingEntry = 'ReturnedWorker' | 'NewArrival' | 'BackFromVacation';

export interface EntryRow {
  workerNo: string;
  name: string;
  projectCrmId: string | null;
  project: string | null;
  manager: string | null;
  arrivedOn: string;
  entry: HousingEntry;
  reason: string;
  housing: string | null;
  days: number;
}

export interface HousingEntries {
  total: number;
  byManager: Rank[];
  byProject: Rank[];
  byEntry: Rank[];
  reasons: Rank[];
  rows: EntryRow[];
}

const q = (from: string, to: string, extra: Record<string, string | boolean | null | undefined> = {}) => {
  const p = new URLSearchParams({ from, to });
  for (const [k, v] of Object.entries(extra)) if (v !== null && v !== undefined && v !== '') p.set(k, String(v));
  return p.toString();
};

export const managementApi = {
  overview: (from: string, to: string) => request<Overview>('GET', `${base}/overview?${q(from, to)}`),
  delivery: (from: string, to: string) => request<Delivery>('GET', `${base}/delivery?${q(from, to)}`),
  housingEntries: (from: string, to: string) => request<HousingEntries>('GET', `${base}/housing-entries?${q(from, to)}`),
  finance: (from: string, to: string, project?: string | null) => request<Finance>('GET', `${base}/finance?${q(from, to, { project })}`),
  invoices: (from: string, to: string, project?: string | null) => request<InvoiceRow[]>('GET', `${base}/invoices?${q(from, to, { project })}`),
  deliveryExcel: (from: string, to: string) => `${base}/delivery?${q(from, to, { excel: true })}`,
  housingEntriesExcel: (from: string, to: string) => `${base}/housing-entries?${q(from, to, { excel: true })}`,
  invoicesExcel: (from: string, to: string, project?: string | null) => `${base}/invoices?${q(from, to, { project, excel: true })}`,
};
