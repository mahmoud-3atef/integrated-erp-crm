// Workers and staff (src/Modules/Workforce/.../Api/WorkforceEndpoints.cs). Read-only in the parallel phase.
import { request } from './auth';
const base = '/api/v1/workforce';
/** Workers and company staff are separate lists (and permissions) on the server. */
export const kindPath = (kind) => (kind === 'Staff' ? 'staff' : 'workers');
export const workforceApi = {
    list: (kind, q) => {
        const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) });
        if (q.search)
            params.set('search', q.search);
        if (q.placement)
            params.set('placement', q.placement);
        if (q.sort)
            params.set('sort', q.sort);
        if (q.desc)
            params.set('desc', 'true');
        return request('GET', `${base}/${kindPath(kind)}?${params.toString()}`);
    },
    get: (kind, id) => request('GET', `${base}/${kindPath(kind)}/${id}`),
};
