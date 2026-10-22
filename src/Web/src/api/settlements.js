import { request } from './auth';
export const endReasons = ['ContractEnd', 'EmployerTermination', 'Resignation', 'ForceMajeure', 'Death', 'Probation', 'Article80'];
const base = '/api/v1/payroll/settlements';
export const settlementsApi = {
    list: (q) => {
        const p = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) });
        if (q.party)
            p.set('party', q.party);
        if (q.kind)
            p.set('kind', q.kind);
        if (q.status)
            p.set('status', q.status);
        if (q.search)
            p.set('search', q.search);
        if (q.sort)
            p.set('sort', q.sort);
        if (q.desc !== undefined)
            p.set('desc', String(q.desc));
        return request('GET', `${base}?${p.toString()}`);
    },
    get: (id) => request('GET', `${base}/${id}`),
    leaves: () => request('GET', `${base}/leaves`),
    /** The workers' approved vacation departures (VD-) without a settlement. */
    workerLeaves: () => request('GET', `${base}/worker-leaves`),
    workers: (search) => request('GET', `${base}/workers?search=${encodeURIComponent(search)}`),
    create: (input) => request('POST', base, input),
    update: (id, input) => request('PUT', `${base}/${id}`, input),
    submit: (id) => request('POST', `${base}/${id}/submit`),
    pay: (id, input) => request('POST', `${base}/${id}/pay`, input),
    cancel: (id, comment) => request('POST', `${base}/${id}/cancel`, { comment }),
};
