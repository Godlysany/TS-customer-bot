"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecurringAppointmentService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
const BookingService_1 = require("./BookingService");
const whatsapp_1 = require("../adapters/whatsapp");
class RecurringAppointmentService {
    bookingService;
    constructor() {
        this.bookingService = new BookingService_1.BookingService();
    }
    async createRoutine(routine) {
        const { data, error } = await supabase_1.supabase
            .from('customer_routines')
            .insert([(0, mapper_1.toSnakeCase)(routine)])
            .select()
            .single();
        if (error) {
            console.error('Error creating routine:', error);
            return null;
        }
        return (0, mapper_1.toCamelCase)(data);
    }
    async updateRoutine(id, updates) {
        const { data, error } = await supabase_1.supabase
            .from('customer_routines')
            .update((0, mapper_1.toSnakeCase)(updates))
            .eq('id', id)
            .select()
            .single();
        if (error) {
            console.error('Error updating routine:', error);
            return null;
        }
        return (0, mapper_1.toCamelCase)(data);
    }
    async getRoutinesByContact(contactId) {
        const { data, error } = await supabase_1.supabase
            .from('customer_routines')
            .select('*')
            .eq('contact_id', contactId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching routines:', error);
            return [];
        }
        return (data || []).map(mapper_1.toCamelCase);
    }
    async createRecurringAppointment(appointment) {
        const { data, error } = await supabase_1.supabase
            .from('recurring_appointments')
            .insert([(0, mapper_1.toSnakeCase)(appointment)])
            .select()
            .single();
        if (error) {
            console.error('Error creating recurring appointment:', error);
            return null;
        }
        return (0, mapper_1.toCamelCase)(data);
    }
    async updateRecurringAppointment(id, updates) {
        const { data, error } = await supabase_1.supabase
            .from('recurring_appointments')
            .update((0, mapper_1.toSnakeCase)(updates))
            .eq('id', id)
            .select()
            .single();
        if (error) {
            console.error('Error updating recurring appointment:', error);
            return null;
        }
        return (0, mapper_1.toCamelCase)(data);
    }
    async getActiveRecurringAppointments() {
        const { data, error } = await supabase_1.supabase
            .from('recurring_appointments')
            .select('*')
            .eq('status', 'active')
            .order('start_date', { ascending: true });
        if (error) {
            console.error('Error fetching active recurring appointments:', error);
            return [];
        }
        return (data || []).map(mapper_1.toCamelCase);
    }
    calculateNextOccurrence(appointment, fromDate = new Date()) {
        const next = new Date(fromDate);
        switch (appointment.recurrencePattern) {
            case 'daily':
                next.setDate(next.getDate() + appointment.recurrenceInterval);
                break;
            case 'weekly':
                next.setDate(next.getDate() + (7 * appointment.recurrenceInterval));
                break;
            case 'biweekly':
                next.setDate(next.getDate() + (14 * appointment.recurrenceInterval));
                break;
            case 'monthly':
                next.setMonth(next.getMonth() + appointment.recurrenceInterval);
                break;
            default:
                next.setDate(next.getDate() + appointment.recurrenceInterval);
        }
        return next;
    }
    async processRecurringAppointments() {
        try {
            const recurring = await this.getActiveRecurringAppointments();
            console.log(`📅 Processing ${recurring.length} active recurring appointments`);
            let created = 0;
            let failed = 0;
            for (const appointment of recurring) {
                try {
                    if (appointment.occurrencesCount &&
                        appointment.occurrencesCompleted >= appointment.occurrencesCount) {
                        await this.updateRecurringAppointment(appointment.id, {
                            status: 'completed',
                        });
                        console.log(`   ✅ Completed series: ${appointment.id}`);
                        continue;
                    }
                    if (appointment.endDate && new Date(appointment.endDate) < new Date()) {
                        await this.updateRecurringAppointment(appointment.id, {
                            status: 'completed',
                        });
                        console.log(`   ✅ End date reached: ${appointment.id}`);
                        continue;
                    }
                    const { data: existingBookings } = await supabase_1.supabase
                        .from('bookings')
                        .select('start_time')
                        .eq('recurring_appointment_id', appointment.id)
                        .order('start_time', { ascending: false })
                        .limit(1);
                    const now = new Date();
                    let nextDate;
                    if (existingBookings?.[0]?.start_time) {
                        const lastBookingDate = new Date(existingBookings[0].start_time);
                        nextDate = this.calculateNextOccurrence(appointment, lastBookingDate);
                    }
                    else {
                        nextDate = new Date(appointment.startDate);
                    }
                    while (nextDate <= now) {
                        nextDate = this.calculateNextOccurrence(appointment, nextDate);
                    }
                    const daysBefore = 7;
                    const scheduleThreshold = new Date(now);
                    scheduleThreshold.setDate(scheduleThreshold.getDate() + daysBefore);
                    if (nextDate <= scheduleThreshold && nextDate > now) {
                        const { data: existingBookingCheck } = await supabase_1.supabase
                            .from('bookings')
                            .select('id')
                            .eq('recurring_appointment_id', appointment.id)
                            .eq('start_time', nextDate.toISOString())
                            .single();
                        if (existingBookingCheck) {
                            console.log(`   ⏭️  Booking already exists for next occurrence, skipping`);
                            continue;
                        }
                        const { data: contact } = await supabase_1.supabase
                            .from('contacts')
                            .select('phone_number, name, id')
                            .eq('id', appointment.contactId)
                            .single();
                        const { data: service } = appointment.serviceId
                            ? await supabase_1.supabase
                                .from('services')
                                .select('name, duration_minutes, buffer_time_before, buffer_time_after')
                                .eq('id', appointment.serviceId)
                                .single()
                            : { data: null };
                        const bufferBefore = service?.buffer_time_before || 0;
                        const bufferAfter = service?.buffer_time_after || 0;
                        const endDate = new Date(nextDate);
                        endDate.setMinutes(endDate.getMinutes() + (service?.duration_minutes || 30));
                        const actualStartTime = new Date(nextDate);
                        actualStartTime.setMinutes(actualStartTime.getMinutes() - bufferBefore);
                        const actualEndTime = new Date(endDate);
                        actualEndTime.setMinutes(actualEndTime.getMinutes() + bufferAfter);
                        const bookingService = new BookingService_1.BookingService();
                        try {
                            await bookingService.checkBufferedConflicts(actualStartTime, actualEndTime, appointment.serviceId);
                        }
                        catch (error) {
                            console.error(`   ❌ Conflict detected for recurring booking:`, error.message);
                            failed++;
                            continue;
                        }
                        const { data: conversation } = await supabase_1.supabase
                            .from('conversations')
                            .select('id')
                            .eq('contact_id', appointment.contactId)
                            .single();
                        const conversationId = conversation?.id || (await supabase_1.supabase
                            .from('conversations')
                            .insert([{
                                contact_id: appointment.contactId,
                                status: 'active'
                            }])
                            .select('id')
                            .single()).data?.id;
                        const { error: bookingError } = await supabase_1.supabase
                            .from('bookings')
                            .insert([{
                                conversation_id: conversationId,
                                contact_id: appointment.contactId,
                                calendar_event_id: `recurring-${appointment.id}-${nextDate.getTime()}`,
                                title: service?.name || 'Recurring Appointment',
                                start_time: nextDate.toISOString(),
                                end_time: endDate.toISOString(),
                                actual_start_time: actualStartTime.toISOString(),
                                actual_end_time: actualEndTime.toISOString(),
                                buffer_time_before: bufferBefore,
                                buffer_time_after: bufferAfter,
                                status: 'confirmed',
                                service_id: appointment.serviceId,
                                recurring_appointment_id: appointment.id,
                                metadata: { auto_booked: true, recurrence_pattern: appointment.recurrencePattern }
                            }]);
                        if (bookingError) {
                            console.error(`   ❌ Error creating booking:`, bookingError);
                            failed++;
                            continue;
                        }
                        const message = `📅 Your recurring ${service?.name || 'appointment'} has been automatically scheduled for ${nextDate.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                        })} at ${nextDate.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}. Reply "cancel" if you need to reschedule.`;
                        await (0, whatsapp_1.sendProactiveMessage)(contact?.phone_number || '', message, appointment.contactId);
                        await this.updateRecurringAppointment(appointment.id, {
                            occurrencesCompleted: appointment.occurrencesCompleted + 1,
                        });
                        created++;
                        console.log(`   ✅ Created booking and notified customer: ${service?.name || 'appointment'}`);
                    }
                }
                catch (error) {
                    failed++;
                    console.error(`   ❌ Error processing recurring appointment ${appointment.id}:`, error);
                }
            }
            return { created, failed };
        }
        catch (error) {
            console.error('❌ Error processing recurring appointments:', error);
            return { created: 0, failed: 0 };
        }
    }
    async pauseRecurring(id) {
        const updated = await this.updateRecurringAppointment(id, { status: 'paused' });
        return updated !== null;
    }
    async resumeRecurring(id) {
        const updated = await this.updateRecurringAppointment(id, { status: 'active' });
        return updated !== null;
    }
    async cancelRecurring(id) {
        const updated = await this.updateRecurringAppointment(id, { status: 'cancelled' });
        return updated !== null;
    }
    async getRecurringByContact(contactId) {
        const { data, error } = await supabase_1.supabase
            .from('recurring_appointments')
            .select('*')
            .eq('contact_id', contactId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching recurring appointments:', error);
            return [];
        }
        return (data || []).map(mapper_1.toCamelCase);
    }
}
exports.RecurringAppointmentService = RecurringAppointmentService;
