import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_BASE_URL ? `${API_BASE_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export const authApi = {
  me: () => api.get('/auth/me'),
  login: (email: string, password: string) => 
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
};

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
  takeover: (id: string, type: string, agentId: string) =>
    api.post(`/conversations/${id}/takeover`, { type, agentId }),
  endTakeover: (id: string) =>
    api.post(`/conversations/${id}/takeover/end`),
  getTakeoverStatus: (id: string) =>
    api.get(`/conversations/${id}/takeover/status`),
};

export const settingsApi = {
  getAll: (category?: string) => 
    api.get('/settings', { params: { category } }),
  update: (key: string, value: string, isSecret = false, category = 'bot_config') => 
    api.put(`/settings/${key}`, { value, isSecret, category }),
  toggleBot: () => 
    api.post('/settings/bot/toggle'),
  getWhatsAppStatus: () => 
    api.get('/settings/whatsapp/status'),
  getWhatsAppQr: () => 
    api.get('/settings/whatsapp/qr'),
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
  updateStatus: (id: string, status: string) =>
    api.patch(`/bookings/${id}/status`, { status }),
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
  update: (id: string, data: any) => api.put(`/questionnaires/${id}`, data),
  delete: (id: string) => api.delete(`/questionnaires/${id}`),
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

export const botConfigApi = {
  // Business Details
  getBusinessDetails: () => api.get('/bot-config/business-details'),
  saveBusinessDetails: (data: any) => api.post('/bot-config/business-details', data),
  
  // GPT Prompts & Tone
  getPromptConfig: () => api.get('/bot-config/prompt-config'),
  savePromptConfig: (data: any) => api.post('/bot-config/prompt-config', data),
  getMasterPrompt: () => api.get('/bot-config/master-prompt'),
  
  // Escalation Configuration
  getEscalationConfig: () => api.get('/bot-config/escalation'),
  saveEscalationConfig: (data: any) => api.post('/bot-config/escalation', data),
  testEscalation: (message: string) => api.post('/bot-config/escalation/test', { message }),
  
  // Confirmation Templates
  getConfirmationTemplates: () => api.get('/bot-config/confirmations'),
  saveConfirmationTemplates: (data: any) => api.post('/bot-config/confirmations', data),
  
  // Service Configuration
  getServiceConfig: () => api.get('/bot-config/services'),
  saveServiceConfig: (data: any) => api.post('/bot-config/services', data),
  
  // Email Collection
  getEmailConfig: () => api.get('/bot-config/email-collection'),
  saveEmailConfig: (data: any) => api.post('/bot-config/email-collection', data),
  
  // Legacy endpoints (keep for backward compatibility)
  getContext: () => api.get('/bot-config/context'),
  saveContext: (data: any) => api.post('/bot-config/context', data),
  getPrompts: () => api.get('/bot-config/prompts'),
  savePrompts: (data: any) => api.post('/bot-config/prompts', data),
  getQuestionnaires: () => api.get('/bot-config/questionnaires'),
  saveQuestionnaire: (data: any) => api.post('/bot-config/questionnaires', data),
  getControls: () => api.get('/bot-config/controls'),
  saveControls: (data: any) => api.post('/bot-config/controls', data),
};

export const customersApi = {
  getAll: () => api.get('/customers'),
  getById: (id: string) => api.get(`/customers/${id}`),
  getQuestionnaires: (id: string) => api.get(`/customers/${id}/questionnaires`),
  getServiceHistory: (id: string) => api.get(`/customers/${id}/service-history`),
};

export const questionnaireResponsesApi = {
  getAll: () => api.get('/questionnaire-responses'),
  getById: (id: string) => api.get(`/questionnaire-responses/${id}`),
};

export const messageApprovalApi = {
  getPending: () => api.get('/message-approval/pending'),
  approve: (id: string) => api.post(`/message-approval/${id}/approve`),
  reject: (id: string) => api.post(`/message-approval/${id}/reject`),
};

export const servicesApi = {
  getAll: () => api.get('/services'),
  getById: (id: string) => api.get(`/services/${id}`),
  create: (data: any) => api.post('/services', data),
  update: (id: string, data: any) => api.put(`/services/${id}`, data),
  delete: (id: string) => api.delete(`/services/${id}`),
  
  // Booking Windows (Phase 4)
  getBookingWindows: (serviceId: string) => api.get(`/services/${serviceId}/booking-windows`),
  replaceBookingWindows: (serviceId: string, windows: any[]) => 
    api.put(`/services/${serviceId}/booking-windows`, { windows }),
  createBookingWindow: (serviceId: string, window: any) => 
    api.post(`/services/${serviceId}/booking-windows`, window),
  updateBookingWindow: (windowId: string, updates: any) => 
    api.patch(`/services/booking-windows/${windowId}`, updates),
  deleteBookingWindow: (windowId: string) => 
    api.delete(`/services/booking-windows/${windowId}`),
  
  // Service Blockers (Phase 4)
  getBlockers: (serviceId: string) => api.get(`/services/${serviceId}/blockers`),
  createBlocker: (serviceId: string, blocker: any) => 
    api.post(`/services/${serviceId}/blockers`, blocker),
  updateBlocker: (blockerId: string, updates: any) => 
    api.patch(`/services/blockers/${blockerId}`, updates),
  deleteBlocker: (blockerId: string) => 
    api.delete(`/services/blockers/${blockerId}`),
  
  // Validation
  validateBookingTime: (serviceId: string, dateTime: string) =>
    api.post(`/services/${serviceId}/validate-time`, { dateTime }),
};

export const escalationsApi = {
  getAll: (filters?: { status?: string; agent_id?: string }) => 
    api.get('/escalations', { params: filters }),
  getById: (id: string) => api.get(`/escalations/${id}`),
  create: (conversationId: string, reason?: string) => 
    api.post('/escalations', { conversation_id: conversationId, reason }),
  assign: (id: string, agentId: string) => 
    api.post(`/escalations/${id}/assign`, { agent_id: agentId }),
  updateStatus: (id: string, status: string) => 
    api.put(`/escalations/${id}/status`, { status }),
  resolve: (id: string) => 
    api.post(`/escalations/${id}/resolve`),
  reply: (id: string, content: string) =>
    api.post(`/escalations/${id}/reply`, { content }),
  getCounts: () => 
    api.get('/escalations-stats/counts'),
};

export const calendarApi = {
  getStatus: () => api.get('/calendar/status'),
  disconnect: () => api.post('/calendar/disconnect'),
};

export const nurturingApi = {
  getSettings: () => api.get('/nurturing/settings'),
  getSetting: (key: string) => api.get(`/nurturing/settings/${key}`),
  updateSetting: (key: string, value: string) => api.put(`/nurturing/settings/${key}`, { value }),
  getStats: (startDate?: string, endDate?: string) => 
    api.get('/nurturing/stats', { params: { startDate, endDate } }),
  getContactProfile: (contactId: string) => api.get(`/nurturing/contacts/${contactId}/profile`),
  getContactActivities: (contactId: string, limit?: number) => 
    api.get(`/nurturing/contacts/${contactId}/activities`, { params: { limit } }),
  updateContactBirthdate: (contactId: string, birthdate: string | null) => 
    api.put(`/nurturing/contacts/${contactId}/birthdate`, { birthdate }),
  updateContactPreferences: (contactId: string, preferences: any) => 
    api.put(`/nurturing/contacts/${contactId}/preferences`, preferences),
  getBirthdayContacts: () => api.get('/nurturing/birthday-contacts'),
  getReviewEligibleContacts: () => api.get('/nurturing/review-eligible-contacts'),
};
