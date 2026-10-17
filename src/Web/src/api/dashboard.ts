// The dashboard's numbers, each from its module (shown only to those allowed to see that module).
import { request } from './auth';

export interface NamedCount {
  code: string | null;
  nameAr: string;
  nameEn: string;
  count: number;
}

export interface WorkforceDashboard {
  active: number;
  placements: Record<string, number>;
  projects: NamedCount[];
  projectsWithWorkers: number;
  nationalities: NamedCount[];
  professions: NamedCount[];
  moves: { month: string; workStarts: number; returns: number }[];
  /** Active workers whose iqama has an expiry date (the old system often has none). */
  iqamaWithExpiry: number;
  iqamaExpiring30: number;
  iqamaExpired: number;
  historyIssues: number;
  checkMonth: string | null;
  checkRate: number | null;
}

export interface OpenDocuments {
  preparing: number;
  inApproval: number;
}

export interface RecentDocument {
  kind: 'delivery' | 'return' | 'transfer';
  id: string;
  orderNo: string;
  title: string;
  status: string;
  workers: number;
  createdByName: string;
  createdAt: string;
}

export interface OperationsDashboard {
  deliveries: OpenDocuments;
  returns: OpenDocuments;
  transfers: OpenDocuments;
  deliveredThisMonth: number;
  returnedThisMonth: number;
  transferredThisMonth: number;
  recent: RecentDocument[];
}

export const dashboardApi = {
  workforce: () => request<WorkforceDashboard>('GET', '/api/v1/workforce/dashboard'),
  operations: () => request<OperationsDashboard>('GET', '/api/v1/operations/dashboard'),
};
