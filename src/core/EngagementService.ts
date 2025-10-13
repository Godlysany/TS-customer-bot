import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';

export interface ProactiveCampaign {
  id: string;
  name: string;
  campaignType: 'reactivation' | 'routine_reminder' | 'birthday' | 'follow_up' | 'custom';
  targetCriteria: any;
  messageTemplate: string;
  serviceId?: string;
  triggerDays?: number;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  totalSent: number;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface EngagementTarget {
  contactId: string;
  campaignId: string;
  phoneNumber: string;
  name?: string;
  lastBookingDate?: string;
  serviceName?: string;
  daysSinceLastBooking: number;
}

export class EngagementService {
  async getActiveCampaigns(): Promise<ProactiveCampaign[]> {
    const { data, error } = await supabase
      .from('proactive_campaigns')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active campaigns:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as ProactiveCampaign[];
  }

  async findTargetCustomers(campaign: ProactiveCampaign): Promise<EngagementTarget[]> {
    const targets: EngagementTarget[] = [];

    if (campaign.campaignType === 'reactivation') {
      const reactivationTargets = await this.findReactivationTargets(
        campaign.triggerDays || 90,
        campaign.serviceId
      );
      targets.push(
        ...reactivationTargets.map(t => ({
          ...t,
          campaignId: campaign.id,
        }))
      );
    } else if (campaign.campaignType === 'routine_reminder') {
      const routineTargets = await this.findRoutineReminderTargets(
        campaign.triggerDays || 30,
        campaign.serviceId
      );
      targets.push(
        ...routineTargets.map(t => ({
          ...t,
          campaignId: campaign.id,
        }))
      );
    }

    return targets;
  }

  private async findReactivationTargets(
    inactiveDays: number,
    serviceId?: string
  ): Promise<EngagementTarget[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    let query = supabase
      .from('bookings')
      .select(`
        contact_id,
        contacts (phone_number, name),
        start_time,
        services (name)
      `)
      .in('status', ['confirmed', 'cancelled'])
      .lt('start_time', cutoffDate.toISOString())
      .order('start_time', { ascending: false });

    if (serviceId) {
      query = query.eq('service_id', serviceId);
    }

    const { data: bookings, error } = await query;

    if (error) {
      console.error('Error finding reactivation targets:', error);
      return [];
    }

    const contactMap = new Map<string, EngagementTarget>();

    for (const booking of bookings || []) {
      if (!contactMap.has(booking.contact_id)) {
        const lastBookingDate = new Date(booking.start_time);
        const daysSince = Math.floor(
          (Date.now() - lastBookingDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        const contact = Array.isArray(booking.contacts) ? booking.contacts[0] : booking.contacts;
        const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;

        contactMap.set(booking.contact_id, {
          contactId: booking.contact_id,
          campaignId: '',
          phoneNumber: contact?.phone_number || '',
          name: contact?.name,
          lastBookingDate: booking.start_time,
          serviceName: service?.name,
          daysSinceLastBooking: daysSince,
        });
      }
    }

    const contactIds = Array.from(contactMap.keys());
    const { data: recentBookings } = await supabase
      .from('bookings')
      .select('contact_id')
      .in('contact_id', contactIds)
      .gte('start_time', cutoffDate.toISOString())
      .eq('status', 'confirmed');

    const recentContactIds = new Set(
      (recentBookings || []).map(b => b.contact_id)
    );

    return Array.from(contactMap.values()).filter(
      target => !recentContactIds.has(target.contactId)
    );
  }

  private async findRoutineReminderTargets(
    daysSinceService: number,
    serviceId?: string
  ): Promise<EngagementTarget[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceService);

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - (daysSinceService + 7));

    let query = supabase
      .from('bookings')
      .select(`
        contact_id,
        contacts (phone_number, name),
        start_time,
        services (name)
      `)
      .eq('status', 'confirmed')
      .gte('start_time', targetDate.toISOString())
      .lt('start_time', cutoffDate.toISOString())
      .order('start_time', { ascending: false });

    if (serviceId) {
      query = query.eq('service_id', serviceId);
    }

    const { data: bookings, error } = await query;

    if (error) {
      console.error('Error finding routine reminder targets:', error);
      return [];
    }

    const targets: EngagementTarget[] = [];

    for (const booking of bookings || []) {
      const lastBookingDate = new Date(booking.start_time);
      const daysSince = Math.floor(
        (Date.now() - lastBookingDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const contact = Array.isArray(booking.contacts) ? booking.contacts[0] : booking.contacts;
      const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;

      targets.push({
        contactId: booking.contact_id,
        campaignId: '',
        phoneNumber: contact?.phone_number || '',
        name: contact?.name,
        lastBookingDate: booking.start_time,
        serviceName: service?.name,
        daysSinceLastBooking: daysSince,
      });
    }

    return targets;
  }

  formatMessage(template: string, target: EngagementTarget): string {
    return template
      .replace(/\{name\}/g, target.name || 'valued customer')
      .replace(/\{service\}/g, target.serviceName || 'service')
      .replace(/\{days\}/g, target.daysSinceLastBooking.toString());
  }

  async recordCampaignSent(campaignId: string, totalSent: number): Promise<void> {
    await supabase
      .from('proactive_campaigns')
      .update(
        toSnakeCase({
          lastRunAt: new Date().toISOString(),
          totalSent,
          updatedAt: new Date().toISOString(),
        })
      )
      .eq('id', campaignId);
  }

  async createCampaign(campaign: Partial<ProactiveCampaign>): Promise<ProactiveCampaign | null> {
    const { data, error } = await supabase
      .from('proactive_campaigns')
      .insert([toSnakeCase(campaign)])
      .select()
      .single();

    if (error) {
      console.error('Error creating campaign:', error);
      return null;
    }

    return toCamelCase(data) as ProactiveCampaign;
  }

  async updateCampaign(
    id: string,
    updates: Partial<ProactiveCampaign>
  ): Promise<ProactiveCampaign | null> {
    const { data, error } = await supabase
      .from('proactive_campaigns')
      .update(toSnakeCase(updates))
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating campaign:', error);
      return null;
    }

    return toCamelCase(data) as ProactiveCampaign;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('proactive_campaigns')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting campaign:', error);
      return false;
    }

    return true;
  }

  async getCampaignById(id: string): Promise<ProactiveCampaign | null> {
    const { data, error } = await supabase
      .from('proactive_campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching campaign:', error);
      return null;
    }

    return toCamelCase(data) as ProactiveCampaign;
  }

  async getAllCampaigns(): Promise<ProactiveCampaign[]> {
    const { data, error } = await supabase
      .from('proactive_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as ProactiveCampaign[];
  }
}
