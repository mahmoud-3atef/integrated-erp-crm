// The alerts center (src/Modules/Workflow/.../Api/AlertEndpoints.cs).
import { request } from './auth';

export type AlertSeverity = 'Critical' | 'Warning' | 'Info';

export interface Alert {
  code: string;
  key: string;
  severity: AlertSeverity;
  groupAr: string;
  groupEn: string;
  nameAr: string;
  nameEn: string;
  titleAr: string;
  titleEn: string;
  detailAr: string | null;
  detailEn: string | null;
  link: string;
  since: string;
  days: number;
  amount: number | null;
}

export interface AlertCounts {
  critical: number;
  warning: number;
  info: number;
  hidden: number;
}

export interface AlertList {
  counts: AlertCounts;
  items: Alert[];
}

export interface AlertSetting {
  code: string;
  groupAr: string;
  groupEn: string;
  nameAr: string;
  nameEn: string;
  daysMeaningAr: string;
  daysMeaningEn: string;
  defaultDays: number;
  enabled: boolean;
  days: number;
  updatedByName: string | null;
  updatedAt: string | null;
}

const base = '/api/v1/alerts';

export const alertsApi = {
  list: (code?: string) => request<AlertList>('GET', code ? `${base}?code=${encodeURIComponent(code)}` : base),
  count: () => request<AlertCounts>('GET', `${base}/count`),
  dismiss: (code: string, key: string, days: number) => request<void>('POST', `${base}/dismiss`, { code, key, days }),
  restore: () => request<void>('POST', `${base}/restore`),
  settings: () => request<AlertSetting[]>('GET', `${base}/settings`),
  saveSetting: (code: string, enabled: boolean, days: number) => request<void>('PUT', `${base}/settings/${encodeURIComponent(code)}`, { enabled, days }),
  digest: () => request<{ told: number }>('POST', `${base}/digest`),
};
