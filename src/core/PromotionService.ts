import { supabase } from '../infrastructure/supabase';

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

export interface PromotionApplication {
  promotion_id: string;
  original_price_chf: number;
  service_id?: string;
  contact_id: string;
}

export interface PromotionApplicationResult {
  valid: boolean;
  discount_chf: number;
  final_price_chf: number;
  error?: string;
}

class PromotionService {
  /**
   * Create a new promotion
   */
  async createPromotion(promotion: Promotion, createdBy: string): Promise<{ id: string }> {
    try {
      // Validate discount value
      if (promotion.discount_value <= 0) {
        throw new Error('Discount value must be positive');
      }

      if (promotion.discount_type === 'percentage' && promotion.discount_value > 100) {
        throw new Error('Percentage discount cannot exceed 100%');
      }

      // Validate voucher code uniqueness if provided
      if (promotion.voucher_code) {
        const { data: existing } = await supabase
          .from('promotions')
          .select('id')
          .eq('voucher_code', promotion.voucher_code)
          .single();

        if (existing) {
          throw new Error('Voucher code already exists');
        }
      }

      const { data, error } = await supabase
        .from('promotions')
        .insert({
          ...promotion,
          created_by: createdBy,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error creating promotion:', error);
      throw error;
    }
  }

  /**
   * Update an existing promotion
   */
  async updatePromotion(id: string, updates: Partial<Promotion>): Promise<void> {
    try {
      const { error } = await supabase
        .from('promotions')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating promotion:', error);
      throw error;
    }
  }

  /**
   * Get all active promotions
   */
  async getActivePromotions(): Promise<Promotion[]> {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString()}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching active promotions:', error);
      return [];
    }
  }

