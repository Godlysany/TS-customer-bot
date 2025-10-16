import { api } from './api';

export interface PaymentLinkRequest {
  booking_id: string;
  contact_id: string;
  amount_chf: number;
  original_amount_chf?: number;
  promotion_id?: string;
  discount_chf?: number;
  description: string;
  metadata?: Record<string, string>;
}

export interface PaymentLinkResult {
  payment_link_id: string;
  checkout_url: string;
  stripe_session_id: string;
  expires_at: string;
}

export interface PaymentLink {
  id: string;
  booking_id: string;
  contact_id: string;
  stripe_checkout_session_id: string;
  stripe_payment_intent_id?: string;
  checkout_url: string;
  amount_chf: number;
  original_amount_chf?: number;
  promotion_id?: string;
  discount_applied_chf: number;
  payment_status: 'pending' | 'paid' | 'expired' | 'cancelled';
  expires_at: string;
  paid_at?: string;
  sent_via_whatsapp: boolean;
  whatsapp_message_id?: string;
  created_at: string;
  updated_at: string;
}

export const paymentApi = {
  createLink: (request: PaymentLinkRequest) =>
    api.post<PaymentLinkResult>('/payments/create-link', request),

  getLink: (id: string) =>
    api.get<PaymentLink>(`/payments/links/${id}`),

  getBookingLinks: (bookingId: string) =>
    api.get<PaymentLink[]>(`/payments/booking/${bookingId}`),

  markSent: (id: string, whatsappMessageId: string) =>
    api.post(`/payments/mark-sent/${id}`, { whatsapp_message_id: whatsappMessageId }),

  cancel: (id: string) =>
    api.delete(`/payments/cancel/${id}`),
};
