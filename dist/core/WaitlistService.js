"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitlistService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
class WaitlistService {
    async addToWaitlist(data) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        const { data: entry, error } = await supabase_1.supabase
            .from('waitlist')
            .insert((0, mapper_1.toSnakeCase)({
            contactId: data.contactId,
            preferredDates: data.preferredDates || [],
            serviceType: data.serviceType,
            priority: data.priority || 'normal',
            status: 'active',
            expiresAt,
            notes: data.notes,
        }))
            .select()
            .single();
        if (error)
            throw new Error(`Failed to add to waitlist: ${error.message}`);
        return (0, mapper_1.toCamelCase)(entry);
    }
    async findMatchingWaitlistEntries(cancelledBooking) {
        const { data, error } = await supabase_1.supabase
            .from('waitlist')
            .select('*, contacts(name, phone_number)')
            .eq('status', 'active')
            .lte('created_at', new Date().toISOString())
            .gte('expires_at', new Date().toISOString());
        if (error)
            throw new Error(`Failed to find waitlist matches: ${error.message}`);
        const entries = (data || []).map(mapper_1.toCamelCase);
        return entries
            .filter(entry => {
            if (entry.serviceType && cancelledBooking.serviceType) {
                return entry.serviceType === cancelledBooking.serviceType;
            }
            if (entry.preferredDates && entry.preferredDates.length > 0) {
                return entry.preferredDates.some((range) => {
                    const rangeStart = new Date(range.start);
                    const rangeEnd = new Date(range.end);
                    return cancelledBooking.startTime >= rangeStart &&
                        cancelledBooking.startTime <= rangeEnd;
                });
            }
            return true;
        })
            .sort((a, b) => {
            const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
    }
    async notifyWaitlistMatches(cancelledBooking, sendMessage) {
        const matches = await this.findMatchingWaitlistEntries(cancelledBooking);
        let notifiedCount = 0;
        for (const entry of matches) {
            try {
                const { data: contact } = await supabase_1.supabase
                    .from('contacts')
                    .select('name, phone_number')
                    .eq('id', entry.contactId)
                    .single();
                if (!contact)
                    continue;
                const message = `Hi ${contact.name || 'there'}! A ${cancelledBooking.title || 'appointment'} slot has opened up on ${new Date(cancelledBooking.startTime).toLocaleDateString('en-US', { dateStyle: 'full', timeStyle: 'short' })}. Would you like to book it? Reply YES to confirm.`;
                await sendMessage(contact.phone_number, message);
                await supabase_1.supabase
                    .from('waitlist')
                    .update((0, mapper_1.toSnakeCase)({ notifiedAt: new Date() }))
                    .eq('id', entry.id);
                notifiedCount++;
            }
            catch (error) {
                console.error(`Failed to notify waitlist entry ${entry.id}:`, error);
            }
        }
        return notifiedCount;
    }
    async matchWaitlistToBooking(waitlistId, bookingId) {
        await supabase_1.supabase
            .from('waitlist')
            .update((0, mapper_1.toSnakeCase)({
            status: 'matched',
            matchedBookingId: bookingId,
        }))
            .eq('id', waitlistId);
    }
    async getActiveWaitlist() {
        const { data, error } = await supabase_1.supabase
            .from('waitlist')
            .select('*, contacts(name, phone_number, email)')
            .eq('status', 'active')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: true });
        if (error)
            throw new Error(`Failed to get waitlist: ${error.message}`);
        return (data || []).map(mapper_1.toCamelCase);
    }
    async cancelWaitlistEntry(id) {
        await supabase_1.supabase
            .from('waitlist')
            .update((0, mapper_1.toSnakeCase)({ status: 'cancelled' }))
            .eq('id', id);
    }
    async expireOldEntries() {
        const { data } = await supabase_1.supabase
            .from('waitlist')
            .update((0, mapper_1.toSnakeCase)({ status: 'expired' }))
            .eq('status', 'active')
            .lt('expires_at', new Date().toISOString())
            .select();
        return data?.length || 0;
    }
}
exports.WaitlistService = WaitlistService;
