"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngagementService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
class EngagementService {
    async getActiveCampaigns() {
        const { data, error } = await supabase_1.supabase
            .from('proactive_campaigns')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching active campaigns:', error);
            return [];
        }
        return (data || []).map(mapper_1.toCamelCase);
    }
    async findTargetCustomers(campaign) {
        const targets = [];
        if (campaign.campaignType === 'reactivation') {
            const reactivationTargets = await this.findReactivationTargets(campaign.triggerDays || 90, campaign.serviceId);
            targets.push(...reactivationTargets.map(t => ({
                ...t,
                campaignId: campaign.id,
            })));
        }
        else if (campaign.campaignType === 'routine_reminder') {
            const routineTargets = await this.findRoutineReminderTargets(campaign.triggerDays || 30, campaign.serviceId);
            targets.push(...routineTargets.map(t => ({
                ...t,
                campaignId: campaign.id,
            })));
        }
        return targets;
    }
    async findReactivationTargets(inactiveDays, serviceId) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
        let query = supabase_1.supabase
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
        const contactMap = new Map();
        for (const booking of bookings || []) {
            if (!contactMap.has(booking.contact_id)) {
                const lastBookingDate = new Date(booking.start_time);
                const daysSince = Math.floor((Date.now() - lastBookingDate.getTime()) / (1000 * 60 * 60 * 24));
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
        const { data: recentBookings } = await supabase_1.supabase
            .from('bookings')
            .select('contact_id')
            .in('contact_id', contactIds)
            .gte('start_time', cutoffDate.toISOString())
            .eq('status', 'confirmed');
        const recentContactIds = new Set((recentBookings || []).map(b => b.contact_id));
        return Array.from(contactMap.values()).filter(target => !recentContactIds.has(target.contactId));
    }
    async findRoutineReminderTargets(daysSinceService, serviceId) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysSinceService);
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - (daysSinceService + 7));
        let query = supabase_1.supabase
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
        const targets = [];
        for (const booking of bookings || []) {
            const lastBookingDate = new Date(booking.start_time);
            const daysSince = Math.floor((Date.now() - lastBookingDate.getTime()) / (1000 * 60 * 60 * 24));
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
    formatMessage(template, target) {
        return template
            .replace(/\{name\}/g, target.name || 'valued customer')
            .replace(/\{service\}/g, target.serviceName || 'service')
            .replace(/\{days\}/g, target.daysSinceLastBooking.toString());
    }
    async recordCampaignSent(campaignId, totalSent) {
        await supabase_1.supabase
            .from('proactive_campaigns')
            .update((0, mapper_1.toSnakeCase)({
            lastRunAt: new Date().toISOString(),
            totalSent,
            updatedAt: new Date().toISOString(),
        }))
            .eq('id', campaignId);
    }
    async createCampaign(campaign) {
        const { data, error } = await supabase_1.supabase
            .from('proactive_campaigns')
            .insert([(0, mapper_1.toSnakeCase)(campaign)])
            .select()
            .single();
        if (error) {
            console.error('Error creating campaign:', error);
            return null;
        }
        return (0, mapper_1.toCamelCase)(data);
    }
    async updateCampaign(id, updates) {
        const { data, error } = await supabase_1.supabase
            .from('proactive_campaigns')
            .update((0, mapper_1.toSnakeCase)(updates))
            .eq('id', id)
            .select()
            .single();
        if (error) {
            console.error('Error updating campaign:', error);
            return null;
        }
        return (0, mapper_1.toCamelCase)(data);
    }
    async deleteCampaign(id) {
        const { error } = await supabase_1.supabase
            .from('proactive_campaigns')
            .delete()
            .eq('id', id);
        if (error) {
            console.error('Error deleting campaign:', error);
            return false;
        }
        return true;
    }
    async getCampaignById(id) {
        const { data, error } = await supabase_1.supabase
            .from('proactive_campaigns')
            .select('*')
            .eq('id', id)
            .single();
        if (error) {
            console.error('Error fetching campaign:', error);
            return null;
        }
        return (0, mapper_1.toCamelCase)(data);
    }
    async getAllCampaigns() {
        const { data, error } = await supabase_1.supabase
            .from('proactive_campaigns')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching campaigns:', error);
            return [];
        }
        return (data || []).map(mapper_1.toCamelCase);
    }
}
exports.EngagementService = EngagementService;
