// Worker movements: arrival, vacation and return, absconding and return, suspension and lifting, final exit
// (src/Modules/Operations/.../Api/MovementEndpoints.cs).
import { request } from './auth';
export const movementTypes = ['Arrival', 'VacationDeparture', 'VacationReturn', 'Absconding', 'AbscondingReturn', 'Suspension', 'SuspensionLift', 'FinalExit'];
export const suspensionReasons = ['Sickness', 'Investigation', 'Prison', 'Other'];
export const exitKinds = ['FinalExit', 'EndOfService', 'SponsorshipTransfer'];
const base = '/api/v1/operations/movements';
const qs = (filter) => new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString();
export const movementsApi = {
    list: (filter) => request('GET', `${base}?${qs(filter)}`),
    get: (id) => request('GET', `${base}/${id}`),
    workers: (search) => request('GET', `${base}/workers?${qs({ search })}`),
    options: (workerId, except) => request('GET', `${base}/options/${workerId}?${qs({ except })}`),
    projects: () => request('GET', `${base}/projects`),
    quote: (workerId, projectId, on) => request('GET', `${base}/quote?${qs({ workerId, projectId, on })}`),
    create: (input) => request('POST', base, input),
    update: (id, input) => request('PUT', `${base}/${id}`, input),
    submit: (id) => request('POST', `${base}/${id}/submit`),
    cancel: (id, comment) => request('POST', `${base}/${id}/cancel`, { comment }),
    amend: (id, input) => request('PUT', `${base}/${id}/amend`, input),
    cancelApproved: (id, reason) => request('POST', `${base}/${id}/cancel-approved`, { comment: reason }),
};
