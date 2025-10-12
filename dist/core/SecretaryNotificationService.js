"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretaryNotificationService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const SettingsService_1 = require("./SettingsService");
const EmailService_1 = require("./EmailService");
const mapper_1 = require("../infrastructure/mapper");
class SecretaryNotificationService {
    settingsService;
    emailService;
    constructor() {
        this.settingsService = new SettingsService_1.SettingsService();
        this.emailService = new EmailService_1.EmailService();
    }
    async sendDailySummary() {
        const enabled = await this.settingsService.getSetting('daily_summary_enabled');
        if (enabled !== 'true')
            return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const { data: newBookings } = await supabase_1.supabase
            .from('bookings')
            .select('*, contacts(name, phone_number)')
            .gte('created_at', today.toISOString())
            .lt('created_at', tomorrow.toISOString())
            .neq('status', 'cancelled');
        const { data: cancellations } = await supabase_1.supabase
            .from('bookings')
            .select('*, contacts(name, phone_number)')
            .gte('cancelled_at', today.toISOString())
            .lt('cancelled_at', tomorrow.toISOString())
            .eq('status', 'cancelled');
        const { data: changes } = await supabase_1.supabase
            .from('bookings')
            .select('*, contacts(name, phone_number)')
            .gte('updated_at', today.toISOString())
            .lt('updated_at', tomorrow.toISOString())
            .neq('status', 'cancelled')
            .neq('created_at', 'updated_at');
        const totalPenalties = (cancellations || [])
            .filter((b) => b.penalty_applied)
            .reduce((sum, b) => sum + parseFloat(b.penalty_fee || 0), 0);
        const totalDiscounts = [...(newBookings || []), ...(changes || [])]
            .reduce((sum, b) => sum + parseFloat(b.discount_amount || 0), 0);
        const summaryData = {
            newBookings: (newBookings || []).map((b) => ({
                ...(0, mapper_1.toCamelCase)(b),
                contactName: b.contacts?.name || 'Unknown',
            })),
            cancellations: (cancellations || []).map((b) => ({
                ...(0, mapper_1.toCamelCase)(b),
                contactName: b.contacts?.name || 'Unknown',
            })),
            changes: (changes || []).map((b) => ({
                ...(0, mapper_1.toCamelCase)(b),
                contactName: b.contacts?.name || 'Unknown',
            })),
            totalPenalties: totalPenalties.toFixed(2),
            totalDiscounts: totalDiscounts.toFixed(2),
        };
        await this.emailService.sendDailySummaryToSecretary(summaryData);
    }
    async notifyBookingCreated(booking) {
        const { data: contact } = await supabase_1.supabase
            .from('contacts')
            .select('name')
            .eq('id', booking.contact_id)
            .single();
        await this.emailService.sendSecretaryBookingNotification({
            ...(0, mapper_1.toCamelCase)(booking),
            contactName: contact?.name || 'Unknown',
        }, 'new');
    }
    async notifyBookingCancelled(booking) {
        const { data: contact } = await supabase_1.supabase
            .from('contacts')
            .select('name')
            .eq('id', booking.contact_id)
            .single();
        await this.emailService.sendSecretaryBookingNotification({
            ...(0, mapper_1.toCamelCase)(booking),
            contactName: contact?.name || 'Unknown',
        }, 'cancelled');
    }
    async notifyBookingChanged(booking) {
        const { data: contact } = await supabase_1.supabase
            .from('contacts')
            .select('name')
            .eq('id', booking.contact_id)
            .single();
        await this.emailService.sendSecretaryBookingNotification({
            ...(0, mapper_1.toCamelCase)(booking),
            contactName: contact?.name || 'Unknown',
        }, 'changed');
    }
    async shouldSendDailySummary() {
        const enabled = await this.settingsService.getSetting('daily_summary_enabled');
        if (enabled !== 'true')
            return false;
        const summaryTime = await this.settingsService.getSetting('daily_summary_time') || '09:00';
        const timezone = await this.settingsService.getSetting('timezone') || 'Europe/Berlin';
        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone
        });
        return currentTime === summaryTime;
    }
}
exports.SecretaryNotificationService = SecretaryNotificationService;
