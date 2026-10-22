// The suppliers' worker costs (src/Modules/Workforce/.../Api/WorkforceEndpoints.cs, MapCosts).
import { request, upload } from './auth';
const base = '/api/v1/workforce';
export const costsApi = {
    options: () => request('GET', `${base}/costs/options`),
    overview: () => request('GET', `${base}/costs`),
    packages: () => request('GET', `${base}/costs/packages`),
    addPackage: (input) => request('POST', `${base}/costs/packages`, input),
    savePackage: (id, input) => request('PUT', `${base}/costs/packages/${id}`, input),
    deletePackage: (id) => request('DELETE', `${base}/costs/packages/${id}`),
    workers: (q) => {
        const p = new URLSearchParams();
        if (q.supplier)
            p.set('supplier', q.supplier);
        if (q.missing !== null && q.missing !== undefined)
            p.set('missing', String(q.missing));
        if (q.search)
            p.set('search', q.search);
        return request('GET', `${base}/costs/workers?${p.toString()}`);
    },
    templateUrl: (supplier) => `${base}/costs/template${supplier ? `?supplier=${encodeURIComponent(supplier)}` : ''}`,
    import: (file) => {
        const form = new FormData();
        form.append('file', file);
        return upload(`${base}/costs/import`, form);
    },
    worker: (workerId) => request('GET', `${base}/workers/${workerId}/cost`),
    addCard: (workerId, input) => request('POST', `${base}/workers/${workerId}/cost`, input),
    deleteCard: (workerId, cardId) => request('DELETE', `${base}/workers/${workerId}/cost/${cardId}`),
};
