import { supabase } from '../infrastructure/supabase';
import { Booking, CalendarProvider, CalendarEvent } from '../types';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';
import { EmailService } from './EmailService';
import { ReminderService } from './ReminderService';
import { ReviewService } from './ReviewService';
import { SecretaryNotificationService } from './SecretaryNotificationService';
import { SettingsService } from './SettingsService';
import { DocumentService } from './DocumentService';
import NoShowService from './NoShowService';
import PaymentService from './PaymentService';
import botConfigService from './BotConfigService';
import businessHoursService from './BusinessHoursService';
import teamUnavailabilityService from './TeamMemberUnavailabilityService';

/**
 * BookingWorkflowContext
 * 
 * Contains all validated data and metadata needed to create a booking.
 * Used by primitive methods to pass state between validation, persistence, and side effects.
 */
export interface BookingWorkflowContext {
  // Input data
  contactId: string;
  conversationId: string;
  event: CalendarEvent;
  serviceId?: string;
  teamMemberId?: string;
  
  // Validation results
  bufferTimeBefore: number;
  bufferTimeAfter: number;
  actualStartTime: Date;
  actualEndTime: Date;
  
  // Payment info
  discountCode?: string;
  discountAmount?: number;
  promoVoucher?: string;
  
  // Session metadata (for multi-session bookings)
  sessionGroupId?: string;
  sessionNumber?: number;
  totalSessions?: number;
  
  // Contact data (cached from validation)
  contactEmail?: string;
  contactName?: string;
  
  // Team member data (cached from validation)
  teamMemberCalendarId?: string;
}

export class BookingService {
  private calendarProvider: CalendarProvider | null = null;
  private emailService: EmailService;
  private reminderService: ReminderService;
  private reviewService: ReviewService;
  private secretaryService: SecretaryNotificationService;
  private settingsService: SettingsService;
  private documentService: DocumentService;
  private noShowService: typeof NoShowService;

  constructor() {
    this.emailService = new EmailService();
    this.reminderService = new ReminderService();
    this.reviewService = new ReviewService();
    this.secretaryService = new SecretaryNotificationService();
    this.settingsService = new SettingsService();
    this.documentService = new DocumentService();
    this.noShowService = NoShowService;
  }

  setCalendarProvider(provider: CalendarProvider) {
    this.calendarProvider = provider;
  }

