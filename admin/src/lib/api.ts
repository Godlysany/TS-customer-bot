import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export const conversationsApi = {
  getAll: () => api.get('/conversations'),
  getById: (id: string) => api.get(`/conversations/${id}`),
  getMessages: (id: string) => api.get(`/conversations/${id}/messages`),
  sendMessage: (id: string, message: string) => 
    api.post(`/conversations/${id}/messages`, { content: message }),
  escalate: (id: string, reason: string) => 
    api.post(`/conversations/${id}/escalate`, { reason }),
  resolve: (id: string) => 
    api.post(`/conversations/${id}/resolve`),
  takeover: (id: string, mode: string, agentId: string) =>
    api.post(`/conversations/${id}/takeover`, { mode, agentId }),
  endTakeover: (id: string) =>
    api.post(`/conversations/${id}/takeover/end`),
  getTakeoverStatus: (id: string) =>
    api.get(`/conversations/${id}/takeover/status`),
};

export const settingsApi = {
  getAll: (category?: string) => 
    api.get('/settings', { params: { category } }),
  update: (key: string, value: string, isSecret = false) => 
    api.put(`/settings/${key}`, { value, isSecret }),
  toggleBot: () => 
    api.post('/settings/bot/toggle'),
  getWhatsAppStatus: () => 
    api.get('/settings/whatsapp/status'),
  connectWhatsApp: () =>
    api.post('/whatsapp/connect'),
  disconnectWhatsApp: () =>
    api.post('/whatsapp/disconnect'),
};

export const analyticsApi = {
  getCustomer: (contactId: string) => 
    api.get(`/contacts/${contactId}/analytics`),
  refresh: (contactId: string) => 
    api.post(`/contacts/${contactId}/analytics/refresh`),
};

export const marketingApi = {
  filterContacts: (criteria: any) => 
    api.post('/marketing/filter', criteria),
  createCampaign: (data: any) => 
    api.post('/marketing/campaigns', data),
  getCampaigns: () => 
    api.get('/marketing/campaigns'),
};

export const bookingsApi = {
  getAll: () => api.get('/bookings'),
  cancel: (id: string, reason: string) => 
    api.post(`/bookings/${id}/cancel`, { reason }),
};

export const promptsApi = {
  getAll: () => api.get('/prompts'),
  create: (data: any) => api.post('/prompts', data),
  activate: (id: string) => api.put(`/prompts/${id}/activate`),
};

export const dashboardApi = {
  getStats: (startDate?: string, endDate?: string) => 
    api.get('/dashboard/stats', { params: { startDate, endDate } }),
};

export const waitlistApi = {
  getAll: () => api.get('/waitlist'),
  add: (data: any) => api.post('/waitlist', data),
  cancel: (id: string) => api.post(`/waitlist/${id}/cancel`),
};

export const questionnaireApi = {
  getAll: (triggerType?: string) => 
    api.get('/questionnaires', { params: { triggerType } }),
  create: (data: any) => api.post('/questionnaires', data),
  getResponses: (contactId: string) => 
    api.get(`/contacts/${contactId}/questionnaires`),
  saveResponse: (data: any) => api.post('/questionnaires/responses', data),
};

export const reviewApi = {
  getStats: (startDate?: string, endDate?: string) => 
    api.get('/reviews/stats', { params: { startDate, endDate } }),
  saveFeedback: (bookingId: string, data: any) => 
    api.post(`/reviews/${bookingId}/feedback`, data),
};
