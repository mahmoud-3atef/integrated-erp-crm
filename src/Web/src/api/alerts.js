// The alerts center (src/Modules/Workflow/.../Api/AlertEndpoints.cs).
import { request } from './auth';
const base = '/api/v1/alerts';
export const alertsApi = {
    list: (code) => request('GET', code ? `${base}?code=${encodeURIComponent(code)}` : base),
    count: () => request('GET', `${base}/count`),
    dismiss: (code, key, days) => request('POST', `${base}/dismiss`, { code, key, days }),
    restore: () => request('POST', `${base}/restore`),
    settings: () => request('GET', `${base}/settings`),
    saveSetting: (code, enabled, days) => request('PUT', `${base}/settings/${encodeURIComponent(code)}`, { enabled, days }),
    digest: () => request('POST', `${base}/digest`),
};
