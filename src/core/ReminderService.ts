import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';
import { SettingsService } from './SettingsService';

interface Reminder {
  id: string;
  bookingId: string;
  contactId: string;
  reminderType: 'appointment' | 'upsell' | 'review';
  messageContent: string;
  scheduledFor: Date;
  sentAt?: Date;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  createdAt: Date;
}

export class ReminderService {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  async scheduleAppointmentReminder(bookingId: string, contactId: string, appointmentTime: Date): Promise<Reminder> {
    const reminderHours = parseInt(await this.settingsService.get('reminder_hours_before') || '24');
    
    const scheduledFor = new Date(appointmentTime);
    scheduledFor.setHours(scheduledFor.getHours() - reminderHours);

    const { data: booking } = await supabase
      .from('bookings')
      .select('title, start_time')
      .eq('id', bookingId)
      .single();

    const message = `Reminder: You have an appointment for ${booking?.title} tomorrow at ${new Date(appointmentTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}. Please arrive 10 minutes early.`;

    const { data: reminder, error } = await supabase
      .from('reminder_logs')
      .insert(toSnakeCase({
        bookingId,
        contactId,
        reminderType: 'appointment',
        messageContent: message,
        scheduledFor,
        status: 'scheduled',
      }))
      .select()
      .single();

    if (error) throw new Error(`Failed to schedule reminder: ${error.message}`);
    return toCamelCase(reminder) as Reminder;
  }

  async scheduleUpsellReminder(contactId: string, upsellMessage: string, daysFromNow: number = 30): Promise<Reminder> {
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + daysFromNow);

    const { data: reminder, error } = await supabase
      .from('reminder_logs')
      .insert(toSnakeCase({
        contactId,
        reminderType: 'upsell',
        messageContent: upsellMessage,
        scheduledFor,
        status: 'scheduled',
      }))
      .select()
      .single();

    if (error) throw new Error(`Failed to schedule upsell: ${error.message}`);
    return toCamelCase(reminder) as Reminder;
  }

  async getPendingReminders(): Promise<Reminder[]> {
    const { data, error } = await supabase
      .from('reminder_logs')
      .select('*, bookings(title, start_time), contacts(name, phone_number)')
      .eq('status', 'scheduled')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });

    if (error) throw new Error(`Failed to get pending reminders: ${error.message}`);
    return (data || []).map(toCamelCase) as Reminder[];
  }

  async sendReminder(
    reminderId: string,
    sendMessage: (phone: string, message: string) => Promise<void>
  ): Promise<void> {
    const { data: reminder } = await supabase
      .from('reminder_logs')
      .select('*, contacts(phone_number)')
      .eq('id', reminderId)
      .single();

    if (!reminder || !reminder.contacts) return;

    try {
      await sendMessage(reminder.contacts.phone_number, reminder.message_content);

      await supabase
        .from('reminder_logs')
        .update(toSnakeCase({
          status: 'sent',
          sentAt: new Date(),
        }))
        .eq('id', reminderId);
    } catch (error) {
      await supabase
        .from('reminder_logs')
        .update({ status: 'failed' })
        .eq('id', reminderId);
      
      throw error;
    }
  }

  async cancelReminder(reminderId: string): Promise<void> {
    await supabase
      .from('reminder_logs')
      .update({ status: 'cancelled' })
      .eq('id', reminderId);
  }

  async cancelBookingReminders(bookingId: string): Promise<void> {
    await supabase
      .from('reminder_logs')
      .update({ status: 'cancelled' })
      .eq('booking_id', bookingId)
      .eq('status', 'scheduled');
  }
}
