"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
const SettingsService_1 = require("./SettingsService");
class ReminderService {
    settingsService;
    constructor() {
        this.settingsService = new SettingsService_1.SettingsService();
    }
    async scheduleAppointmentReminder(bookingId, contactId, appointmentTime) {
        const reminderHours = parseInt(await this.settingsService.getSetting('reminder_hours_before') || '24');
        const scheduledFor = new Date(appointmentTime);
        scheduledFor.setHours(scheduledFor.getHours() - reminderHours);
        const { data: booking } = await supabase_1.supabase
            .from('bookings')
            .select('title, start_time')
            .eq('id', bookingId)
            .single();
        const message = `Reminder: You have an appointment for ${booking?.title} tomorrow at ${new Date(appointmentTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}. Please arrive 10 minutes early.`;
        const { data: reminder, error } = await supabase_1.supabase
            .from('reminder_logs')
            .insert((0, mapper_1.toSnakeCase)({
            bookingId,
            contactId,
            reminderType: 'appointment',
            messageContent: message,
            scheduledFor,
            status: 'scheduled',
        }))
            .select()
            .single();
        if (error)
            throw new Error(`Failed to schedule reminder: ${error.message}`);
        return (0, mapper_1.toCamelCase)(reminder);
    }
    async scheduleUpsellReminder(contactId, upsellMessage, daysFromNow = 30) {
        const scheduledFor = new Date();
        scheduledFor.setDate(scheduledFor.getDate() + daysFromNow);
        const { data: reminder, error } = await supabase_1.supabase
            .from('reminder_logs')
            .insert((0, mapper_1.toSnakeCase)({
            contactId,
            reminderType: 'upsell',
            messageContent: upsellMessage,
            scheduledFor,
            status: 'scheduled',
        }))
            .select()
            .single();
        if (error)
            throw new Error(`Failed to schedule upsell: ${error.message}`);
        return (0, mapper_1.toCamelCase)(reminder);
    }
    async getPendingReminders() {
        const { data, error } = await supabase_1.supabase
            .from('reminder_logs')
            .select('*, bookings(title, start_time), contacts(name, phone_number)')
            .eq('status', 'scheduled')
            .lte('scheduled_for', new Date().toISOString())
            .order('scheduled_for', { ascending: true });
        if (error)
            throw new Error(`Failed to get pending reminders: ${error.message}`);
        return (data || []).map(mapper_1.toCamelCase);
    }
    async sendReminder(reminderId, sendMessage) {
        const { data: reminder } = await supabase_1.supabase
            .from('reminder_logs')
            .select('*, contacts(phone_number)')
            .eq('id', reminderId)
            .single();
        if (!reminder || !reminder.contacts)
            return;
        try {
            await sendMessage(reminder.contacts.phone_number, reminder.message_content);
            await supabase_1.supabase
                .from('reminder_logs')
                .update((0, mapper_1.toSnakeCase)({
                status: 'sent',
                sentAt: new Date(),
            }))
                .eq('id', reminderId);
        }
        catch (error) {
            await supabase_1.supabase
                .from('reminder_logs')
                .update({ status: 'failed' })
                .eq('id', reminderId);
            throw error;
        }
    }
    async cancelReminder(reminderId) {
        await supabase_1.supabase
            .from('reminder_logs')
            .update({ status: 'cancelled' })
            .eq('id', reminderId);
    }
    async cancelBookingReminders(bookingId) {
        await supabase_1.supabase
            .from('reminder_logs')
            .update({ status: 'cancelled' })
            .eq('booking_id', bookingId)
            .eq('status', 'scheduled');
    }
}
exports.ReminderService = ReminderService;
