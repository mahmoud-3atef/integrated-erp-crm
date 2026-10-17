// Attachments and notifications (src/Modules/Documents/.../Api/DocumentsEndpoints.cs).
import { request, upload } from './auth';
const base = '/api/v1/documents';
/** Accepted file kinds (the server also checks the file's content). */
export const acceptedFiles = '.pdf,.png,.jpg,.jpeg,.docx,.xlsx';
export const documentsApi = {
    documentTypes: () => request('GET', `${base}/document-types`),
    attachments: (ownerType, ownerId) => request('GET', `${base}/attachments?ownerType=${encodeURIComponent(ownerType)}&ownerId=${encodeURIComponent(ownerId)}`),
    upload: (input) => {
        const form = new FormData();
        form.append('ownerType', input.ownerType);
        form.append('ownerId', input.ownerId);
        form.append('documentType', input.documentType);
        if (input.expiresOn) {
            form.append('expiresOn', input.expiresOn);
        }
        form.append('notes', input.notes);
        form.append('file', input.file);
        return upload(`${base}/attachments`, form);
    },
    /** Same-origin link: the session cookie authorizes the download. */
    contentUrl: (id) => `${base}/attachments/${id}/content`,
    remove: (id) => request('DELETE', `${base}/attachments/${id}`),
    notifications: () => request('GET', `${base}/notifications`),
    markRead: (id) => request('POST', `${base}/notifications/${id}/read`),
    markAllRead: () => request('POST', `${base}/notifications/read-all`),
};
