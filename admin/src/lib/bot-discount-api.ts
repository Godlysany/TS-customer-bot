import { api } from './api';

export interface BotDiscountRequest {
  id: string;
  contact_id: string;
  conversation_id?: string;
  recommended_discount_chf: number;
  recommended_service_id?: string;
  reason: string;
  bot_confidence?: number;
  customer_sentiment?: string;
  days_inactive?: number;
  total_bookings?: number;
  total_spent_chf?: number;
  last_interaction_at?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewed_by?: string;
  reviewed_at?: string;
  admin_notes?: string;
  created_promotion_id?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  contacts?: { name: string; phone_number: string; email?: string };
  services?: { name: string };
}

export interface BotDiscountAnalytics {
  total_requests: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  avg_discount_chf: number;
  approval_rate: number;
}

export const botDiscountApi = {
  getPending: () =>
    api.get<BotDiscountRequest[]>('/bot-discounts/pending'),

  approve: (id: string, adminNotes?: string) =>
    api.post(`/bot-discounts/${id}/approve`, { admin_notes: adminNotes }),

  reject: (id: string, adminNotes: string) =>
    api.post(`/bot-discounts/${id}/reject`, { admin_notes: adminNotes }),

  getHistory: (filters?: { status?: string; contactId?: string; limit?: number }) =>
    api.get<BotDiscountRequest[]>('/bot-discounts/history', { params: filters }),

  getAnalytics: () =>
    api.get<BotDiscountAnalytics>('/bot-discounts/analytics'),

  evaluate: (contactId: string, conversationId: string) =>
    api.post('/bot-discounts/evaluate', { contact_id: contactId, conversation_id: conversationId }),
};
