// Customers, contracts, projects and price packages (src/Modules/Commercial/.../Api/CommercialEndpoints.cs). Read-only in the parallel phase.
import { request } from './auth';
const base = '/api/v1/commercial';
const query = (q) => {
    const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize), desc: String(q.desc ?? true) });
    if (q.search)
        params.set('search', q.search);
    if (q.status)
        params.set('status', q.status);
    if (q.sort)
        params.set('sort', q.sort);
    return params.toString();
};
export const commercialApi = {
    projects: (q) => request('GET', `${base}/projects?${query(q)}`),
    project: (id) => request('GET', `${base}/projects/${id}`),
    customers: (q) => request('GET', `${base}/customers?${query(q)}`),
    customer: (id) => request('GET', `${base}/customers/${id}`),
    prices: (q) => request('GET', `${base}/prices?${query(q)}`),
    suggestions: (q) => request('GET', `${base}/prices/suggestions?${query(q)}`),
    priceWorkers: (q) => request('GET', `${base}/prices/workers?${query(q)}`),
    priceOptions: (search) => request('GET', `${base}/prices/options${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    createPackage: (input) => request('POST', `${base}/prices`, input),
    updatePackage: (id, input) => request('PUT', `${base}/prices/${id}`, input),
    setPackageActive: (id, active) => request('POST', `${base}/prices/${id}/active`, { active }),
    projectPrices: (id) => request('GET', `${base}/projects/${id}/prices`),
};
