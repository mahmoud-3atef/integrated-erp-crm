// Company setup (src/Modules/Organization/.../Api/CompanySetupEndpoints.cs). Always the current company.
import { request } from './auth';

export interface LegalEntityRecord {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  commercialRegistrationNo: string;
  vatNumber: string | null;
  isActive: boolean;
}

export interface Branch {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  legalEntityId: string | null;
  city: string | null;
  isActive: boolean;
}

export interface ReferenceList {
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  itemCount: number;
}

export interface ReferenceItem {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
}

export interface ModuleStatus {
  name: string;
  enabled: boolean;
}

/** One change in a record's history: field → { old?, new? }. */
export interface HistoryEntry {
  action: 'Added' | 'Modified' | 'Deleted';
  userName: string;
  occurredAt: string;
  changes: Record<string, { old?: unknown; new?: unknown }>;
}

const base = '/api/v1/organization';

export const setupApi = {
  legalEntities: () => request<LegalEntityRecord[]>('GET', `${base}/legal-entities`),
  createLegalEntity: (input: Omit<LegalEntityRecord, 'id' | 'isActive'>) => request<LegalEntityRecord>('POST', `${base}/legal-entities`, input),
  updateLegalEntity: (id: string, input: Omit<LegalEntityRecord, 'id' | 'code'>) => request<LegalEntityRecord>('PUT', `${base}/legal-entities/${id}`, input),
  legalEntityHistory: (id: string) => request<HistoryEntry[]>('GET', `${base}/legal-entities/${id}/history`),

  branches: () => request<Branch[]>('GET', `${base}/branches`),
  createBranch: (input: Omit<Branch, 'id'>) => request<Branch>('POST', `${base}/branches`, input),
  updateBranch: (id: string, input: Omit<Branch, 'id' | 'code'>) => request<Branch>('PUT', `${base}/branches/${id}`, input),
  branchHistory: (id: string) => request<HistoryEntry[]>('GET', `${base}/branches/${id}/history`),

  referenceLists: () => request<ReferenceList[]>('GET', `${base}/reference-lists`),
  items: (list: string) => request<ReferenceItem[]>('GET', `${base}/reference-lists/${list}/items`),
  createItem: (list: string, input: Omit<ReferenceItem, 'id' | 'isSystem' | 'isActive'>) => request<ReferenceItem>('POST', `${base}/reference-lists/${list}/items`, input),
  updateItem: (list: string, id: string, input: Omit<ReferenceItem, 'id' | 'code' | 'isSystem'>) =>
    request<ReferenceItem>('PUT', `${base}/reference-lists/${list}/items/${id}`, input),
  itemHistory: (list: string, id: string) => request<HistoryEntry[]>('GET', `${base}/reference-lists/${list}/items/${id}/history`),

  modules: () => request<ModuleStatus[]>('GET', `${base}/modules`),
};
