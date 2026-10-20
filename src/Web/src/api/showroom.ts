// The showroom (src/Modules/Operations/.../Api/ShowroomEndpoints.cs) and the workers' marketing profile
// (src/Modules/Workforce/.../Api/WorkforceEndpoints.cs).
import { request, upload } from './auth';

export interface NamedCode {
  code: string;
  nameAr: string;
  nameEn: string;
}

export interface ShowroomWorker {
  id: string;
  workerNo: string;
  /** The first name only in the presentation for a customer. */
  name: string;
  nationalityCode: string | null;
  nationalityAr: string | null;
  nationalityEn: string | null;
  specialty: NamedCode | null;
  /** Read from the last work place's name, not yet confirmed. */
  specialtySuggested: boolean;
  skills: NamedCode[];
  languages: NamedCode[];
  gender: 'M' | 'F' | null;
  age: number | null;
  priorExperienceYears: number | null;
  bioAr: string | null;
  bioEn: string | null;
  photos: string[];
  workDays: number;
  projects: number;
  hotelExperience: boolean;
  isNew: boolean;
  // Internal (null in the presentation):
  since: string | null;
  daysAvailable: number | null;
  reservedBy: string | null;
  lastPlace: string | null;
  lastReturnReason: string | null;
}

export interface ShowroomCount {
  code: string | null;
  nameAr: string;
  nameEn: string;
  count: number;
}

export interface Showroom {
  available: number;
  reserved: number;
  nationalities: number;
  withHotelExperience: number;
  newArrivals: number;
  oldestDays: number | null;
  bySpecialty: ShowroomCount[];
  byNationality: ShowroomCount[];
  workers: ShowroomWorker[];
  presentation: boolean;
}

export interface ShowroomStint {
  place: string | null;
  startsOn: string;
  endsOn: string | null;
  days: number;
}

export interface ShowroomWorkerFile {
  worker: ShowroomWorker;
  stints: ShowroomStint[];
  longestStintDays: number;
}

export interface WorkerProfile {
  specialty: string | null;
  suggestedSpecialty: string | null;
  skills: string[];
  languages: string[];
  gender: 'M' | 'F' | null;
  birthDate: string | null;
  religion: string | null;
  education: string | null;
  priorExperienceYears: number | null;
  bioAr: string | null;
  bioEn: string | null;
  photos: string[];
  updatedBy: string | null;
  updatedAt: string | null;
}

export type WorkerProfileInput = Omit<WorkerProfile, 'suggestedSpecialty' | 'photos' | 'updatedBy' | 'updatedAt'>;

export interface ReferenceOption {
  code: string;
  nameAr: string;
  nameEn: string;
}

export interface ProfileLists {
  specialties: ReferenceOption[];
  skills: ReferenceOption[];
  languages: ReferenceOption[];
}

export const religions = ['MUSLIM', 'CHRISTIAN', 'HINDU', 'BUDDHIST', 'OTHER'] as const;
export const educations = ['NONE', 'PRIMARY', 'SECONDARY', 'DIPLOMA', 'BACHELOR'] as const;

const base = '/api/v1/operations/showroom';
const workers = '/api/v1/workforce/workers';

export const photoUrl = (workerId: string, photoId: string) => `${workers}/${workerId}/photos/${photoId}`;

export const showroomApi = {
  get: (presentation: boolean) => request<Showroom>('GET', `${base}${presentation ? '?presentation=true' : ''}`),
  file: (workerId: string, presentation: boolean) => request<ShowroomWorkerFile>('GET', `${base}/${workerId}${presentation ? '?presentation=true' : ''}`),
};

export const profileApi = {
  lists: () => request<ProfileLists>('GET', '/api/v1/workforce/profile-lists'),
  get: (workerId: string) => request<WorkerProfile>('GET', `${workers}/${workerId}/profile`),
  save: (workerId: string, input: WorkerProfileInput) => request<void>('PUT', `${workers}/${workerId}/profile`, input),
  addPhoto: (workerId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return upload<{ id: string }>(`${workers}/${workerId}/photos`, form);
  },
  deletePhoto: (workerId: string, photoId: string) => request<void>('DELETE', `${workers}/${workerId}/photos/${photoId}`),
  makeMain: (workerId: string, photoId: string) => request<void>('POST', `${workers}/${workerId}/photos/${photoId}/main`),
};
