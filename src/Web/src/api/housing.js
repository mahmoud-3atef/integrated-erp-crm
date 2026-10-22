// Housing (src/Modules/Housing/.../Api/HousingEndpoints.cs): buildings, rooms and who lives in them.
import { request } from './auth';
export const buildingTypes = ['Company', 'Rented', 'Project'];
const base = '/api/v1/housing';
export const housingApi = {
    overview: () => request('GET', base),
    building: (id) => request('GET', `${base}/buildings/${id}`),
    rooms: () => request('GET', `${base}/rooms`),
    withoutRoom: () => request('GET', `${base}/without-room`),
    stays: (workerId) => request('GET', `${base}/workers/${workerId}/stays`),
    projects: () => request('GET', `${base}/projects`),
    createBuilding: (input) => request('POST', `${base}/buildings`, input),
    updateBuilding: (id, input) => request('PUT', `${base}/buildings/${id}`, input),
    setBuildingActive: (id, active) => request('POST', `${base}/buildings/${id}/active`, { active }),
    createRoom: (buildingId, input) => request('POST', `${base}/buildings/${buildingId}/rooms`, input),
    updateRoom: (id, input) => request('PUT', `${base}/rooms/${id}`, input),
    setRoomActive: (id, active) => request('POST', `${base}/rooms/${id}/active`, { active }),
    assign: (workerId, roomId, from) => request('POST', `${base}/assignments`, { workerId, roomId, from }),
    leave: (workerId, on) => request('POST', `${base}/workers/${workerId}/leave`, { on }),
};
