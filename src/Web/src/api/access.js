// Company access administration (src/Modules/Identity/.../Api/AccessEndpoints.cs). Always the current company.
import { request, upload } from './auth';
export const accessApi = {
    permissions: () => request('GET', '/api/v1/access/permissions'),
    roles: () => request('GET', '/api/v1/access/roles'),
    createRole: (input) => request('POST', '/api/v1/access/roles', input),
    updateRole: (id, input) => request('PUT', `/api/v1/access/roles/${id}`, input),
    members: () => request('GET', '/api/v1/access/members'),
    addMember: (userName) => request('POST', '/api/v1/access/members', { userName }),
    /** The user names of an Excel list (a «User Name» column, e.g. the old system's «Enabled Users» export). */
    readUserNames: (file) => {
        const form = new FormData();
        form.append('file', file);
        return upload('/api/v1/access/members/bulk/read', form);
    },
    /** Who of these names would be added (nothing saved). */
    bulkPreview: (userNames, roleId) => request('POST', '/api/v1/access/members/bulk/preview', { userNames, roleId }),
    /** Adds them, each with the role for all registrations. */
    bulkAdd: (userNames, roleId) => request('POST', '/api/v1/access/members/bulk', { userNames, roleId }),
    setRoles: (membershipId, roles) => request('PUT', `/api/v1/access/members/${membershipId}/roles`, { roles }),
    setActive: (membershipId, isActive) => request('PUT', `/api/v1/access/members/${membershipId}/active`, { isActive }),
    legalEntities: () => request('GET', '/api/v1/access/legal-entities'),
};
/** Arabic or English name of anything that carries both. */
export const localName = (item, language) => (language === 'ar' ? item.nameAr : item.nameEn);
