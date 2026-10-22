// The dashboard's numbers, each from its module (shown only to those allowed to see that module).
import { request } from './auth';
export const dashboardApi = {
    workforce: () => request('GET', '/api/v1/workforce/dashboard'),
    operations: () => request('GET', '/api/v1/operations/dashboard'),
};
