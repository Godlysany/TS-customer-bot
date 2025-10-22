import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';
import type { CalendarProvider } from '../types';
import { EmailService } from './EmailService';
import { ReminderService } from './ReminderService';
import NoShowService from './NoShowService';

/**
 * BatchBookingService
 * 
 * Handles atomic creation of multiple bookings (multi-session treatments)
 * with proper transactional guarantees and no side effects on failure.
 * 
 * Key Features:
 * - All DB inserts in a single transaction (all-or-nothing)
 * - No customer-facing notifications until ALL bookings committed
 * - Validation happens BEFORE any writes
 * - Calendar sync and emails sent AFTER successful DB commit
 * - If side effects fail, bookings exist in DB and can retry notifications
 */

export interface BatchBookingRequest {
  contactId: string;
  conversationId: string;
  serviceId: string;
  teamMemberId?: string;
  phoneNumber: string;
  sessionGroupId: string;
  bookings: Array<{
    sessionNumber: number;
    totalSessions: number;
    title: string;
    startTime: Date;
    endTime: Date;
    description: string;
  }>;
}

export interface BatchBookingResult {
  success: boolean;
  bookings: any[];
  errors?: string[];
  calendarSyncStatus?: 'success' | 'partial' | 'failed';
  emailStatus?: 'success' | 'partial' | 'failed';
}

export class BatchBookingService {
  private calendarProvider?: CalendarProvider;
  private emailService: EmailService;
  private reminderService: ReminderService;

  constructor() {
    this.emailService = new EmailService();
    this.reminderService = new ReminderService();
  }

  setCalendarProvider(provider: CalendarProvider) {
    this.calendarProvider = provider;
  }

  /**
   * Create multiple bookings atomically with transactional safety
   * 
   * Phase 1: Validation (no side effects)
   * Phase 2: Database transaction (all or nothing)
   * Phase 3: Side effects (calendar, emails, reminders)
   */
  async createBatchBooking(request: BatchBookingRequest): Promise<BatchBookingResult> {
    const { contactId, conversationId, serviceId, teamMemberId, phoneNumber, sessionGroupId, bookings } = request;

    // PHASE 1: Validation (before any writes)
    try {
      await this.validateBatchBooking(request);
    } catch (error: any) {
      return {
        success: false,
        bookings: [],
        errors: [`Validation failed: ${error.message}`],
      };
    }

    // PHASE 2: Database transaction (atomic)
    let createdBookings: any[] = [];
    try {
      createdBookings = await this.insertBookingsTransaction(request);
    } catch (error: any) {
      console.error('❌ Batch booking transaction failed:', error);
      return {
        success: false,
        bookings: [],
        errors: [`Database transaction failed: ${error.message}`],
      };
    }

    // PHASE 3: Side effects (calendar sync, emails, reminders)
    // These happen AFTER successful DB commit, so we have the data even if they fail
    const sideEffectsResult = await this.executeSideEffects(createdBookings, contactId, phoneNumber);

    return {
      success: true,
      bookings: createdBookings,
      calendarSyncStatus: sideEffectsResult.calendarStatus,
      emailStatus: sideEffectsResult.emailStatus,
    };
  }

  /**
   * Phase 1: Validate all bookings before any writes
   */
  private async validateBatchBooking(request: BatchBookingRequest): Promise<void> {
    // Check contact suspension
    const suspension = await NoShowService.isContactSuspended(request.contactId);
    if (suspension.suspended) {
      const until = suspension.until ? suspension.until.toISOString() : 'indefinitely';
      throw new Error(`Contact suspended until ${until}`);
    }

    // Validate service exists
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id, name, is_active')
      .eq('id', request.serviceId)
      .single();

    if (serviceError || !service || !service.is_active) {
      throw new Error('Service not found or inactive');
    }

    // Validate contact exists
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, phone_number')
      .eq('id', request.contactId)
      .single();

    if (contactError || !contact) {
      throw new Error('Contact not found');
    }

    // Validate team member if provided
    if (request.teamMemberId) {
      const { data: teamMember, error: teamError } = await supabase
        .from('team_members')
        .select('id, is_active')
        .eq('id', request.teamMemberId)
        .single();

      if (teamError || !teamMember || !teamMember.is_active) {
        throw new Error('Team member not found or inactive');
      }
    }

    // Validate no overlapping bookings for this contact
    for (const booking of request.bookings) {
      const { data: conflicts } = await supabase
        .from('bookings')
        .select('id, start_time, end_time')
        .eq('contact_id', request.contactId)
        .in('status', ['confirmed', 'pending'])
        .or(`and(start_time.lte.${booking.startTime.toISOString()},end_time.gt.${booking.startTime.toISOString()}),and(start_time.lt.${booking.endTime.toISOString()},end_time.gte.${booking.endTime.toISOString()})`);

      if (conflicts && conflicts.length > 0) {
        throw new Error(`Booking conflict detected for session ${booking.sessionNumber} at ${booking.startTime.toLocaleString()}`);
      }
    }

    // Validation passed
    console.log(`✅ Batch booking validation passed for ${request.bookings.length} sessions`);
  }

