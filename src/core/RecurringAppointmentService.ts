import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';
import { BookingService } from './BookingService';
import { sendProactiveMessage } from '../adapters/whatsapp';

export interface CustomerRoutine {
  id: string;
  contactId: string;
  routineName: string;
  serviceId?: string;
  frequencyType: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  frequencyValue: number;
  preferredDayOfWeek?: number;
  preferredTimeOfDay?: string;
  lastBookingDate?: string;
  nextSuggestedDate?: string;
  isActive: boolean;
  autoBook: boolean;
  createdBy: 'bot' | 'agent' | 'customer';
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringAppointment {
  id: string;
  contactId: string;
  serviceId?: string;
  routineId?: string;
  recurrencePattern: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  recurrenceInterval: number;
  startDate: string;
  endDate?: string;
  occurrencesCount?: number;
  occurrencesCompleted: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export class RecurringAppointmentService {
  private bookingService: BookingService;

  constructor() {
    this.bookingService = new BookingService();
  }

  async createRoutine(routine: Partial<CustomerRoutine>): Promise<CustomerRoutine | null> {
    const { data, error } = await supabase
      .from('customer_routines')
      .insert([toSnakeCase(routine)])
      .select()
      .single();

    if (error) {
      console.error('Error creating routine:', error);
      return null;
    }

    return toCamelCase(data) as CustomerRoutine;
  }

  async updateRoutine(
    id: string,
    updates: Partial<CustomerRoutine>
  ): Promise<CustomerRoutine | null> {
    const { data, error } = await supabase
      .from('customer_routines')
      .update(toSnakeCase(updates))
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating routine:', error);
      return null;
    }

    return toCamelCase(data) as CustomerRoutine;
  }

  async getRoutinesByContact(contactId: string): Promise<CustomerRoutine[]> {
    const { data, error } = await supabase
      .from('customer_routines')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching routines:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as CustomerRoutine[];
  }

  async createRecurringAppointment(
    appointment: Partial<RecurringAppointment>
  ): Promise<RecurringAppointment | null> {
    const { data, error } = await supabase
      .from('recurring_appointments')
      .insert([toSnakeCase(appointment)])
      .select()
      .single();

    if (error) {
      console.error('Error creating recurring appointment:', error);
      return null;
    }

    return toCamelCase(data) as RecurringAppointment;
  }

  async updateRecurringAppointment(
    id: string,
    updates: Partial<RecurringAppointment>
  ): Promise<RecurringAppointment | null> {
    const { data, error } = await supabase
      .from('recurring_appointments')
      .update(toSnakeCase(updates))
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating recurring appointment:', error);
      return null;
    }

    return toCamelCase(data) as RecurringAppointment;
  }

  async getActiveRecurringAppointments(): Promise<RecurringAppointment[]> {
    const { data, error } = await supabase
      .from('recurring_appointments')
      .select('*')
      .eq('status', 'active')
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching active recurring appointments:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as RecurringAppointment[];
  }

  calculateNextOccurrence(
    appointment: RecurringAppointment,
    fromDate: Date = new Date()
  ): Date {
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

  async processRecurringAppointments(): Promise<{
    created: number;
    failed: number;
  }> {
    try {
      const recurring = await this.getActiveRecurringAppointments();
      console.log(`📅 Processing ${recurring.length} active recurring appointments`);

      let created = 0;
      let failed = 0;

      for (const appointment of recurring) {
        try {
          if (
            appointment.occurrencesCount &&
            appointment.occurrencesCompleted >= appointment.occurrencesCount
          ) {
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

          const { data: existingBookings } = await supabase
            .from('bookings')
            .select('start_time')
            .eq('recurring_appointment_id', appointment.id)
            .order('start_time', { ascending: false })
            .limit(1);

          const now = new Date();
          let nextDate: Date;
          
          if (existingBookings?.[0]?.start_time) {
            const lastBookingDate = new Date(existingBookings[0].start_time);
            nextDate = this.calculateNextOccurrence(appointment, lastBookingDate);
          } else {
            nextDate = new Date(appointment.startDate);
          }

          while (nextDate <= now) {
            nextDate = this.calculateNextOccurrence(appointment, nextDate);
          }

          const daysBefore = 7;
          const scheduleThreshold = new Date(now);
          scheduleThreshold.setDate(scheduleThreshold.getDate() + daysBefore);

          if (nextDate <= scheduleThreshold && nextDate > now) {
            const { data: existingBookingCheck } = await supabase
              .from('bookings')
              .select('id')
              .eq('recurring_appointment_id', appointment.id)
              .eq('start_time', nextDate.toISOString())
              .single();

            if (existingBookingCheck) {
              console.log(`   ⏭️  Booking already exists for next occurrence, skipping`);
              continue;
            }

            const { data: contact } = await supabase
              .from('contacts')
              .select('phone_number, name, id')
              .eq('id', appointment.contactId)
              .single();

            const { data: service } = appointment.serviceId
              ? await supabase
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

            const bookingService = new BookingService();
            try {
              await bookingService.checkBufferedConflicts(
                actualStartTime,
                actualEndTime,
                appointment.serviceId
              );
            } catch (error: any) {
              console.error(`   ❌ Conflict detected for recurring booking:`, error.message);
              failed++;
              continue;
            }

            const { data: conversation } = await supabase
              .from('conversations')
              .select('id')
              .eq('contact_id', appointment.contactId)
              .single();

            const conversationId = conversation?.id || (await supabase
              .from('conversations')
              .insert([{
                contact_id: appointment.contactId,
                status: 'active'
              }])
              .select('id')
              .single()).data?.id;

            const { error: bookingError } = await supabase
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

            await sendProactiveMessage(
              contact?.phone_number || '',
              message,
              appointment.contactId
            );

            await this.updateRecurringAppointment(appointment.id, {
              occurrencesCompleted: appointment.occurrencesCompleted + 1,
            });

            created++;
            console.log(`   ✅ Created booking and notified customer: ${service?.name || 'appointment'}`);
          }
        } catch (error) {
          failed++;
          console.error(`   ❌ Error processing recurring appointment ${appointment.id}:`, error);
        }
      }

      return { created, failed };
    } catch (error) {
      console.error('❌ Error processing recurring appointments:', error);
      return { created: 0, failed: 0 };
    }
  }

  async pauseRecurring(id: string): Promise<boolean> {
    const updated = await this.updateRecurringAppointment(id, { status: 'paused' });
    return updated !== null;
  }

  async resumeRecurring(id: string): Promise<boolean> {
    const updated = await this.updateRecurringAppointment(id, { status: 'active' });
    return updated !== null;
  }

  async cancelRecurring(id: string): Promise<boolean> {
    const updated = await this.updateRecurringAppointment(id, { status: 'cancelled' });
    return updated !== null;
  }

  async getRecurringByContact(contactId: string): Promise<RecurringAppointment[]> {
    const { data, error } = await supabase
      .from('recurring_appointments')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recurring appointments:', error);
      return [];
    }

    return (data || []).map(toCamelCase) as RecurringAppointment[];
  }
}
