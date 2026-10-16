// Attachments and notifications (src/Modules/Documents/.../Api/DocumentsEndpoints.cs).
import { request, upload } from './auth';

export interface Attachment {
  id: string;
  documentType: string;
  fileName: string;
  contentType: string;
  size: number;
  expiresOn: string | null;
  notes: string | null;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Notification {
  id: string;
  kind: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  link: string | null;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationPage {
  unreadCount: number;
  items: Notification[];
}

export interface UploadInput {
  ownerType: string;
  ownerId: string;
  documentType: string;
  file: File;
  expiresOn: string | null;
  notes: string;
}

const base = '/api/v1/documents';

/** Accepted file kinds (the server also checks the file's content). */
export const acceptedFiles = '.pdf,.png,.jpg,.jpeg,.docx,.xlsx';

export interface DocumentType {
  code: string;
  nameAr: string;
  nameEn: string;
}

export const documentsApi = {
  documentTypes: () => request<DocumentType[]>('GET', `${base}/document-types`),
  attachments: (ownerType: string, ownerId: string) =>
    request<Attachment[]>('GET', `${base}/attachments?ownerType=${encodeURIComponent(ownerType)}&ownerId=${encodeURIComponent(ownerId)}`),
  upload: (input: UploadInput) => {
    const form = new FormData();
    form.append('ownerType', input.ownerType);
    form.append('ownerId', input.ownerId);
    form.append('documentType', input.documentType);
    if (input.expiresOn) {
      form.append('expiresOn', input.expiresOn);
    }
    form.append('notes', input.notes);
    form.append('file', input.file);
    return upload<Attachment>(`${base}/attachments`, form);
  },
  /** Same-origin link: the session cookie authorizes the download. */
  contentUrl: (id: string) => `${base}/attachments/${id}/content`,
  remove: (id: string) => request<void>('DELETE', `${base}/attachments/${id}`),

  notifications: () => request<NotificationPage>('GET', `${base}/notifications`),
  markRead: (id: string) => request<void>('POST', `${base}/notifications/${id}/read`),
  markAllRead: () => request<void>('POST', `${base}/notifications/read-all`),
};