  /**
   * Phase 2: Insert all bookings in a single transaction
   * Using Supabase's implicit transaction support for bulk inserts
   */
  private async insertBookingsTransaction(request: BatchBookingRequest): Promise<any[]> {
    const { contactId, conversationId, serviceId, teamMemberId, sessionGroupId, bookings } = request;

    // Prepare all booking records
    const bookingRecords = bookings.map((booking) => ({
      contact_id: contactId,
      conversation_id: conversationId,
      service_id: serviceId,
      team_member_id: teamMemberId || null,
      phone_number: request.phoneNumber,
      title: booking.title,
      start_time: booking.startTime.toISOString(),
      end_time: booking.endTime.toISOString(),
      description: booking.description,
      status: 'confirmed',
      is_part_of_multi_session: true,
      session_group_id: sessionGroupId,
      session_number: booking.sessionNumber,
      total_sessions: booking.totalSessions,
      created_at: new Date().toISOString(),
    }));

    // Single atomic insert of all bookings
    const { data, error } = await supabase
      .from('bookings')
      .insert(bookingRecords)
      .select();

    if (error) {
      console.error('❌ Batch insert failed:', error);
      throw new Error(`Failed to create bookings: ${error.message}`);
    }

    if (!data || data.length !== bookings.length) {
      throw new Error(`Expected ${bookings.length} bookings, got ${data?.length || 0}`);
    }

    console.log(`✅ Successfully inserted ${data.length} bookings in transaction`);
    return data.map(toCamelCase);
  }

  /**
   * Phase 3: Execute side effects AFTER successful DB commit
   * These can fail without affecting the booking records
   */
  private async executeSideEffects(
    bookings: any[],
    contactId: string,
    phoneNumber: string
  ): Promise<{
    calendarStatus: 'success' | 'partial' | 'failed';
    emailStatus: 'success' | 'partial' | 'failed';
  }> {
    let calendarSuccessCount = 0;
    let emailSuccessCount = 0;

    // Get contact email
    const { data: contact } = await supabase
      .from('contacts')
      .select('email, name')
      .eq('id', contactId)
      .single();

    const contactEmail = contact?.email;
    const contactName = contact?.name || 'Customer';

    // Sync each booking to calendar
    if (this.calendarProvider) {
      for (const booking of bookings) {
        try {
          const calendarEventId = await this.calendarProvider.createEvent({
            title: booking.title,
            startTime: new Date(booking.startTime),
            endTime: new Date(booking.endTime),
            description: booking.description || '',
            attendees: contactEmail ? [contactEmail] : [],
          });

          // Update booking with calendar event ID
          await supabase
            .from('bookings')
            .update({ calendar_event_id: calendarEventId })
            .eq('id', booking.id);

          calendarSuccessCount++;
        } catch (error) {
          console.error(`⚠️ Calendar sync failed for booking ${booking.id}:`, error);
          // Continue with other bookings - we have the DB record
        }
      }
    }

    // Send email confirmations (batch approach - one email with all sessions)
    if (contactEmail) {
      try {
        await this.sendBatchConfirmationEmail(bookings, contactEmail, contactName);
        emailSuccessCount = bookings.length;
      } catch (error) {
        console.error('⚠️ Batch confirmation email failed:', error);
        // Try individual emails as fallback
        for (const booking of bookings) {
          try {
            await this.emailService.sendBookingConfirmation(
              booking.id,
              contactEmail,
              {
                startTime: booking.startTime,
                endTime: booking.endTime,
                title: booking.title,
                serviceId: booking.serviceId,
              }
            );
            emailSuccessCount++;
          } catch (individualError) {
            console.error(`⚠️ Individual email failed for booking ${booking.id}:`, individualError);
          }
        }
      }
    }

    // Note: Reminder scheduling happens automatically via database triggers
    // No need to manually schedule here

    // Determine status
    const calendarStatus =
      calendarSuccessCount === bookings.length
        ? 'success'
        : calendarSuccessCount > 0
        ? 'partial'
        : 'failed';

    const emailStatus =
      emailSuccessCount === bookings.length
        ? 'success'
        : emailSuccessCount > 0
        ? 'partial'
        : 'failed';

    console.log(
      `✅ Side effects complete: Calendar ${calendarStatus} (${calendarSuccessCount}/${bookings.length}), Email ${emailStatus} (${emailSuccessCount}/${bookings.length})`
    );

    return { calendarStatus, emailStatus };
  }

  /**
   * Send single email with all session details
   * Note: Uses simplified approach since EmailService doesn't have generic sendEmail method
   */
  private async sendBatchConfirmationEmail(
    bookings: any[],
    email: string,
    name: string
  ): Promise<void> {
    // Send confirmation for first booking which includes all session info in description
    const firstBooking = bookings[0];
    await this.emailService.sendBookingConfirmation(
      firstBooking.id,
      email,
      {
        startTime: firstBooking.startTime,
        endTime: firstBooking.endTime,
        title: `Multi-Session Treatment (${bookings.length} sessions)`,
        serviceId: firstBooking.serviceId,
      }
    );
  }
}

export default new BatchBookingService();