  /**
   * Get promotion by voucher code
   */
  async getPromotionByCode(code: string): Promise<Promotion | null> {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('voucher_code', code)
        .eq('is_active', true)
        .single();

      if (error) return null;
      return data;
    } catch (error: any) {
      console.error('Error fetching promotion by code:', error);
      return null;
    }
  }

  /**
   * Validate if a promotion can be applied to a booking
   */
  async validatePromotion(application: PromotionApplication): Promise<PromotionApplicationResult> {
    try {
      const { data: promotion, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('id', application.promotion_id)
        .single();

      if (error || !promotion) {
        return { valid: false, discount_chf: 0, final_price_chf: application.original_price_chf, error: 'Promotion not found' };
      }

      // Check if active
      if (!promotion.is_active) {
        return { valid: false, discount_chf: 0, final_price_chf: application.original_price_chf, error: 'Promotion is inactive' };
      }

      // Check validity dates
      const now = new Date();
      const validFrom = new Date(promotion.valid_from);
      const validUntil = promotion.valid_until ? new Date(promotion.valid_until) : null;

      if (now < validFrom) {
        return { valid: false, discount_chf: 0, final_price_chf: application.original_price_chf, error: 'Promotion not yet valid' };
      }

      if (validUntil && now > validUntil) {
        return { valid: false, discount_chf: 0, final_price_chf: application.original_price_chf, error: 'Promotion expired' };
      }

      // Check max uses
      if (promotion.max_uses !== null && promotion.uses_count >= promotion.max_uses) {
        return { valid: false, discount_chf: 0, final_price_chf: application.original_price_chf, error: 'Promotion usage limit reached' };
      }

      // Check service eligibility
      if (!promotion.applies_to_all_services && application.service_id !== promotion.service_id) {
        return { valid: false, discount_chf: 0, final_price_chf: application.original_price_chf, error: 'Promotion not valid for this service' };
      }

      // Check per-customer usage limit
      if (promotion.max_uses_per_customer) {
        const { count } = await supabase
          .from('promotion_usage')
          .select('*', { count: 'exact', head: true })
          .eq('promotion_id', application.promotion_id)
          .eq('contact_id', application.contact_id);

        if (count !== null && count >= promotion.max_uses_per_customer) {
          return { valid: false, discount_chf: 0, final_price_chf: application.original_price_chf, error: 'Customer usage limit reached' };
        }
      }

      // Calculate discount
      let discountChf = 0;
      if (promotion.discount_type === 'fixed_chf') {
        discountChf = promotion.discount_value;
      } else if (promotion.discount_type === 'percentage') {
        discountChf = (application.original_price_chf * promotion.discount_value) / 100;
        // Apply max cap if set
        if (promotion.max_discount_chf && discountChf > promotion.max_discount_chf) {
          discountChf = promotion.max_discount_chf;
        }
      }

      // Ensure discount doesn't exceed original price
      discountChf = Math.min(discountChf, application.original_price_chf);
      const finalPrice = Math.max(0, application.original_price_chf - discountChf);

      return {
        valid: true,
        discount_chf: discountChf,
        final_price_chf: finalPrice,
      };
    } catch (error: any) {
      console.error('Error validating promotion:', error);
      return { valid: false, discount_chf: 0, final_price_chf: application.original_price_chf, error: 'Validation error' };
    }
  }

  /**
   * Apply promotion to a booking and track usage
   */
  async applyPromotionToBooking(
    application: PromotionApplication,
    bookingId: string,
    offeredBy: 'bot_autonomous' | 'bot_approved' | 'agent' | 'customer_entered'
  ): Promise<PromotionApplicationResult> {
    try {
      // Validate first
      const validation = await this.validatePromotion(application);
      if (!validation.valid) {
        return validation;
      }

      // Track usage
      await supabase.from('promotion_usage').insert({
        promotion_id: application.promotion_id,
        contact_id: application.contact_id,
        booking_id: bookingId,
        discount_applied_chf: validation.discount_chf,
        original_price_chf: application.original_price_chf,
        final_price_chf: validation.final_price_chf,
        offered_by: offeredBy,
      });

      // Note: The database trigger will auto-increment uses_count

      return validation;
    } catch (error: any) {
      console.error('Error applying promotion to booking:', error);
      return { valid: false, discount_chf: 0, final_price_chf: application.original_price_chf, error: 'Failed to apply promotion' };
    }
  }

  /**
   * Get promotions eligible for bot to offer autonomously
   */
  async getBotOfferablePromotions(maxChf: number): Promise<Promotion[]> {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .eq('bot_can_offer', true)
        .lte('bot_max_chf', maxChf)
        .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString()}`);

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching bot offerable promotions:', error);
      return [];
    }
  }

  /**
   * Get promotion usage history for a contact
   */
  async getContactPromotionHistory(contactId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('promotion_usage')
        .select(`
          *,
          promotions:promotion_id (name, voucher_code, discount_type, discount_value)
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching contact promotion history:', error);
      return [];
    }
  }

  /**
   * Get promotion performance analytics
   */
  async getPromotionPerformance(promotionId?: string): Promise<any[]> {
    try {
      let query = supabase.from('promotion_performance').select('*');
      
      if (promotionId) {
        query = query.eq('id', promotionId);
      }

      const { data, error } = await query.order('total_revenue_chf', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching promotion performance:', error);
      return [];
    }
  }

  /**
   * Deactivate a promotion
   */
  async deactivatePromotion(id: string): Promise<void> {
    try {
      await this.updatePromotion(id, { is_active: false });
    } catch (error: any) {
      console.error('Error deactivating promotion:', error);
      throw error;
    }
  }

  /**
   * Get all promotions (with filters)
   */
  async getAllPromotions(filters?: {
    isActive?: boolean;
    serviceId?: string;
    promotionType?: string;
  }): Promise<Promotion[]> {
    try {
      let query = supabase.from('promotions').select('*');

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      if (filters?.serviceId) {
        query = query.or(`service_id.eq.${filters.serviceId},applies_to_all_services.eq.true`);
      }

      if (filters?.promotionType) {
        query = query.eq('promotion_type', filters.promotionType);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching all promotions:', error);
      return [];
    }
  }
}

export default new PromotionService();
