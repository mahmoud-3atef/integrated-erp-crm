// GOSI and Saudization (src/Modules/Payroll/.../Api/GosiEndpoints.cs).
import { request } from './auth';
const base = '/api/v1/payroll/gosi';
export const gosiTaskKinds = ['WageUpdate', 'Register', 'Exclude'];
export const gosiApi = {
    statement: (q) => {
        const p = new URLSearchParams({ legalEntityId: q.legalEntityId, period: q.period, page: String(q.page), pageSize: String(q.pageSize) });
        if (q.search)
            p.set('search', q.search);
        if (q.kind)
            p.set('kind', q.kind);
        return request('GET', `${base}/statement?${p.toString()}`);
    },
    saveInvoice: (input) => request('PUT', `${base}/invoices`, input),
    tasks: (status) => request('GET', `${base}/tasks?status=${status}`),
    closeTask: (id, input) => request('POST', `${base}/tasks/${id}/close`, input),
    saudization: () => request('GET', `${base}/saudization`),
    saudizationSettings: () => request('GET', `${base}/saudization/settings`),
    saveSaudizationSettings: (input) => request('PUT', `${base}/saudization/settings`, input),
};
