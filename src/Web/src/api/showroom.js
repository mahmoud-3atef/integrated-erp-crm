// The showroom (src/Modules/Operations/.../Api/ShowroomEndpoints.cs) and the workers' marketing profile
// (src/Modules/Workforce/.../Api/WorkforceEndpoints.cs).
import { request, upload } from './auth';
export const religions = ['MUSLIM', 'CHRISTIAN', 'HINDU', 'BUDDHIST', 'OTHER'];
export const educations = ['NONE', 'PRIMARY', 'SECONDARY', 'DIPLOMA', 'BACHELOR'];
const base = '/api/v1/operations/showroom';
const workers = '/api/v1/workforce/workers';
export const photoUrl = (workerId, photoId) => `${workers}/${workerId}/photos/${photoId}`;
export const showroomApi = {
    get: (presentation) => request('GET', `${base}${presentation ? '?presentation=true' : ''}`),
    file: (workerId, presentation) => request('GET', `${base}/${workerId}${presentation ? '?presentation=true' : ''}`),
};
export const profileApi = {
    lists: () => request('GET', '/api/v1/workforce/profile-lists'),
    get: (workerId) => request('GET', `${workers}/${workerId}/profile`),
    save: (workerId, input) => request('PUT', `${workers}/${workerId}/profile`, input),
    addPhoto: (workerId, file) => {
        const form = new FormData();
        form.append('file', file);
        return upload(`${workers}/${workerId}/photos`, form);
    },
    deletePhoto: (workerId, photoId) => request('DELETE', `${workers}/${workerId}/photos/${photoId}`),
    makeMain: (workerId, photoId) => request('POST', `${workers}/${workerId}/photos/${photoId}/main`),
};
