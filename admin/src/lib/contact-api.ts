import { api } from './api';

export interface Contact {
  id?: string;
  phone_number: string;
  name?: string;
  email?: string;
  preferred_language?: string;
  source?: 'whatsapp' | 'manual' | 'csv_import';
  import_batch_id?: string;
  notes?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface CSVImportResult {
  batch_id: string;
  total_rows: number;
  successful_imports: number;
  failed_imports: number;
  errors: Array<{ row: number; error: string; data: any }>;
}

export interface ContactStats {
  total: number;
  whatsapp: number;
  manual: number;
  csv_import: number;
  with_conversations: number;
  without_conversations: number;
}

export const contactApi = {
  create: (contact: Contact) =>
    api.post('/contacts', contact),

  update: (id: string, updates: Partial<Contact>) =>
    api.put(`/contacts/${id}`, updates),

  getAll: (filters?: {
    source?: string;
    hasConversation?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  }) =>
    api.get('/contacts', { params: filters }),

  getById: (id: string) =>
    api.get(`/contacts/${id}`),

  search: (query: string, limit?: number) =>
    api.get(`/contacts/search/${query}`, { params: { limit } }),

  getStats: () =>
    api.get<ContactStats>('/contacts/stats/summary'),

  bulkUpload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<CSVImportResult>('/contacts/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getImportBatches: (uploadedBy?: string) =>
    api.get('/contacts/import-batches', { params: { uploadedBy } }),

  getBatchContacts: (batchId: string) =>
    api.get(`/contacts/batch/${batchId}`),

  delete: (id: string) =>
    api.delete(`/contacts/${id}`),
};
