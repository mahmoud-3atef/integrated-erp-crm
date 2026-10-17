// Customers, contracts, projects and price packages (src/Modules/Commercial/.../Api/CommercialEndpoints.cs). Read-only in the parallel phase.
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

export type WorkerPriceStatus = 'Package' | 'Special' | 'NoPackage' | 'Missing';

/** A price package (src/Modules/Commercial/.../Domain/Pricing.cs): a general one when projectId is null. */
export interface PackageRow {
  id: string;
  packageNo: string;
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
  customerName: string | null;
  contractType: ContractType | null;
  professionCode: string;
  professionAr: string | null;
  professionEn: string | null;
  nationalityCode: string | null;
  nationalityAr: string | null;
  nationalityEn: string | null;
  salary: number;
  serviceFee: number;
  housing: number;
  housingBillable: boolean;
  transport: number;
  transportBillable: boolean;
  totalPrice: number;
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
  isCurrent: boolean;
  workers: number;
  notes: string | null;
}

export interface PackageList {
  total: number;
  totals: { packages: number; onPackage: number; special: number; withoutPackage: number; withoutPrice: number };
  items: PackageRow[];
}

/** A package suggested from the prices on the old system's open work starts. */
export interface Suggestion {
  id: string;
  projectId: string;
  projectName: string;
  customerName: string | null;
  contractType: ContractType | null;
  professionCode: string | null;
  professionAr: string | null;
  professionEn: string | null;
  nationalityCode: string | null;
  nationalityAr: string | null;
  nationalityEn: string | null;
  totalPrice: number;
  salary: number;
  feeAboveSalary: number | null;
  housing: number;
  transport: number;
  workers: number;
  otherPrices: number;
  withoutPrice: number;
  since: string | null;
  coveredById: string | null;
  coveredByNo: string | null;
}

export interface SuggestionList {
  total: number;
  covered: number;
  items: Suggestion[];
}

export interface WorkerPrice {
  id: string;
  workerId: string;
  workerNo: string;
  name: string;
  projectId: string;
  projectName: string;
  professionAr: string | null;
  professionEn: string | null;
  nationalityAr: string | null;
  nationalityEn: string | null;
  salary: number;
  servicePrice: number | null;
  housing: number;
  transport: number;
  status: WorkerPriceStatus;
  packageId: string | null;
  packageNo: string | null;
  packagePrice: number | null;
  difference: number | null;
  workStartNo: string | null;
  startedOn: string | null;
  fromWorkerDefault: boolean;
}

export interface WorkerPriceList {
  total: number;
  items: WorkerPrice[];
}

export interface ProjectPrices {
  packages: PackageRow[];
  suggestions: Suggestion[];
  workers: WorkerPrice[];
}

export interface Option {
  code: string;
  nameAr: string;
  nameEn: string;
}

export interface PackageOptions {
  projects: { id: string; code: string; name: string; contractType: ContractType | null }[];
  nationalities: Option[];
  professions: Option[];
}

export interface PackageInput {
  projectId: string | null;
  professionCode: string;
  nationalityCode: string | null;
  salary: number;
  serviceFee: number;
  housing: number;
  housingBillable: boolean;
  transport: number;
  transportBillable: boolean;
  validFrom: string;
  validTo: string | null;
  notes: string | null;
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
  prices: (q: ListQuery) => request<PackageList>('GET', `${base}/prices?${query(q)}`),
  suggestions: (q: ListQuery) => request<SuggestionList>('GET', `${base}/prices/suggestions?${query(q)}`),
  priceWorkers: (q: ListQuery) => request<WorkerPriceList>('GET', `${base}/prices/workers?${query(q)}`),
  priceOptions: (search?: string) => request<PackageOptions>('GET', `${base}/prices/options${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createPackage: (input: PackageInput) => request<{ id: string }>('POST', `${base}/prices`, input),
  updatePackage: (id: string, input: PackageInput) => request<void>('PUT', `${base}/prices/${id}`, input),
  setPackageActive: (id: string, active: boolean) => request<void>('POST', `${base}/prices/${id}/active`, { active }),
  projectPrices: (id: string) => request<ProjectPrices>('GET', `${base}/projects/${id}/prices`),
};
