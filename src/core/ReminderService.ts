import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';
import { SettingsService } from './SettingsService';
import { EmailService } from './EmailService';

interface Reminder {
  id: string;
  bookingId?: string;
  contactId: string;
  reminderType: 'email' | 'whatsapp' | 'sms';
  timing: string;
  messageContent: string;
  scheduledFor: Date;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  errorMessage?: string;
  metadata?: any;
  createdAt: Date;
}

export class ReminderService {
  private settingsService: SettingsService;
  private emailService: EmailService;

  constructor() {
    this.settingsService = new SettingsService();
    this.emailService = new EmailService();
  }

  /**
   * Schedule multiple reminders for an appointment based on settings
   * Supports both email and WhatsApp reminders with configurable timing
   */
  async scheduleAppointmentReminder(
    bookingId: string, 
    contactId: string, 
    appointmentTime: Date
  ): Promise<Reminder[]> {
    const reminders: Reminder[] = [];

    // Check if reminders are enabled
    const whatsappEnabled = (await this.settingsService.getSetting('whatsapp_reminders_enabled')) === 'true';
    const emailEnabled = true; // Email reminders always enabled

    // Get timing configuration from settings
    const whatsappTimingStr = await this.settingsService.getSetting('whatsapp_reminder_timing') || '24,2';
    const emailTimingStr = await this.settingsService.getSetting('email_reminder_timing') || '48,24';

    // Parse timing strings (comma-separated hours)
    const whatsappHours = whatsappTimingStr.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h));
    const emailHours = emailTimingStr.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h));

    // Fetch booking details
    const { data: booking } = await supabase
      .from('bookings')
      .select('title, start_time, contacts(name)')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      throw new Error('Booking not found');
    }

    const contactName = (booking as any).contacts?.name || 'Valued Customer';

    // Schedule WhatsApp reminders
    if (whatsappEnabled) {
      for (const hours of whatsappHours) {
        const scheduledFor = new Date(appointmentTime);
        scheduledFor.setHours(scheduledFor.getHours() - hours);

        // Only schedule if it's in the future
        if (scheduledFor > new Date()) {
          const message = this.generateReminderMessage(
            contactName,
            booking.title,
            appointmentTime,
            hours
          );

          const reminder = await this.createReminder({
            bookingId,
            contactId,
            reminderType: 'whatsapp',
            timing: `${hours}h_before`,
            messageContent: message,
            scheduledFor,
            metadata: { appointmentTime: appointmentTime.toISOString() }
          });

          reminders.push(reminder);
        }
      }
    }

    // Schedule Email reminders
    if (emailEnabled) {
      for (const hours of emailHours) {
        const scheduledFor = new Date(appointmentTime);
        scheduledFor.setHours(scheduledFor.getHours() - hours);

        // Only schedule if it's in the future
        if (scheduledFor > new Date()) {
          const message = this.generateReminderMessage(
            contactName,
            booking.title,
            appointmentTime,
            hours
          );

          const reminder = await this.createReminder({
            bookingId,
            contactId,
            reminderType: 'email',
            timing: `${hours}h_before`,
            messageContent: message,
            scheduledFor,
            metadata: { appointmentTime: appointmentTime.toISOString() }
          });

          reminders.push(reminder);
        }
      }
    }

    return reminders;
  }

  private generateReminderMessage(
    contactName: string,
    serviceTitle: string,
    appointmentTime: Date,
    hoursBefore: number
  ): string {
    const timeStr = appointmentTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const dateStr = appointmentTime.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric' 
    });

    if (hoursBefore <= 2) {
      return `Hi ${contactName}! Your appointment for ${serviceTitle} is coming up soon at ${timeStr}. Please arrive 10 minutes early. See you soon!`;
    } else if (hoursBefore <= 24) {
      return `Hi ${contactName}! Reminder: You have an appointment for ${serviceTitle} tomorrow at ${timeStr}. Please arrive 10 minutes early. Looking forward to seeing you!`;
    } else {
      return `Hi ${contactName}! This is a reminder that you have an appointment for ${serviceTitle} scheduled for ${dateStr} at ${timeStr}. Please arrive 10 minutes early.`;
    }
  }

  private async createReminder(data: {
    bookingId?: string;
    contactId: string;
    reminderType: 'email' | 'whatsapp' | 'sms';
    timing: string;
    messageContent: string;
    scheduledFor: Date;
    metadata?: any;
  }): Promise<Reminder> {
    try {
      const insertData = toSnakeCase({
        ...data,
        status: 'pending',
      });

      console.log(`📅 Creating ${data.reminderType} reminder for ${data.timing}:`, {
        contactId: data.contactId,
        scheduledFor: data.scheduledFor.toISOString(),
      });

      const { data: reminder, error } = await supabase
        .from('reminder_logs')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error(`❌ Failed to create ${data.reminderType} reminder:`, error);
        throw new Error(`Failed to create ${data.reminderType} reminder: ${error.message}`);
      }

      console.log(`✅ Created ${data.reminderType} reminder:`, reminder.id);
      return toCamelCase(reminder) as Reminder;
    } catch (error: any) {
      console.error(`❌ Exception creating ${data.reminderType} reminder:`, error);
      throw error;
    }
  }

  async scheduleUpsellReminder(
    contactId: string, 
    upsellMessage: string, 
    daysFromNow: number = 30
  ): Promise<Reminder> {
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + daysFromNow);

    return this.createReminder({
      contactId,
      reminderType: 'whatsapp',
      timing: `${daysFromNow}d_after`,
      messageContent: upsellMessage,
      scheduledFor,
    });
  }

  /**
   * Get all pending reminders that are due to be sent
   */
  async getPendingReminders(): Promise<Reminder[]> {
    const { data, error } = await supabase
      .from('reminder_logs')
      .select('*, bookings(title, start_time), contacts(name, phone_number, email)')
      .in('status', ['pending'])
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });

    if (error) throw new Error(`Failed to get pending reminders: ${error.message}`);
    return (data || []).map(toCamelCase) as Reminder[];
  }

  /**
   * Send a reminder via WhatsApp
   */
  async sendWhatsAppReminder(
    reminderId: string,
    phoneNumber: string,
    message: string
  ): Promise<void> {
    try {
      // Access the global WhatsApp socket
      const sock = (global as any).sock;
      
      if (!sock || !sock.user) {
        throw new Error('WhatsApp not connected');
      }

      // Format phone number for WhatsApp (ensure it's in international format)
      const formattedNumber = phoneNumber.startsWith('+') 
        ? phoneNumber.replace('+', '') 
        : phoneNumber;
      const jid = `${formattedNumber}@s.whatsapp.net`;

      // Send the message
      await sock.sendMessage(jid, { text: message });

      // Update reminder status
      await supabase
        .from('reminder_logs')
        .update(toSnakeCase({
          status: 'sent',
          sentAt: new Date(),
        }))
        .eq('id', reminderId);

      console.log(`✅ WhatsApp reminder sent to ${phoneNumber}`);
    } catch (error: any) {
      console.error(`❌ Failed to send WhatsApp reminder:`, error);

      await supabase
        .from('reminder_logs')
        .update(toSnakeCase({
          status: 'failed',
          errorMessage: error.message,
        }))
        .eq('id', reminderId);

      throw error;
    }
  }

  /**
   * Send a reminder via Email
   */
  async sendEmailReminder(
    reminderId: string,
    contactEmail: string,
    contactName: string,
    bookingTitle: string,
    appointmentTime: Date
  ): Promise<void> {
    try {
      await this.emailService.sendReminderEmail(
        reminderId, // Use reminder ID as booking ID for logging
        contactEmail,
        {
          contactName,
          title: bookingTitle,
          startTime: appointmentTime,
        }
      );

      // Update reminder status
      await supabase
        .from('reminder_logs')
        .update(toSnakeCase({
          status: 'sent',
          sentAt: new Date(),
        }))
        .eq('id', reminderId);

      console.log(`✅ Email reminder sent to ${contactEmail}`);
    } catch (error: any) {
      console.error(`❌ Failed to send email reminder:`, error);

      await supabase
        .from('reminder_logs')
        .update(toSnakeCase({
          status: 'failed',
          errorMessage: error.message,
        }))
        .eq('id', reminderId);

      throw error;
    }
  }

  /**
   * Process all pending reminders
   * This should be called by a cron job
   */
  async processPendingReminders(): Promise<{ sent: number; failed: number }> {
    const pendingReminders = await this.getPendingReminders();
    let sent = 0;
    let failed = 0;

    for (const reminder of pendingReminders) {
      try {
        const contact = (reminder as any).contacts;

        if (reminder.reminderType === 'whatsapp') {
          if (contact?.phoneNumber) {
            await this.sendWhatsAppReminder(
              reminder.id,
              contact.phoneNumber,
              reminder.messageContent
            );
            sent++;
          } else {
            await this.markReminderFailed(reminder.id, 'No phone number available');
            failed++;
          }
        } else if (reminder.reminderType === 'email') {
          if (contact?.email) {
            const booking = (reminder as any).bookings;
            const appointmentTime = reminder.metadata?.appointmentTime 
              ? new Date(reminder.metadata.appointmentTime)
              : booking?.startTime 
                ? new Date(booking.startTime)
                : new Date();

            await this.sendEmailReminder(
              reminder.id,
              contact.email,
              contact.name || 'Valued Customer',
              booking?.title || 'Appointment',
              appointmentTime
            );
            sent++;
          } else {
            await this.markReminderFailed(reminder.id, 'No email available');
            failed++;
          }
        }
      } catch (error: any) {
        console.error(`Failed to send reminder ${reminder.id}:`, error);
        failed++;
      }
    }

    console.log(`📨 Reminder processing complete: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  private async markReminderFailed(reminderId: string, errorMessage: string): Promise<void> {
    await supabase
      .from('reminder_logs')
      .update(toSnakeCase({
        status: 'failed',
        errorMessage,
      }))
      .eq('id', reminderId);
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
      .in('status', ['pending']);
  }
}