  /**
   * Primitive 1: validateAndPrepare()
   * 
   * Validates all booking requirements and prepares context with all necessary data.
   * This includes checking suspensions, payment blocks, service buffers, conflicts, 
   * configuration restrictions, and fetching team member calendar IDs.
   * 
   * @returns BookingWorkflowContext with all validated data
   * @throws Error if validation fails
   */
  async validateAndPrepare(
    contactId: string,
    conversationId: string,
    event: CalendarEvent,
    options?: {
      serviceId?: string;
      teamMemberId?: string;
      discountCode?: string;
      discountAmount?: number;
      promoVoucher?: string;
      sessionGroupId?: string;
      sessionNumber?: number;
      totalSessions?: number;
    }
  ): Promise<BookingWorkflowContext> {
    if (!this.calendarProvider) {
      throw new Error('Calendar provider not initialized');
    }

    // Check contact suspension
    const suspension = await this.noShowService.isContactSuspended(contactId);
    if (suspension.suspended && suspension.until) {
      throw new Error(`Booking privileges suspended until ${suspension.until.toLocaleDateString()}. Please contact us for assistance.`);
    }

    // PAYMENT ENFORCEMENT: Check for outstanding balance before allowing booking
    const { data: contactData } = await supabase
      .from('contacts')
      .select('outstanding_balance_chf, has_overdue_payments, payment_allowance_granted, payment_restriction_reason, email, name')
      .eq('id', contactId)
      .single();

    let contactEmail: string | undefined;
    let contactName: string | undefined;

    if (contactData) {
      const contact = toCamelCase(contactData);
      
      // Cache contact data for later use
      contactEmail = contact.email;
      contactName = contact.name;
      
      // Block booking if customer has outstanding balance (unless admin granted allowance)
      if (contact.outstandingBalanceChf > 0 && !contact.paymentAllowanceGranted) {
        const restrictionReason = contact.paymentRestrictionReason || 
          `You have an outstanding balance of CHF ${contact.outstandingBalanceChf.toFixed(2)} that must be settled before booking new appointments.`;
        
        console.log(`🚫 Booking blocked for contact ${contactId}: Outstanding balance CHF ${contact.outstandingBalanceChf}`);
        throw new Error(`PAYMENT_REQUIRED: ${restrictionReason}`);
      }

      // Warning for overdue payments even if allowance granted
      if (contact.hasOverduePayments && contact.paymentAllowanceGranted) {
        console.warn(`⚠️ Booking allowed with admin override despite overdue payments for contact ${contactId}`);
      }
    }

    // Fetch service buffers if service provided
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

    // Calculate actual start/end times with buffers
    const actualStartTime = new Date(event.startTime);
    actualStartTime.setMinutes(actualStartTime.getMinutes() - bufferTimeBefore);

    const actualEndTime = new Date(event.endTime);
    actualEndTime.setMinutes(actualEndTime.getMinutes() + bufferTimeAfter);

    // Check configuration restrictions (opening hours, emergency blockers, service restrictions)
    await this.checkConfigurationRestrictions(event, options?.serviceId);

    // Check buffered conflicts
    await this.checkBufferedConflicts(
      actualStartTime,
      actualEndTime,
      options?.serviceId
    );

    // Fetch and validate team member if provided
    let teamMemberCalendarId: string | undefined;
    if (options?.teamMemberId) {
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('calendar_id, is_active, availability_schedule')
        .eq('id', options.teamMemberId)
        .single();

      if (!teamMember || !teamMember.is_active) {
        throw new Error('Team member not found or inactive');
      }

      // CRITICAL: Verify team member is assigned to this service
      if (options.serviceId) {
        const { data: assignment } = await supabase
          .from('service_team_members')
          .select('id')
          .eq('service_id', options.serviceId)
          .eq('team_member_id', options.teamMemberId)
          .single();

        if (!assignment) {
          throw new Error('Team member is not assigned to this service');
        }
      }

      // CRITICAL: Check team member's availability schedule (using buffered times)
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayNames[actualStartTime.getDay()];
      
      const schedule = (teamMember.availability_schedule as any)?.[dayOfWeek] || [];
      
      if (schedule.length === 0) {
        throw new Error(`Team member is not available on ${dayOfWeek}s`);
      }

      // Convert buffered start and end times to HH:MM format
      const startHours = String(actualStartTime.getHours()).padStart(2, '0');
      const startMinutes = String(actualStartTime.getMinutes()).padStart(2, '0');
      const startTimeStr = `${startHours}:${startMinutes}`;
      
      const endHours = String(actualEndTime.getHours()).padStart(2, '0');
      const endMinutes = String(actualEndTime.getMinutes()).padStart(2, '0');
      const endTimeStr = `${endHours}:${endMinutes}`;

      // Verify ENTIRE booking (start to end) falls within at least one availability window
      const isWithinSchedule = schedule.some((window: any) => {
        return startTimeStr >= window.start && endTimeStr <= window.end;
      });

      if (!isWithinSchedule) {
        throw new Error(`Team member is not available from ${startTimeStr} to ${endTimeStr} on ${dayOfWeek}s`);
      }

      // CRITICAL: Check for team member unavailability periods (holidays, time off)
      const unavailabilityConflicts = await teamUnavailabilityService.getConflicts(
        options.teamMemberId,
        actualStartTime,
        actualEndTime
      );

      if (unavailabilityConflicts.length > 0) {
        const conflict = unavailabilityConflicts[0];
        const reasonMap: Record<string, string> = {
          vacation: 'on vacation',
          sick_leave: 'on sick leave',
          training: 'in training',
          personal: 'taking personal time',
          emergency: 'unavailable (emergency)',
          other: 'unavailable',
        };
        const reasonText = reasonMap[conflict.reason] || 'unavailable';
        throw new Error(`Team member is ${reasonText} during this time period. Please choose a different date or time.`);
      }

      // CRITICAL: Check for team member conflicts (their existing bookings with buffers)
      // Overlap condition: actual_start_time < actualEndTime AND actual_end_time > actualStartTime
      // MUST use buffered columns (actual_start_time/actual_end_time) not base times
      const { data: teamMemberConflicts } = await supabase
        .from('bookings')
        .select('id, title, actual_start_time, actual_end_time')
        .eq('team_member_id', options.teamMemberId)
        .in('status', ['confirmed', 'pending'])
        .lt('actual_start_time', actualEndTime.toISOString())
        .gt('actual_end_time', actualStartTime.toISOString());

      if (teamMemberConflicts && teamMemberConflicts.length > 0) {
        const conflictTitles = teamMemberConflicts.map(c => c.title).join(', ');
        throw new Error(`Team member is already booked at this time. Conflicts with: ${conflictTitles}`);
      }

      teamMemberCalendarId = teamMember.calendar_id;
    }

    // Build and return context
    return {
      contactId,
      conversationId,
      event,
      serviceId: options?.serviceId,
      teamMemberId: options?.teamMemberId,
      bufferTimeBefore,
      bufferTimeAfter,
      actualStartTime,
      actualEndTime,
      discountCode: options?.discountCode,
      discountAmount: options?.discountAmount,
      promoVoucher: options?.promoVoucher,
      sessionGroupId: options?.sessionGroupId,
      sessionNumber: options?.sessionNumber,
      totalSessions: options?.totalSessions,
      contactEmail,
      contactName,
      teamMemberCalendarId,
    };
  }

