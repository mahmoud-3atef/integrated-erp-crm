// Housing (src/Modules/Housing/.../Api/HousingEndpoints.cs): buildings, rooms and who lives in them.
import { request } from './auth';
import type { ProjectOption, WorkerCard } from './operations';

export type BuildingType = 'Company' | 'Rented' | 'Project';
export const buildingTypes: BuildingType[] = ['Company', 'Rented', 'Project'];

export interface BuildingRow {
  id: string;
  name: string;
  type: BuildingType;
  city: string | null;
  address: string | null;
  projectId: string | null;
  projectName: string | null;
  notes: string | null;
  isActive: boolean;
  rooms: number;
  capacity: number;
  occupied: number;
}

export interface HousingOverview {
  totals: { buildings: number; rooms: number; capacity: number; occupied: number; inHousing: number; withoutRoom: number };
  buildings: BuildingRow[];
}

export interface Occupant {
  assignmentId: string;
  workerId: string;
  workerNo: string;
  name: string;
  since: string;
  sourceType: string;
  sourceNo: string | null;
}

export interface RoomRow {
  id: string;
  number: string;
  floor: string | null;
  capacity: number;
  notes: string | null;
  isActive: boolean;
  occupants: Occupant[];
}

export interface BuildingDetail {
  building: BuildingRow;
  rooms: RoomRow[];
}

/** An active room with its occupancy, for pickers. */
export interface RoomOption {
  id: string;
  buildingId: string;
  buildingName: string;
  roomNo: string;
  capacity: number;
  occupied: number;
  isActive: boolean;
  free: number;
  label: string;
}

export interface Stay {
  roomId: string;
  buildingName: string;
  roomNo: string;
  startsOn: string;
  endsOn: string | null;
  sourceType: string;
  sourceNo: string | null;
}

export interface BuildingInput {
  name: string;
  type: BuildingType;
  city: string | null;
  address: string | null;
  projectId: string | null;
  notes: string | null;
}

export interface RoomInput {
  number: string;
  floor: string | null;
  capacity: number;
  notes: string | null;
}

const base = '/api/v1/housing';

export const housingApi = {
  overview: () => request<HousingOverview>('GET', base),
  building: (id: string) => request<BuildingDetail>('GET', `${base}/buildings/${id}`),
  rooms: () => request<RoomOption[]>('GET', `${base}/rooms`),
  withoutRoom: () => request<WorkerCard[]>('GET', `${base}/without-room`),
  stays: (workerId: string) => request<Stay[]>('GET', `${base}/workers/${workerId}/stays`),
  projects: () => request<ProjectOption[]>('GET', `${base}/projects`),
  createBuilding: (input: BuildingInput) => request<{ id: string }>('POST', `${base}/buildings`, input),
  updateBuilding: (id: string, input: BuildingInput) => request<void>('PUT', `${base}/buildings/${id}`, input),
  setBuildingActive: (id: string, active: boolean) => request<void>('POST', `${base}/buildings/${id}/active`, { active }),
  createRoom: (buildingId: string, input: RoomInput) => request<{ id: string }>('POST', `${base}/buildings/${buildingId}/rooms`, input),
  updateRoom: (id: string, input: RoomInput) => request<void>('PUT', `${base}/rooms/${id}`, input),
  setRoomActive: (id: string, active: boolean) => request<void>('POST', `${base}/rooms/${id}/active`, { active }),
  assign: (workerId: string, roomId: string, from: string | null) => request<void>('POST', `${base}/assignments`, { workerId, roomId, from }),
  leave: (workerId: string, on: string | null) => request<void>('POST', `${base}/workers/${workerId}/leave`, { on }),
};
