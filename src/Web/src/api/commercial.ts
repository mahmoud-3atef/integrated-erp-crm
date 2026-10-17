// Customers, contracts and projects (src/Modules/Commercial/.../Api/CommercialEndpoints.cs). Read-only in the parallel phase.
import { request } from './auth';
import type { Placement } from './workforce';

export type ContractType = 'CostPlus' | 'TotalCost' | 'TotalCostMultiSalaries';
export type ContractStatus = 'Valid' | 'WantsRenewal' | 'NoRenewal' | 'Canceled' | 'Expired';

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  customerId: string | null;
  customerName: string | null;
  manager: string | null;
  workers: number;
  contractType: ContractType | null;
  contractStatus: ContractStatus | null;
  startsOn: string | null;
  endsOn: string | null;
  daysLeft: number | null;
  isActive: boolean;
  createdAt: string | null;
}

export interface ProjectList {
  total: number;
  totals: { projects: number; workers: number; endingSoon: number; withoutCustomer: number };
  items: ProjectRow[];
}

export interface ProjectWorker {
  id: string;
  workerNo: string;
  name: string;
  placement: Placement;
  statusAr: string | null;
  statusEn: string | null;
  professionAr: string | null;
  professionEn: string | null;
  nationalityAr: string | null;
  nationalityEn: string | null;
  joinedOn: string | null;
}

export interface ProjectDetail {
  summary: ProjectRow;
  nameEn: string | null;
  commercialRegistration: string | null;
  city: string | null;
  sector: string | null;
  contactName: string | null;
  contactMobile: string | null;
  contactEmails: string | null;
  contractNo: string;
  workers: ProjectWorker[];
}

export interface CustomerRow {
  id: string;
  customerNo: string | null;
  name: string;
  nameEn: string | null;
  commercialRegistration: string | null;
  vatNumber: string | null;
  mobile: string | null;
  city: string | null;
  projects: number;
  activeProjects: number;
  workers: number;
  isActive: boolean;
  createdAt: string | null;
}

export interface CustomerList {
  total: number;
  active: number;
  withProjects: number;
  workers: number;
  items: CustomerRow[];
}

export interface CustomerDetail {
  summary: CustomerRow;
  email: string | null;
  contactName: string | null;
  laborOfficeNo: string | null;
  projects: ProjectRow[];
}

export interface ListQuery {
  search?: string;
  status?: string;
  sort?: string;
  desc?: boolean;
  page: number;
  pageSize: number;
}

const base = '/api/v1/commercial';

const query = (q: ListQuery) => {
  const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize), desc: String(q.desc ?? true) });
  if (q.search) params.set('search', q.search);
  if (q.status) params.set('status', q.status);
  if (q.sort) params.set('sort', q.sort);
  return params.toString();
};

export const commercialApi = {
  projects: (q: ListQuery) => request<ProjectList>('GET', `${base}/projects?${query(q)}`),
  project: (id: string) => request<ProjectDetail>('GET', `${base}/projects/${id}`),
  customers: (q: ListQuery) => request<CustomerList>('GET', `${base}/customers?${query(q)}`),
  customer: (id: string) => request<CustomerDetail>('GET', `${base}/customers/${id}`),
};