  /**
   * Primitive 2: persistBooking()
   * 
   * Persists the booking to both calendar and database.
   * Creates calendar event (using team member's calendar if specified) and 
   * inserts booking record with all metadata.
   * 
   * @returns Created booking record
   * @throws Error if persistence fails
   */
  async persistBooking(context: BookingWorkflowContext): Promise<Booking> {
    if (!this.calendarProvider) {
      throw new Error('Calendar provider not initialized');
    }

    // Create calendar event (with team member's calendar ID if specified)
    const calendarEvent = {
      ...context.event,
      calendarId: context.teamMemberCalendarId,
    };
    
    const calendarEventId = await this.calendarProvider.createEvent(calendarEvent);

    // Insert booking into database with all metadata
    const { data, error } = await supabase
      .from('bookings')
      .insert(toSnakeCase({
        contactId: context.contactId,
        conversationId: context.conversationId,
        calendarEventId,
        title: context.event.title,
        startTime: context.event.startTime,
        endTime: context.event.endTime,
        serviceId: context.serviceId,
        teamMemberId: context.teamMemberId,
        actualStartTime: context.actualStartTime,
        actualEndTime: context.actualEndTime,
        bufferTimeBefore: context.bufferTimeBefore,
        bufferTimeAfter: context.bufferTimeAfter,
        status: 'confirmed',
        discountCode: context.discountCode,
        discountAmount: context.discountAmount || 0,
        promoVoucher: context.promoVoucher,
        sessionGroupId: context.sessionGroupId,
        sessionNumber: context.sessionNumber,
        totalSessions: context.totalSessions,
        emailSent: false,
        reminderSent: false,
      }))
      .select()
      .single();

    if (error) throw error;
    
    return toCamelCase(data) as Booking;
  }

