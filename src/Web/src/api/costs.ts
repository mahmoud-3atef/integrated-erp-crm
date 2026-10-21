// The suppliers' worker costs (src/Modules/Workforce/.../Api/WorkforceEndpoints.cs, MapCosts).
import { request, upload } from './auth';

export type CostMethod = 'MonthlyFixed' | 'ByWorkingDays';

export interface CostPackage {
  id: string;
  supplier: string;
  professionCode: string | null;
  professionAr: string | null;
  professionEn: string | null;
  nationalityCode: string | null;
  nationalityAr: string | null;
  nationalityEn: string | null;
  monthlyCost: number;
  method: CostMethod;
  effectiveFrom: string;
  notes: string | null;
  workers: number;
  updatedBy: string;
  updatedAt: string;
}

export interface CostInput {
  supplier: string | null;
  professionCode: string | null;
  nationalityCode: string | null;
  monthlyCost: number;
  method: CostMethod;
  effectiveFrom: string;
  notes: string | null;
}

export interface SupplierWorker {
  workerId: string;
  workerNo: string;
  name: string;
  supplier: string;
  placement: string;
  professionAr: string | null;
  professionEn: string | null;
  nationalityAr: string | null;
  nationalityEn: string | null;
  monthlyCost: number | null;
  method: CostMethod | null;
  /** The worker's own card, the supplier's package, or none yet. */
  costSource: 'Card' | 'Package' | null;
  effectiveFrom: string | null;
}

export interface CostOverview {
  supplierWorkers: number;
  withCard: number;
  byPackage: number;
  missing: number;
  suppliers: { supplier: string; workers: number; withCost: number; missing: number }[];
}

export interface CostCard {
  id: string;
  supplier: string;
  monthlyCost: number;
  method: CostMethod;
  effectiveFrom: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  current: boolean;
}

export interface WorkerCost {
  source: 'Company' | 'Supplier' | 'Unknown';
  supplier: string | null;
  monthlyCost: number | null;
  method: CostMethod | null;
  costSource: 'Card' | 'Package' | null;
  effectiveFrom: string | null;
  package: CostPackage | null;
  cards: CostCard[];
  salary: number | null;
}

export interface CostOptions {
  suppliers: string[];
  professions: { code: string; nameAr: string; nameEn: string }[];
  nationalities: { code: string; nameAr: string; nameEn: string }[];
}

export interface CostImport {
  added: number;
  failed: number;
  errors: { row: number; workerNo: string | null; error: string | null }[];
}

const base = '/api/v1/workforce';

export const costsApi = {
  options: () => request<CostOptions>('GET', `${base}/costs/options`),
  overview: () => request<CostOverview>('GET', `${base}/costs`),
  packages: () => request<CostPackage[]>('GET', `${base}/costs/packages`),
  addPackage: (input: CostInput) => request<{ id: string }>('POST', `${base}/costs/packages`, input),
  savePackage: (id: string, input: CostInput) => request<void>('PUT', `${base}/costs/packages/${id}`, input),
  deletePackage: (id: string) => request<void>('DELETE', `${base}/costs/packages/${id}`),
  workers: (q: { supplier?: string | null; missing?: boolean | null; search?: string }) => {
    const p = new URLSearchParams();
    if (q.supplier) p.set('supplier', q.supplier);
    if (q.missing !== null && q.missing !== undefined) p.set('missing', String(q.missing));
    if (q.search) p.set('search', q.search);
    return request<SupplierWorker[]>('GET', `${base}/costs/workers?${p.toString()}`);
  },
  templateUrl: (supplier?: string | null) => `${base}/costs/template${supplier ? `?supplier=${encodeURIComponent(supplier)}` : ''}`,
  import: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return upload<CostImport>(`${base}/costs/import`, form);
  },
  worker: (workerId: string) => request<WorkerCost>('GET', `${base}/workers/${workerId}/cost`),
  addCard: (workerId: string, input: CostInput) => request<void>('POST', `${base}/workers/${workerId}/cost`, input),
  deleteCard: (workerId: string, cardId: string) => request<void>('DELETE', `${base}/workers/${workerId}/cost/${cardId}`),
};
