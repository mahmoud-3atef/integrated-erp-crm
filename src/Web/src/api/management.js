// The executive dashboard as it was in the old system (src/Modules/Reports/.../Api/ReportsEndpoints.cs, /api/v1/reports/management).
import { request } from './auth';
const base = '/api/v1/reports/management';
const q = (from, to, extra = {}) => {
    const p = new URLSearchParams({ from, to });
    for (const [k, v] of Object.entries(extra))
        if (v !== null && v !== undefined && v !== '')
            p.set(k, String(v));
    return p.toString();
};
export const managementApi = {
    overview: (from, to) => request('GET', `${base}/overview?${q(from, to)}`),
    delivery: (from, to) => request('GET', `${base}/delivery?${q(from, to)}`),
    housingEntries: (from, to) => request('GET', `${base}/housing-entries?${q(from, to)}`),
    finance: (from, to, project) => request('GET', `${base}/finance?${q(from, to, { project })}`),
    invoices: (from, to, project) => request('GET', `${base}/invoices?${q(from, to, { project })}`),
    deliveryExcel: (from, to) => `${base}/delivery?${q(from, to, { excel: true })}`,
    housingEntriesExcel: (from, to) => `${base}/housing-entries?${q(from, to, { excel: true })}`,
    invoicesExcel: (from, to, project) => `${base}/invoices?${q(from, to, { project, excel: true })}`,
};
