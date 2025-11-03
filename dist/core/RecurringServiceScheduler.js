"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecurringServiceScheduler = void 0;
const supabase_1 = require("../infrastructure/supabase");
const whatsapp_1 = require("../adapters/whatsapp");
const mapper_1 = require("../infrastructure/mapper");
const AIService_1 = require("./AIService");
class RecurringServiceScheduler {
    defaultReminderMessage = `Hi {{name}}! It's been a while since your last {{service}}. Based on our recommended schedule, it's time to book your next appointment. Would you like to schedule one?`;
    intervalId = null;
    start(intervalMinutes = 1440) {
        console.log(`⏰ Starting recurring service scheduler (checking every ${intervalMinutes} minutes)`);
        this.processRecurringReminders();
        this.intervalId = setInterval(() => {
            this.processRecurringReminders();
        }, intervalMinutes * 60 * 1000);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('⏰ Recurring service scheduler stopped');
        }
    }
    async processRecurringReminders() {
        console.log('📅 Processing recurring service reminders...');
        const results = {
            sent: 0,
            failed: 0,
            details: [],
        };
        try {
            const dueSoon = await this.findCustomersDueForRecurringServices();
            console.log(`📅 Found ${dueSoon.length} customers due for recurring service reminders`);
            for (const reminder of dueSoon) {
                try {
                    await this.sendRecurringReminder(reminder);
                    results.sent++;
                    results.details.push({
                        contactId: reminder.contactId,
                        service: reminder.serviceName,
                        status: 'sent',
                    });
                }
                catch (error) {
                    console.error(`❌ Failed to send recurring reminder to ${reminder.contactPhone}:`, error.message);
                    results.failed++;
                    results.details.push({
                        contactId: reminder.contactId,
                        service: reminder.serviceName,
                        status: 'failed',
                        error: error.message,
                    });
                }
            }
            console.log(`✅ Recurring reminders complete: ${results.sent} sent, ${results.failed} failed`);
        }
        catch (error) {
            console.error('❌ Error in recurring service scheduler:', error);
            throw error;
        }
        return results;
    }
    async findCustomersDueForRecurringServices() {
        let recurringServices;
        try {
            const { data, error: servicesError } = await supabase_1.supabase
                .from('services')
                .select('id, name, recurring_interval_days, recurring_reminder_days_before, recurring_reminder_message')
                .eq('is_active', true)
                .eq('recurring_reminder_enabled', true);
            if (servicesError) {
                // If columns don't exist yet (schema not deployed), gracefully return empty array
                if (servicesError.code === '42703') {
                    console.log('⚠️  Recurring service columns not yet deployed to database, skipping scheduler');
                    return [];
                }
                throw servicesError;
            }
            recurringServices = data || [];
            if (recurringServices.length === 0)
                return [];
        }
        catch (error) {
            // Handle column not found errors gracefully
            if (error.code === '42703') {
                console.log('⚠️  Recurring service columns not yet deployed to database, skipping scheduler');
                return [];
            }
            throw error;
        }
        const camelServices = recurringServices.map((s) => (0, mapper_1.toCamelCase)(s));
        const dueSoon = [];
        for (const service of camelServices) {
            const { data: completedBookings, error: bookingsError } = await supabase_1.supabase
                .from('bookings')
                .select(`
          id,
          contact_id,
          service_id,
          end_time,
          contacts!inner(id, name, phone_number),
          services!inner(id, name)
        `)
                .eq('service_id', service.id)
                .eq('status', 'completed')
                .order('end_time', { ascending: false });
            if (bookingsError) {
                console.error(`Error fetching bookings for service ${service.name}:`, bookingsError);
                continue;
            }
            if (!completedBookings || completedBookings.length === 0)
                continue;
            const customerLatestBooking = new Map();
            for (const booking of completedBookings) {
                const contactId = booking.contact_id;
                if (!customerLatestBooking.has(contactId)) {
                    customerLatestBooking.set(contactId, booking);
                }
            }
            for (const [contactId, booking] of customerLatestBooking.entries()) {
                const completedDate = new Date(booking.end_time);
                const nextDueDate = new Date(completedDate);
                nextDueDate.setDate(nextDueDate.getDate() + service.recurringIntervalDays);
                const today = new Date();
                const daysUntilDue = Math.floor((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntilDue <= service.recurringReminderDaysBefore && daysUntilDue >= 0) {
                    const alreadySentRecently = await this.wasReminderSentRecently(contactId, service.id, 7);
                    if (!alreadySentRecently) {
                        dueSoon.push({
                            id: booking.id,
                            contactId: booking.contact_id,
                            serviceId: service.id,
                            serviceName: service.name,
                            completedAt: booking.end_time,
                            contactName: booking.contacts.name || 'Customer',
                            contactPhone: booking.contacts.phone_number,
                            daysUntilNextDue: daysUntilDue,
                            nextDueDate: nextDueDate.toISOString(),
                        });
                    }
                }
            }
        }
        return dueSoon;
    }
    async wasReminderSentRecently(contactId, serviceId, withinDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - withinDays);
        const { data, error } = await supabase_1.supabase
            .from('reminder_logs')
            .select('id')
            .eq('contact_id', contactId)
            .eq('reminder_type', 'recurring_service')
            .gte('sent_at', cutoffDate.toISOString())
            .limit(1);
        if (error) {
            console.error('Error checking reminder log:', error);
            return false;
        }
        return data && data.length > 0;
    }
    async sendRecurringReminder(reminder) {
        const { data: service } = await supabase_1.supabase
            .from('services')
            .select('recurring_reminder_message')
            .eq('id', reminder.serviceId)
            .single();
        const messageTemplate = service?.recurring_reminder_message || this.defaultReminderMessage;
        const lastDate = new Date(reminder.completedAt).toLocaleDateString('de-CH');
        const nextDate = new Date(reminder.nextDueDate).toLocaleDateString('de-CH');
        // Build template with placeholders
        const templateMessage = messageTemplate
            .replace(/\{\{name\}\}/g, reminder.contactName)
            .replace(/\{\{service\}\}/g, reminder.serviceName)
            .replace(/\{\{last_date\}\}/g, lastDate)
            .replace(/\{\{next_date\}\}/g, nextDate);
        // Personalize through GPT for natural, language-appropriate delivery
        const aiService = new AIService_1.AIService();
        const personalizedMessage = await aiService.personalizeMessage({
            templateMessage,
            contactId: reminder.contactId,
            contactName: reminder.contactName,
            conversationContext: `Customer last completed ${reminder.serviceName} on ${lastDate}. Next appointment recommended around ${nextDate}.`,
            messageType: 'general',
        });
        await (0, whatsapp_1.sendProactiveMessage)(reminder.contactPhone, personalizedMessage, reminder.contactId);
        await supabase_1.supabase.from('reminder_logs').insert({
            contact_id: reminder.contactId,
            reminder_type: 'recurring_service',
            sent_at: new Date().toISOString(),
            metadata: {
                service_id: reminder.serviceId,
                service_name: reminder.serviceName,
                last_completed_at: reminder.completedAt,
                next_due_date: reminder.nextDueDate,
                days_until_due: reminder.daysUntilNextDue,
            },
        });
        console.log(`✅ Sent recurring reminder to ${reminder.contactPhone} for ${reminder.serviceName}`);
    }
}
exports.RecurringServiceScheduler = RecurringServiceScheduler;
exports.default = new RecurringServiceScheduler();
