import { supabase } from '../infrastructure/supabase';
import { Booking, CalendarProvider, CalendarEvent } from '../types';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';
import { EmailService } from './EmailService';
import { ReminderService } from './ReminderService';
import { ReviewService } from './ReviewService';
import { SecretaryNotificationService } from './SecretaryNotificationService';
import { SettingsService } from './SettingsService';
import { DocumentService } from './DocumentService';

export class BookingService {
  private calendarProvider: CalendarProvider | null = null;
  private emailService: EmailService;
  private reminderService: ReminderService;
  private reviewService: ReviewService;
  private secretaryService: SecretaryNotificationService;
  private settingsService: SettingsService;
  private documentService: DocumentService;

  constructor() {
    this.emailService = new EmailService();
    this.reminderService = new ReminderService();
    this.reviewService = new ReviewService();
    this.secretaryService = new SecretaryNotificationService();
    this.settingsService = new SettingsService();
    this.documentService = new DocumentService();
  }

  setCalendarProvider(provider: CalendarProvider) {
    this.calendarProvider = provider;
  }

  async createBooking(
    contactId: string, 
    conversationId: string, 
    event: CalendarEvent,
    options?: {
      serviceId?: string;
      discountCode?: string;
      discountAmount?: number;
      promoVoucher?: string;
    }
  ): Promise<Booking> {
    if (!this.calendarProvider) {
      throw new Error('Calendar provider not initialized');
    }

    let bufferTimeBefore = 0;
    let bufferTimeAfter = 0;

    if (options?.serviceId) {
      const { data: service } = await supabase
        .from('services')
        .select('buffer_time_before, buffer_time_after')
        .eq('id', options.serviceId)
        .single();

      if (service) {
        bufferTimeBefore = service.buffer_time_before || 0;
        bufferTimeAfter = service.buffer_time_after || 0;
      }
    }

    const actualStartTime = new Date(event.startTime);
    actualStartTime.setMinutes(actualStartTime.getMinutes() - bufferTimeBefore);

    const actualEndTime = new Date(event.endTime);
    actualEndTime.setMinutes(actualEndTime.getMinutes() + bufferTimeAfter);

    await this.checkBufferedConflicts(
      actualStartTime,
      actualEndTime,
      options?.serviceId
    );

    const calendarEventId = await this.calendarProvider.createEvent(event);

    const { data, error } = await supabase
      .from('bookings')
      .insert(toSnakeCase({
        contactId,
        conversationId,
        calendarEventId,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        serviceId: options?.serviceId,
        actualStartTime,
        actualEndTime,
        bufferTimeBefore,
        bufferTimeAfter,
        status: 'confirmed',
        discountCode: options?.discountCode,
        discountAmount: options?.discountAmount || 0,
        promoVoucher: options?.promoVoucher,
        emailSent: false,
        reminderSent: false,
      }))
      .select()
      .single();

    if (error) throw error;
    
    const booking = toCamelCase(data) as Booking;

    const { data: contact } = await supabase
      .from('contacts')
      .select('name, email')
      .eq('id', contactId)
      .single();

    if (contact?.email) {
      await this.emailService.sendBookingConfirmation(booking.id, contact.email, {
        ...booking,
        contactName: contact.name,
      });

      await supabase
        .from('bookings')
        .update({ email_sent: true })
        .eq('id', booking.id);
    }

    await this.reminderService.scheduleAppointmentReminder(booking.id, contactId, event.startTime);
    await this.reviewService.scheduleReviewRequest(booking.id, contactId);
    await this.secretaryService.notifyBookingCreated(data);

    if (options?.serviceId) {
      await this.documentService.scheduleDocumentDelivery(booking.id);
    }

    return booking;
  }

