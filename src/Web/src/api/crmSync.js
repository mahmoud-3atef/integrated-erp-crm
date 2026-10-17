// Sync from the old CRM (src/Modules/CrmSync/.../Api/CrmSyncEndpoints.cs).
import { request } from './auth';
const base = '/api/v1/crm-sync';
export const crmSyncApi = {
    status: () => request('GET', `${base}/status`),
    run: (mode) => request('POST', `${base}/runs`, { mode }),
    importReferences: () => request('POST', `${base}/references/import`),
    /** Merge item fromCode into toCode, or link one CRM record to toCode. */
    merge: (list, toCode, from) => request('POST', `${base}/references/${list}/merge`, { toCode, ...from }),
    report: (list) => request('GET', `${base}/references/${list}`),
};
