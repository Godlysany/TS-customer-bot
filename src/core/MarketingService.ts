import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toCamelCaseArray } from '../infrastructure/mapper';

export interface MarketingFilter {
  intent?: string[];
  lastInteractionDays?: number;
  appointmentStatus?: 'upcoming' | 'past_x_days' | 'no_appointment';
  pastDaysCount?: number;
  sentimentScore?: { min?: number; max?: number };
  upsellPotential?: ('low' | 'medium' | 'high')[];
}

export class MarketingService {
  async getFilteredContacts(filters: MarketingFilter): Promise<any[]> {
    let query = supabase
      .from('contacts')
      .select(`
        *,
        conversations(*),
        customer_analytics(*),
        bookings(*)
      `);

    const { data, error } = await query;
    if (error) throw error;

    let filtered = data || [];

    if (filters.lastInteractionDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filters.lastInteractionDays);
      
      filtered = filtered.filter(contact => {
        const lastConversation = contact.conversations?.[0];
        if (!lastConversation) return false;
        return new Date(lastConversation.last_message_at) <= cutoffDate;
      });
    }

    if (filters.appointmentStatus === 'no_appointment') {
      filtered = filtered.filter(contact => !contact.bookings || contact.bookings.length === 0);
    }

    if (filters.appointmentStatus === 'upcoming') {
      const now = new Date();
      filtered = filtered.filter(contact => 
        contact.bookings?.some((b: any) => new Date(b.start_time) > now)
      );
    }

    if (filters.appointmentStatus === 'past_x_days' && filters.pastDaysCount) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filters.pastDaysCount);
      
      filtered = filtered.filter(contact =>
        contact.bookings?.some((b: any) => 
          new Date(b.start_time) >= cutoffDate && new Date(b.start_time) <= new Date()
        )
      );
    }

    if (filters.upsellPotential) {
      filtered = filtered.filter(contact =>
        contact.customer_analytics && 
        filters.upsellPotential!.includes(contact.customer_analytics.upsell_potential)
      );
    }

    if (filters.sentimentScore) {
      filtered = filtered.filter(contact => {
        if (!contact.customer_analytics?.sentiment_score) return false;
        const score = contact.customer_analytics.sentiment_score;
        if (filters.sentimentScore!.min && score < filters.sentimentScore!.min) return false;
        if (filters.sentimentScore!.max && score > filters.sentimentScore!.max) return false;
        return true;
      });
    }

    return toCamelCaseArray(filtered);
  }

  async createCampaign(name: string, messageTemplate: string, filterCriteria: MarketingFilter, scheduledAt?: Date, createdBy?: string) {
    const contacts = await this.getFilteredContacts(filterCriteria);

    const { data, error } = await supabase
      .from('marketing_campaigns')
      .insert({
        name,
        message_template: messageTemplate,
        filter_criteria: filterCriteria,
        scheduled_at: scheduledAt?.toISOString(),
        total_recipients: contacts.length,
        created_by: createdBy,
        status: scheduledAt ? 'scheduled' : 'draft'
      })
      .select()
      .single();

    if (error) throw error;
    return toCamelCase(data);
  }

  async getCampaigns() {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return toCamelCaseArray(data || []);
  }
}

export default new MarketingService();
