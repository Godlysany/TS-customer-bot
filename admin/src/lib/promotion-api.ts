import { api } from './api';

export interface Promotion {
  id?: string;
  name: string;
  description?: string;
  promotion_type: 'service_discount' | 'voucher' | 'reactivation';
  service_id?: string | null;
  applies_to_all_services: boolean;
  discount_type: 'fixed_chf' | 'percentage';
  discount_value: number;
  max_discount_chf?: number | null;
  voucher_code?: string | null;
  code_required: boolean;
  valid_from?: string;
  valid_until?: string | null;
  max_uses?: number | null;
  uses_count?: number;
  max_uses_per_customer?: number;
  target_audience?: any;
  bot_can_offer: boolean;
  bot_max_chf: number;
  requires_admin_approval: boolean;
  is_active: boolean;
  created_by?: string;
}

export interface PromotionPerformance {
  id: string;
  name: string;
  voucher_code: string;
  discount_type: string;
  discount_value: number;
  uses_count: number;
  max_uses: number;
  actual_uses: number;
  total_discount_given_chf: number;
  total_revenue_chf: number;
  avg_discount_chf: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string;
}

export const promotionApi = {
  create: (promotion: Promotion) =>
    api.post('/promotions', promotion),

  update: (id: string, updates: Partial<Promotion>) =>
    api.put(`/promotions/${id}`, updates),

  getAll: (filters?: { isActive?: boolean; serviceId?: string; promotionType?: string }) =>
    api.get('/promotions', { params: filters }),

  getActive: () =>
    api.get('/promotions/active'),

  getByCode: (code: string) =>
    api.get(`/promotions/code/${code}`),

  validate: (data: {
    promotion_id: string;
    original_price_chf: number;
    service_id?: string;
    contact_id: string;
  }) =>
    api.post('/promotions/validate', data),

  apply: (data: {
    promotion_id: string;
    contact_id: string;
    service_id?: string;
    original_price_chf: number;
    booking_id: string;
    offered_by?: string;
  }) =>
    api.post('/promotions/apply', data),

  getPerformance: (promotionId?: string) =>
    api.get('/promotions/performance', { params: { promotionId } }),

  getContactHistory: (contactId: string) =>
    api.get(`/promotions/contact/${contactId}/history`),

  deactivate: (id: string) =>
    api.delete(`/promotions/${id}/deactivate`),
};
