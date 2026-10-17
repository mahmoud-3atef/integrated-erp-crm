// Sync from the old CRM (src/Modules/CrmSync/.../Api/CrmSyncEndpoints.cs).
import { request } from './auth';

export type SyncMode = 'Incremental' | 'Full';
export type RunStatus = 'Queued' | 'Running' | 'Succeeded' | 'PartlyFailed' | 'Failed';
export type MatchRule = 'Name' | 'Duplicate' | 'Spelling' | 'EnglishName' | 'Alias' | 'Conflict' | 'Unmapped' | 'Manual';

export interface EntityStatus {
  entity: string;
  nameAr: string;
  nameEn: string;
  records: number;
  deleted: number;
  lastChangeCopied: string | null;
  lastSucceededAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
}

export interface EntityResult {
  entity: string;
  read: number;
  inserted: number;
  updated: number;
  deleted: number;
  error: string | null;
}

export interface SyncRun {
  id: string;
  mode: SyncMode;
  status: RunStatus;
  requestedBy: string;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  results: EntityResult[];
  error: string | null;
}

export interface SyncStatus {
  configured: boolean;
  company: string;
  isThisCompany: boolean;
  intervalMinutes: number;
  entities: EntityStatus[];
  runs: SyncRun[];
}

export interface ListImportSummary {
  listCode: string;
  crmRecords: number;
  items: number;
  created: number;
  alreadyPresent: number;
  merged: number;
  unmapped: number;
  needsReview: number;
}

export interface ImportReport {
  nationalities: ListImportSummary;
  professions: ListImportSummary;
}

export interface Mapping {
  crmId: string;
  crmName: string;
  crmCode: string | null;
  itemCode: string | null;
  rule: MatchRule;
  usage: number;
}

export interface MappedItem {
  code: string;
  nameAr: string;
  nameEn: string;
  usage: number;
  records: Mapping[];
}

export interface MappingReport {
  listCode: string;
  items: MappedItem[];
  unmapped: Mapping[];
}

export type ReferenceList = 'nationalities' | 'professions';

const base = '/api/v1/crm-sync';

export const crmSyncApi = {
  status: () => request<SyncStatus>('GET', `${base}/status`),
  run: (mode: SyncMode) => request<SyncRun>('POST', `${base}/runs`, { mode }),
  importReferences: () => request<ImportReport>('POST', `${base}/references/import`),
  /** Merge item fromCode into toCode, or link one CRM record to toCode. */
  merge: (list: ReferenceList, toCode: string, from: { fromCode?: string; crmId?: string }) =>
    request<void>('POST', `${base}/references/${list}/merge`, { toCode, ...from }),
  report: (list: ReferenceList) => request<MappingReport>('GET', `${base}/references/${list}`),
};
