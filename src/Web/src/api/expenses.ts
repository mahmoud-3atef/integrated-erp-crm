// The company's expenses (src/Modules/Expenses/.../Api/ExpenseEndpoints.cs).
import { request } from './auth';

export type ExpenseScope = 'Project' | 'Worker' | 'General';

export interface Expense {
  id: string;
  expenseNo: string;
  spentOn: string;
  category: string;
  categoryAr: string;
  categoryEn: string;
  scope: ExpenseScope;
  workerId: string | null;
  workerNo: string | null;
  workerName: string | null;
  projectCrmId: string | null;
  projectName: string | null;
  amount: number;
  vat: number;
  months: number;
  paidTo: string | null;
  reference: string | null;
  notes: string | null;
  status: 'Active' | 'Cancelled';
  cancelReason: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ExpenseInput {
  spentOn: string;
  category: string;
  workerId: string | null;
  projectCrmId: string | null;
  amount: number;
  vat: number;
  months: number;
  paidTo: string | null;
  reference: string | null;
  notes: string | null;
}

export interface ExpenseSum {
  key: string;
  nameAr: string;
  nameEn: string;
  count: number;
  amount: number;
}

export interface ExpenseList {
  items: Expense[];
  total: number;
  amount: number;
  vat: number;
  byScope: ExpenseSum[];
  byCategory: ExpenseSum[];
}

export interface ExpenseQuery {
  from?: string;
  to?: string;
  category?: string;
  scope?: ExpenseScope | '';
  workerId?: string;
  projectCrmId?: string;
  search?: string;
  withCancelled?: boolean;
  page: number;
  pageSize: number;
}

export interface ExpenseWorker {
  id: string;
  workerNo: string;
  name: string;
  projectName: string | null;
}

export interface ExpenseProject {
  crmId: string;
  code: string;
  name: string;
  manager: string | null;
}

const base = '/api/v1/expenses';

export const expensesApi = {
  list: (q: ExpenseQuery) => {
    const p = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) });
    for (const [k, v] of Object.entries(q)) if (k !== 'page' && k !== 'pageSize' && v !== undefined && v !== '' && v !== false) p.set(k, String(v));
    return request<ExpenseList>('GET', `${base}?${p.toString()}`);
  },
  create: (input: ExpenseInput) => request<{ id: string }>('POST', base, input),
  update: (id: string, input: ExpenseInput) => request<void>('PUT', `${base}/${id}`, input),
  cancel: (id: string, reason: string) => request<void>('POST', `${base}/${id}/cancel`, { reason }),
  workers: (search: string) => request<ExpenseWorker[]>('GET', `${base}/workers?search=${encodeURIComponent(search)}`),
  categories: () => request<{ code: string; nameAr: string; nameEn: string }[]>('GET', `${base}/categories`),
  projects: () => request<ExpenseProject[]>('GET', `${base}/projects`),
};
