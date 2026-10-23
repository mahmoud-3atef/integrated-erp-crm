// Company access administration (src/Modules/Identity/.../Api/AccessEndpoints.cs). Always the current company.
import { request, upload } from './auth';

export type RoleKind = 'Custom' | 'Administrator' | 'ReadOnly';

export interface Permission {
  code: string;
  groupAr: string;
  groupEn: string;
  nameAr: string;
  nameEn: string;
}

export interface Role {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  kind: RoleKind;
  isActive: boolean;
  permissions: string[];
}

/** A role for all commercial registrations (legalEntityId null) or for one. */
export interface Assignment {
  roleId: string;
  legalEntityId: string | null;
}

export interface Member {
  membershipId: string;
  userAccountId: string;
  displayName: string;
  userName: string | null;
  email: string | null;
  isActive: boolean;
  roles: Assignment[];
}

export interface LegalEntity {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
}

export interface RoleInput {
  code?: string;
  nameAr: string;
  nameEn: string;
  permissions: string[];
}

/** One name of a bulk add: new, member (already in the company), not_found, added or failed. */
export interface BulkMember {
  userName: string;
  outcome: 'new' | 'member' | 'not_found' | 'added' | 'failed';
  displayName: string | null;
  email: string | null;
}

export const accessApi = {
  permissions: () => request<Permission[]>('GET', '/api/v1/access/permissions'),
  roles: () => request<Role[]>('GET', '/api/v1/access/roles'),
  createRole: (input: RoleInput) => request<Role>('POST', '/api/v1/access/roles', input),
  updateRole: (id: string, input: RoleInput) => request<Role>('PUT', `/api/v1/access/roles/${id}`, input),
  members: () => request<Member[]>('GET', '/api/v1/access/members'),
  addMember: (userName: string) => request<Member>('POST', '/api/v1/access/members', { userName }),
  /** The user names of an Excel list (a «User Name» column, e.g. the old system's «Enabled Users» export). */
  readUserNames: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return upload<string[]>('/api/v1/access/members/bulk/read', form);
  },
  /** Who of these names would be added (nothing saved). */
  bulkPreview: (userNames: string[], roleId: string | null) => request<BulkMember[]>('POST', '/api/v1/access/members/bulk/preview', { userNames, roleId }),
  /** Adds them, each with the role for all registrations. */
  bulkAdd: (userNames: string[], roleId: string | null) => request<BulkMember[]>('POST', '/api/v1/access/members/bulk', { userNames, roleId }),
  setRoles: (membershipId: string, roles: Assignment[]) => request<void>('PUT', `/api/v1/access/members/${membershipId}/roles`, { roles }),
  setActive: (membershipId: string, isActive: boolean) => request<void>('PUT', `/api/v1/access/members/${membershipId}/active`, { isActive }),
  legalEntities: () => request<LegalEntity[]>('GET', '/api/v1/access/legal-entities'),
};

/** Arabic or English name of anything that carries both. */
export const localName = (item: { nameAr: string; nameEn: string }, language: string) => (language === 'ar' ? item.nameAr : item.nameEn);