  async updateBooking(bookingId: string, updates: Partial<CalendarEvent>): Promise<void> {
    const { data: bookingData } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (!bookingData) throw new Error('Booking not found');

    const booking = toCamelCase(bookingData);

    if (this.calendarProvider) {
      await this.calendarProvider.updateEvent(booking.calendarEventId, updates);
    }

    const updateData: any = {};
    if (updates.title) updateData.title = updates.title;
    if (updates.startTime) updateData.start_time = updates.startTime.toISOString();
    if (updates.endTime) updateData.end_time = updates.endTime.toISOString();

    const { error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (error) throw error;
  }

  async cancelBooking(bookingId: string, reason?: string): Promise<{ penaltyApplied: boolean; penaltyFee: number }> {
    const { data: bookingData } = await supabase
      .from('bookings')
      .select('*, contacts(name, email)')
      .eq('id', bookingId)
      .single();

    if (!bookingData) throw new Error('Booking not found');

    const booking = toCamelCase(bookingData);

    const policyHours = parseInt(await this.settingsService.getSetting('cancellation_policy_hours') || '24');
    const penaltyType = await this.settingsService.getSetting('late_cancellation_penalty_type') || 'fixed';
    const penaltyAmount = parseFloat(await this.settingsService.getSetting('late_cancellation_penalty_amount') || '50');

    const hoursUntilAppointment = (new Date(booking.startTime).getTime() - new Date().getTime()) / (1000 * 60 * 60);
    
    const isLateCancellation = hoursUntilAppointment < policyHours;
    const penaltyFee = isLateCancellation ? penaltyAmount : 0;

    if (this.calendarProvider) {
      await this.calendarProvider.deleteEvent(booking.calendarEventId);
    }

    const { error } = await supabase
      .from('bookings')
      .update(toSnakeCase({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason,
        penaltyApplied: isLateCancellation,
        penaltyFee,
      }))
      .eq('id', bookingId);

    if (error) throw error;

    const contact = bookingData.contacts;
    if (contact?.email) {
      await this.emailService.sendCancellationEmail(bookingId, contact.email, {
        ...booking,
        contactName: contact.name,
        penaltyApplied: isLateCancellation,
        penaltyFee,
        reason,
      });
    }

    await this.reminderService.cancelBookingReminders(bookingId);
    await this.secretaryService.notifyBookingCancelled({
      ...bookingData,
      penalty_applied: isLateCancellation,
      penalty_fee: penaltyFee,
      cancellation_reason: reason,
    });

    const { WaitlistService } = await import('./WaitlistService');
    const waitlistService = new WaitlistService();
    
    const sendMessage = async (phone: string, message: string) => {
      try {
        const whatsappModule = await import('../adapters/whatsapp');
        const sock = whatsappModule.default;
        if (sock) {
          await sock.sendMessage(phone, { text: message });
        }
      } catch (error) {
        console.error('Failed to send waitlist notification:', error);
      }
    };
    
    await waitlistService.notifyWaitlistMatches(booking, sendMessage);

    return {
      penaltyApplied: isLateCancellation,
      penaltyFee,
    };
  }

  async checkBufferedConflicts(
    actualStartTime: Date,
    actualEndTime: Date,
    excludeServiceId?: string
  ): Promise<void> {
    const { data: allBookings } = await supabase
      .from('bookings')
      .select('id, start_time, end_time, actual_start_time, actual_end_time, title, buffer_time_before, buffer_time_after')
      .eq('status', 'confirmed');

    if (!allBookings) return;

    const conflicts = allBookings.filter(booking => {
      const bufferBefore = Number(booking.buffer_time_before) || 0;
      const bufferAfter = Number(booking.buffer_time_after) || 0;

      const bookingStart = booking.actual_start_time 
        ? new Date(booking.actual_start_time)
        : new Date(new Date(booking.start_time).getTime() - bufferBefore * 60000);
      
      const bookingEnd = booking.actual_end_time
        ? new Date(booking.actual_end_time)
        : new Date(new Date(booking.end_time).getTime() + bufferAfter * 60000);

      return bookingStart < actualEndTime && bookingEnd > actualStartTime;
    });

    if (conflicts.length > 0) {
      const conflictTitles = conflicts.map(c => c.title).join(', ');
      throw new Error(
        `Booking conflict detected (including buffer times). Overlaps with: ${conflictTitles}. Please choose a different time slot.`
      );
    }
  }

  async getAvailability(startDate: Date, endDate: Date) {
    if (!this.calendarProvider) {
      throw new Error('Calendar provider not initialized');
    }

    return this.calendarProvider.getAvailability(startDate, endDate);
  }

  async getBookingStats(startDate?: Date, endDate?: Date): Promise<any> {
    let query = supabase.from('bookings').select('*');

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data: bookings } = await query;

    const total = bookings?.length || 0;
    const confirmed = bookings?.filter(b => b.status === 'confirmed').length || 0;
    const cancelled = bookings?.filter(b => b.status === 'cancelled').length || 0;
    const penaltiesApplied = bookings?.filter(b => b.penalty_applied).length || 0;
    const totalPenaltyFees = bookings
      ?.filter(b => b.penalty_applied)
      .reduce((sum, b) => sum + parseFloat(b.penalty_fee || 0), 0) || 0;
    const totalDiscounts = bookings
      ?.reduce((sum, b) => sum + parseFloat(b.discount_amount || 0), 0) || 0;

    return {
      total,
      confirmed,
      cancelled,
      cancellationRate: total > 0 ? (cancelled / total) * 100 : 0,
      penaltiesApplied,
      totalPenaltyFees: totalPenaltyFees.toFixed(2),
      totalDiscounts: totalDiscounts.toFixed(2),
    };
  }
}

export default new BookingService();