  /**
   * Primitive 3: finalizeSideEffects()
   * 
   * Executes all side effects after successful booking persistence.
   * Sends emails, schedules reminders, notifies secretary, and schedules document delivery.
   * 
   * @param booking Created booking record
   * @param context Booking workflow context
   */
  async finalizeSideEffects(booking: Booking, context: BookingWorkflowContext): Promise<void> {
    // Send email confirmation if contact has email
    if (context.contactEmail) {
      await this.emailService.sendBookingConfirmation(booking.id, context.contactEmail, {
        ...booking,
        contactName: context.contactName,
      });

      await supabase
        .from('bookings')
        .update({ email_sent: true })
        .eq('id', booking.id);
    }

    // Schedule reminders
    await this.reminderService.scheduleAppointmentReminder(
      booking.id, 
      context.contactId, 
      context.event.startTime
    );

    // Schedule review request
    await this.reviewService.scheduleReviewRequest(booking.id, context.contactId);

    // Notify secretary
    await this.secretaryService.notifyBookingCreated(toSnakeCase(booking));

    // Schedule document delivery if service provided
    if (context.serviceId) {
      await this.documentService.scheduleDocumentDelivery(booking.id);
    }
  }

  /**
   * Primitive 4: rollbackBooking()
   * 
   * Rolls back a booking by deleting it from database and calendar.
   * Used when side effects fail after successful persistence.
   * 
   * @param bookingId Booking ID to rollback
   * @param calendarEventId Calendar event ID to delete
   */
  async rollbackBooking(bookingId: string, calendarEventId: string): Promise<void> {
    console.error(`🔄 Rolling back booking ${bookingId}`);

    // Delete from database
    const { error: dbError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (dbError) {
      console.error(`❌ Failed to delete booking from database: ${dbError.message}`);
    }

    // Delete from calendar
    if (this.calendarProvider) {
      try {
        await this.calendarProvider.deleteEvent(calendarEventId);
      } catch (calError) {
        console.error(`❌ Failed to delete calendar event: ${calError}`);
      }
    }

    console.log(`✅ Booking ${bookingId} rolled back`);
  }

  /**
   * Create a single booking with full validation and side effects.
   * 
   * This method orchestrates the four primitive methods to create a booking:
   * 1. validateAndPrepare() - Validates all requirements and prepares context
   * 2. persistBooking() - Creates calendar event and database record
   * 3. finalizeSideEffects() - Sends emails, schedules reminders, etc.
   * 4. rollbackBooking() - Rolls back if side effects fail (optional)
   * 
   * @param contactId Contact ID
   * @param conversationId Conversation ID
   * @param event Calendar event details
   * @param options Optional booking parameters (service, discounts, etc.)
   * @returns Created booking record
   * @throws Error if validation or persistence fails
   */
  async createBooking(
    contactId: string, 
    conversationId: string, 
    event: CalendarEvent,
    options?: {
      serviceId?: string;
      teamMemberId?: string;
      discountCode?: string;
      discountAmount?: number;
      promoVoucher?: string;
    }
  ): Promise<Booking> {
    let booking: Booking | null = null;
    let calendarEventId: string | null = null;

    try {
      // Step 1: Validate and prepare context
      const context = await this.validateAndPrepare(contactId, conversationId, event, options);

      // Step 2: Persist booking to calendar and database
      booking = await this.persistBooking(context);
      calendarEventId = booking.calendarEventId;

      // Step 3: Finalize side effects (emails, reminders, etc.)
      await this.finalizeSideEffects(booking, context);

      return booking;
    } catch (error) {
      // If persistence succeeded but side effects failed, rollback
      if (booking && calendarEventId) {
        console.error('⚠️ Side effects failed after successful booking creation, rolling back...');
        await this.rollbackBooking(booking.id, calendarEventId);
      }
      throw error;
    }
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

  async cancelBooking(bookingId: string, reason?: string): Promise<{ penaltyApplied: boolean; penaltyFee: number; refunded: boolean }> {
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

    let refunded = false;
    if (booking.paymentStatus === 'paid' && !isLateCancellation) {
      try {
        const refundResult = await PaymentService.handleCancellationRefund(bookingId);
        if (refundResult) {
          refunded = true;
        }
      } catch (error) {
        console.error('Failed to process refund:', error);
      }
    }

    // PENALTY ENFORCEMENT: Create actual payment transaction for late cancellation fee
    if (isLateCancellation && penaltyFee > 0) {
      try {
        console.log(`💰 Creating penalty payment transaction: CHF ${penaltyFee} for late cancellation`);
        
        // Create payment transaction record (using 'amount' column, NOT amount_chf)
        const { data: penaltyTransaction, error: penaltyError } = await supabase
          .from('payment_transactions')
          .insert(toSnakeCase({
            bookingId: bookingId,
            contactId: booking.contactId,
            serviceId: booking.serviceId,
            amount: penaltyFee, // Base amount column
            currency: 'CHF',
            status: 'pending',
            paymentType: 'penalty',
            isPenalty: true,
            relatedBookingId: bookingId,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            notes: `Late cancellation penalty for booking cancelled ${hoursUntilAppointment.toFixed(1)} hours before appointment`,
            metadata: {
              reason: 'late_cancellation',
              hours_until_appointment: hoursUntilAppointment,
              policy_hours: policyHours,
              cancellation_reason: reason,
            }
          }))
          .select()
          .single();

        if (penaltyError) {
          console.error('❌ Failed to create penalty transaction:', penaltyError);
        } else {
          console.log(`✅ Penalty transaction created: ${penaltyTransaction.id}`);
          
          // Send Stripe payment link for penalty via WhatsApp (async, don't block cancellation)
          this.sendPenaltyPaymentLink(penaltyTransaction.id, booking.contactId, penaltyFee, booking).catch(err => {
            console.error('❌ Failed to send penalty payment link:', err);
          });
        }
      } catch (error) {
        console.error('❌ Penalty transaction creation failed:', error);
        // Don't block cancellation if penalty tracking fails
      }
    }

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
      refunded,
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

  private async checkConfigurationRestrictions(event: CalendarEvent, serviceId?: string): Promise<void> {
    const config = await botConfigService.getConfig();

    // Check if booking feature is enabled
    if (!config.enable_booking) {
      throw new Error('Booking feature is currently disabled. Please contact us for assistance.');
    }

    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);

    // CRITICAL: Fetch service buffers to validate BUFFERED interval (not just appointment time)
    let bufferBefore = 0;
    let bufferAfter = 0;

    if (serviceId) {
      const { data: service } = await supabase
        .from('services')
        .select('buffer_time_before, buffer_time_after')
        .eq('id', serviceId)
        .single();

      if (service) {
        bufferBefore = service.buffer_time_before || 0;
        bufferAfter = service.buffer_time_after || 0;
      }
    }

    // Calculate BUFFERED start/end times (actual time slot occupied)
    const actualStartTime = new Date(startTime);
    actualStartTime.setMinutes(actualStartTime.getMinutes() - bufferBefore);

    const actualEndTime = new Date(endTime);
    actualEndTime.setMinutes(actualEndTime.getMinutes() + bufferAfter);

    // CRITICAL: Reject bookings that cross day boundaries (buffers pushing past midnight)
    if (actualStartTime.getDate() !== actualEndTime.getDate()) {
      const bufferNote = (bufferBefore > 0 || bufferAfter > 0) 
        ? ` (with ${bufferBefore}min setup + ${bufferAfter}min cleanup)` 
        : '';
      throw new Error(`Your appointment${bufferNote} would cross midnight. Please schedule earlier in the day or choose a shorter appointment.`);
    }

    // CRITICAL: Check ENTIRE BUFFERED interval falls within business hours
    // This prevents bookings with buffers from spanning breaks or crossing closing/opening boundaries
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = actualStartTime.getDay();
    const dayName = dayNames[dayOfWeek];
    
    // Get available windows for this day (excludes breaks and closed periods)
    const availableWindows = await businessHoursService.getAvailableWindows(dayOfWeek);
    
    if (availableWindows.length === 0) {
      throw new Error(`We are closed on ${dayName}. Please choose a different day.`);
    }

    // Convert BUFFERED booking times to minutes-since-midnight for accurate comparison
    const actualStartMinutes = actualStartTime.getHours() * 60 + actualStartTime.getMinutes();
    const actualEndMinutes = actualEndTime.getHours() * 60 + actualEndTime.getMinutes();

    // Check if ENTIRE BUFFERED interval falls within at least one available window
    const fitsInWindow = availableWindows.some(window => {
      // Convert window times to minutes-since-midnight
      const [windowStartHour, windowStartMin] = window.start.split(':').map(Number);
      const [windowEndHour, windowEndMin] = window.end.split(':').map(Number);
      const windowStartMinutes = windowStartHour * 60 + windowStartMin;
      const windowEndMinutes = windowEndHour * 60 + windowEndMin;
      
      return actualStartMinutes >= windowStartMinutes && actualEndMinutes <= windowEndMinutes;
    });

    if (!fitsInWindow) {
      // Provide helpful error message
      const bufferNote = (bufferBefore > 0 || bufferAfter > 0) 
        ? ` (including ${bufferBefore}min setup + ${bufferAfter}min cleanup time)` 
        : '';
      
      if (availableWindows.length === 1) {
        throw new Error(`Your appointment${bufferNote} must be scheduled within our business hours: ${availableWindows[0].start}-${availableWindows[0].end} on ${dayName}.`);
      } else {
        // Multiple windows (has a break)
        const windowsText = availableWindows.map(w => `${w.start}-${w.end}`).join(' and ');
        throw new Error(`Your appointment${bufferNote} must fit within our available hours on ${dayName}: ${windowsText}. Please avoid scheduling across our break period.`);
      }
    }
    
    // Check emergency blocker slots
    for (const blocker of config.emergency_blocker_slots) {
      const blockerStart = new Date(blocker.start_date);
      const blockerEnd = new Date(blocker.end_date);
      blockerEnd.setHours(23, 59, 59); // End of day
      
      if (startTime >= blockerStart && startTime <= blockerEnd) {
        throw new Error(`This time slot is unavailable. ${blocker.reason}. Please choose a different date.`);
      }
    }

    // Check service-specific time restrictions if service is provided
    if (serviceId) {
      // Get service name from ID to lookup restrictions
      const { data: service } = await supabase
        .from('services')
        .select('name')
        .eq('id', serviceId)
        .single();

      if (!service) {
        console.warn(`Service ${serviceId} not found in database`);
        return;
      }

      const serviceName = service.name;
      
      // Try lookup by service ID first, then by service name
      let serviceRestrictions = config.service_time_restrictions[serviceId] || config.service_time_restrictions[serviceName];
      
      if (serviceRestrictions) {
        console.log(`✅ Found restrictions for "${serviceName}"`);
        const dayOfWeek = startTime.getDay(); // 0 = Sunday, 6 = Saturday
        const hour = startTime.getHours();
        const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

        // Check minimum slot duration
        if (serviceRestrictions.min_slot_hours && durationHours < serviceRestrictions.min_slot_hours) {
          throw new Error(`${serviceName} requires a minimum of ${serviceRestrictions.min_slot_hours} hours. Please choose a longer time slot.`);
        }

        // Check maximum slot duration
        if (serviceRestrictions.max_slot_hours && durationHours > serviceRestrictions.max_slot_hours) {
          throw new Error(`${serviceName} has a maximum duration of ${serviceRestrictions.max_slot_hours} hours. Please choose a shorter time slot.`);
        }

        // Check if only mornings
        if (serviceRestrictions.only_mornings && hour >= 12) {
          throw new Error(`${serviceName} is only available in the morning (before 12:00 PM). Please choose an earlier time.`);
        }

        // Check if only afternoons
        if (serviceRestrictions.only_afternoons && hour < 12) {
          throw new Error(`${serviceName} is only available in the afternoon (after 12:00 PM). Please choose a later time.`);
        }

        // Check if only weekdays
        if (serviceRestrictions.only_weekdays && (dayOfWeek === 0 || dayOfWeek === 6)) {
          throw new Error(`${serviceName} is only available on weekdays (Monday-Friday). Please choose a weekday.`);
        }

        // Check excluded days
        if (serviceRestrictions.excluded_days && serviceRestrictions.excluded_days.length > 0) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const currentDay = dayNames[dayOfWeek];
          if (serviceRestrictions.excluded_days.includes(currentDay)) {
            throw new Error(`${serviceName} is not available on ${currentDay}. Please choose a different day.`);
          }
        }
      }
    }

    console.log('✅ Configuration restrictions check passed');
  }

  private async checkOpeningHours(requestedTime: Date, openingHoursConfig: string): Promise<void> {
    if (!openingHoursConfig || openingHoursConfig.trim() === '') {
      // No opening hours configured, allow all times
      return;
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const requestedDay = dayNames[requestedTime.getDay()];
    const requestedHour = requestedTime.getHours();
    const requestedMinute = requestedTime.getMinutes();
    const requestedTimeInMinutes = requestedHour * 60 + requestedMinute;

    // Parse opening hours (example format: "Monday-Friday: 09:00-18:00\nSaturday: 09:00-14:00\nSunday: Closed")
    const lines = openingHoursConfig.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Parse line format: "Day(s): HH:MM-HH:MM" or "Day: Closed"
      const parts = trimmedLine.split(':');
      if (parts.length < 2) continue;

      const dayPart = parts[0].trim();
      const timePart = parts.slice(1).join(':').trim().toLowerCase();

      // Check if this line applies to the requested day
      let appliesToDay = false;

      if (dayPart.includes('-')) {
        // Range format: "Monday-Friday"
        const [startDay, endDay] = dayPart.split('-').map(d => d.trim());
        const startIdx = dayNames.indexOf(startDay);
        const endIdx = dayNames.indexOf(endDay);
        const requestedIdx = dayNames.indexOf(requestedDay);

        if (startIdx !== -1 && endIdx !== -1 && requestedIdx !== -1) {
          // Handle wrap-around (e.g., Friday-Monday)
          if (startIdx <= endIdx) {
            appliesToDay = requestedIdx >= startIdx && requestedIdx <= endIdx;
          } else {
            appliesToDay = requestedIdx >= startIdx || requestedIdx <= endIdx;
          }
        }
      } else {
        // Single day or comma-separated days
        const days = dayPart.split(',').map(d => d.trim());
        appliesToDay = days.some(d => requestedDay.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(requestedDay.toLowerCase()));
      }

      if (!appliesToDay) continue;

      // Check if closed
      if (timePart.includes('closed')) {
        throw new Error(`We are closed on ${requestedDay}. Please choose a different day.`);
      }

      // Parse time range: "09:00-18:00"
      const timeMatch = timePart.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      if (!timeMatch) continue;

      const [, startHour, startMin, endHour, endMin] = timeMatch.map(Number);
      const openingTimeInMinutes = startHour * 60 + startMin;
      const closingTimeInMinutes = endHour * 60 + endMin;

      if (requestedTimeInMinutes < openingTimeInMinutes) {
        throw new Error(
          `This time is before our opening hours on ${requestedDay}. We open at ${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}.`
        );
      }

      if (requestedTimeInMinutes >= closingTimeInMinutes) {
        throw new Error(
          `This time is after our closing hours on ${requestedDay}. We close at ${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}.`
        );
      }

      // Time is within hours
      return;
    }

    // If we get here and didn't find a matching day, assume closed
    throw new Error(`Opening hours not configured for ${requestedDay}. Please contact us for available times.`);
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

  /**
   * Send penalty payment link to customer via WhatsApp
   */
  private async sendPenaltyPaymentLink(
    transactionId: string,
    contactId: string,
    penaltyAmount: number,
    booking: any
  ): Promise<void> {
    try {
      const { data: contact } = await supabase
        .from('contacts')
        .select('phone_number, name, language')
        .eq('id', contactId)
        .single();

      if (!contact?.phone_number) {
        console.error('❌ Cannot send penalty link: No phone number for contact');
        return;
      }

      // Create Stripe payment intent for penalty
      const paymentResult = await PaymentService.createPaymentIntent(
        penaltyAmount,
        contactId,
        booking.id,
        booking.serviceId,
        'penalty',
        {
          reason: 'late_cancellation',
          transaction_id: transactionId,
        }
      );

      // Update transaction with Stripe payment intent ID
      await supabase
        .from('payment_transactions')
        .update({
          stripe_payment_intent_id: paymentResult.paymentIntentId,
        })
        .eq('id', transactionId);

      // Generate payment link
      const paymentLinkService = (await import('./PaymentLinkService')).default;
      
      const paymentLink = await paymentLinkService.createPaymentLink({
        contact_id: contactId,
        booking_id: booking.id,
        amount_chf: penaltyAmount,
        description: `Late cancellation penalty for ${booking.title}`,
        metadata: {
          purpose: 'penalty',
          transaction_id: transactionId,
        },
      });

      // Send WhatsApp message with payment link
      const language = contact.language || 'de';
      const messages: Record<string, string> = {
        de: `⚠️ *Stornierungsgebühr*\n\nDa Sie Ihren Termin weniger als 24 Stunden im Voraus storniert haben, fällt eine Gebühr von CHF ${penaltyAmount.toFixed(2)} an.\n\nBitte begleichen Sie diese Gebühr innerhalb von 7 Tagen:\n${paymentLink.checkout_url}\n\nSobald die Zahlung eingegangen ist, können Sie wieder neue Termine buchen.`,
        en: `⚠️ *Cancellation Fee*\n\nSince you cancelled your appointment less than 24 hours in advance, a fee of CHF ${penaltyAmount.toFixed(2)} applies.\n\nPlease settle this fee within 7 days:\n${paymentLink.checkout_url}\n\nOnce payment is received, you'll be able to book new appointments again.`,
        fr: `⚠️ *Frais d'annulation*\n\nComme vous avez annulé votre rendez-vous moins de 24 heures à l'avance, des frais de CHF ${penaltyAmount.toFixed(2)} s'appliquent.\n\nVeuillez régler ces frais dans les 7 jours:\n${paymentLink.checkout_url}\n\nUne fois le paiement reçu, vous pourrez à nouveau réserver des rendez-vous.`,
      };

      const message = messages[language] || messages.de;

      // Send via WhatsApp
      try {
        const whatsappModule = await import('../adapters/whatsapp');
        const sock = whatsappModule.default;
        if (sock) {
          const formattedPhone = contact.phone_number.includes('@') ? contact.phone_number : `${contact.phone_number}@s.whatsapp.net`;
          await sock.sendMessage(formattedPhone, { text: message });
          console.log(`✅ Penalty payment link sent to ${contact.name} (CHF ${penaltyAmount})`);
        }
      } catch (whatsappError) {
        console.error('❌ Failed to send penalty link via WhatsApp:', whatsappError);
      }
    } catch (error) {
      console.error('❌ Failed to send penalty payment link:', error);
      throw error;
    }
  }
}

export default new BookingService();
