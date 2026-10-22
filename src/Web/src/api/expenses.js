// The company's expenses (src/Modules/Expenses/.../Api/ExpenseEndpoints.cs).
import { request } from './auth';
const base = '/api/v1/expenses';
export const expensesApi = {
    list: (q) => {
        const p = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) });
        for (const [k, v] of Object.entries(q))
            if (k !== 'page' && k !== 'pageSize' && v !== undefined && v !== '' && v !== false)
                p.set(k, String(v));
        return request('GET', `${base}?${p.toString()}`);
    },
    create: (input) => request('POST', base, input),
    update: (id, input) => request('PUT', `${base}/${id}`, input),
    cancel: (id, reason) => request('POST', `${base}/${id}/cancel`, { reason }),
    workers: (search) => request('GET', `${base}/workers?search=${encodeURIComponent(search)}`),
    categories: () => request('GET', `${base}/categories`),
    projects: () => request('GET', `${base}/projects`),
};
