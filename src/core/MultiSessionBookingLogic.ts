import { supabase } from '../infrastructure/supabase';
import { toCamelCase } from '../infrastructure/mapper';
import { randomUUID } from 'crypto';
import batchBookingService from './BatchBookingService';

export interface MultiSessionBookingParams {
  serviceId: string;
  contactId: string;
  conversationId: string;
  phoneNumber: string;
  strategy: 'immediate' | 'sequential' | 'flexible';
  totalSessions: number;
  sessionBufferConfig: any;
  startDateTime: Date;
  durationMinutes: number;
  teamMemberId?: string;
  sessionsToBook?: number; // For flexible strategy
  serviceName?: string;
  serviceCost?: number;
}

export interface SessionSchedule {
  sessionNumber: number;
  startTime: Date;
  endTime: Date;
  description: string;
}

export class MultiSessionBookingLogic {
  constructor() {}

  /**
   * Fetch customer-specific multi-session configuration overrides
   * Returns effective configuration (customer override or service default)
   */
  private async getEffectiveMultiSessionConfig(
    contactId: string,
    serviceId: string,
    serviceDefaults: any
  ): Promise<any> {
    const { data: customerConfig } = await supabase
      .from('customer_multisession_config')
      .select('*')
      .eq('contact_id', contactId)
      .eq('service_id', serviceId)
      .eq('is_active', true)
      .maybeSingle();

    if (!customerConfig) {
      return serviceDefaults;
    }

    return {
      totalSessions: customerConfig.custom_total_sessions || serviceDefaults.totalSessions,
      strategy: customerConfig.custom_strategy || serviceDefaults.strategy,
      sessionBufferConfig: {
        minimum_days: customerConfig.custom_min_days_between_sessions || serviceDefaults.sessionBufferConfig?.minimum_days || 7,
        recommended_days: customerConfig.custom_max_days_between_sessions || serviceDefaults.sessionBufferConfig?.recommended_days || 14,
        buffer_before_minutes: customerConfig.custom_buffer_before_minutes || serviceDefaults.sessionBufferConfig?.buffer_before_minutes || 0,
        buffer_after_minutes: customerConfig.custom_buffer_after_minutes || serviceDefaults.sessionBufferConfig?.buffer_after_minutes || 0,
      },
      notes: customerConfig.notes || null,
    };
  }

  /**
   * Calculate all session dates based on buffer configuration
   */
  calculateSessionSchedule(
    params: MultiSessionBookingParams,
    sessionsCount: number
  ): SessionSchedule[] {
    const schedule: SessionSchedule[] = [];
    const {
 startDateTime,
      sessionBufferConfig,
      strategy,
    } = params;

    let currentDate = new Date(startDateTime);

    for (let i = 1; i <= sessionsCount; i++) {
      schedule.push({
        sessionNumber: i,
        startTime: new Date(currentDate),
        endTime: new Date(currentDate.getTime() + 60 * 60 * 1000), // placeholder, will be set by actual service duration
        description: `Session ${i} of ${params.totalSessions}`,
      });

      // Calculate next session date if not the last one
      if (i < sessionsCount) {
        const bufferDays = this.getBufferDays(i, sessionBufferConfig, strategy);
        currentDate = new Date(currentDate);
        currentDate.setDate(currentDate.getDate() + bufferDays);
      }
    }

    return schedule;
  }

  /**
   * Get buffer days between sessions based on configuration
   */
  private getBufferDays(
    sessionNumber: number,
    bufferConfig: any,
    strategy: string
  ): number {
    if (!bufferConfig) {
      return 7; // default 7 days
    }

    // For immediate strategy, check for specific session-to-session buffers
    if (strategy === 'immediate') {
      const specificKey = `session_${sessionNumber}_to_${sessionNumber + 1}_days`;
      if (bufferConfig[specificKey]) {
        return bufferConfig[specificKey];
      }
    }

    // Check for minimum_days (sequential/flexible)
    if (bufferConfig.minimum_days !== undefined) {
      return bufferConfig.minimum_days;
    }

    // Check for recommended_days
    if (bufferConfig.recommended_days !== undefined) {
      return bufferConfig.recommended_days;
    }

    // Check for default_days
    if (bufferConfig.default_days !== undefined) {
      return bufferConfig.default_days;
    }

    return 7; // fallback default
  }

  /**
   * Book multiple sessions for IMMEDIATE strategy
   * Uses BatchBookingService for atomic transactional safety
   */
  async bookImmediateStrategy(params: MultiSessionBookingParams): Promise<any[]> {
    // Check for customer-specific configuration overrides
    const effectiveConfig = await this.getEffectiveMultiSessionConfig(
      params.contactId,
      params.serviceId,
      {
        totalSessions: params.totalSessions,
        strategy: params.strategy,
        sessionBufferConfig: params.sessionBufferConfig,
      }
    );

    // Use effective configuration (customer override or service default)
    const totalSessions = effectiveConfig.totalSessions;
    const sessionBufferConfig = effectiveConfig.sessionBufferConfig;

    const sessionGroupId = randomUUID();
    const schedule = this.calculateSessionSchedule(
      { ...params, sessionBufferConfig, totalSessions },
      totalSessions
    );

    // Prepare batch booking request
    const batchRequest = {
      contactId: params.contactId,
      conversationId: params.conversationId,
      serviceId: params.serviceId,
      teamMemberId: params.teamMemberId,
      phoneNumber: params.phoneNumber,
      sessionGroupId,
      bookings: schedule.map((session) => ({
        sessionNumber: session.sessionNumber,
        totalSessions: totalSessions,
        title: `${params.serviceName} - Session ${session.sessionNumber}`,
        startTime: session.startTime,
        endTime: new Date(session.startTime.getTime() + params.durationMinutes * 60 * 1000),
        description: `Multi-session treatment: Session ${session.sessionNumber} of ${totalSessions}${effectiveConfig.notes ? ` - ${effectiveConfig.notes}` : ''}`,
      })),
    };

    // Execute atomic batch booking (all or nothing)
    const result = await batchBookingService.createBatchBooking(batchRequest);

    if (!result.success) {
      const errorMsg = result.errors?.join(', ') || 'Unknown error';
      throw new Error(`Failed to book sessions: ${errorMsg}`);
    }

    return result.bookings;
  }

  /**
   * Book first session for SEQUENTIAL strategy
   * Uses BatchBookingService for atomic transactional safety
   */
  async bookSequentialStrategy(params: MultiSessionBookingParams): Promise<any> {
    // Check for customer-specific configuration overrides
    const effectiveConfig = await this.getEffectiveMultiSessionConfig(
      params.contactId,
      params.serviceId,
      {
        totalSessions: params.totalSessions,
        strategy: params.strategy,
        sessionBufferConfig: params.sessionBufferConfig,
      }
    );

    const totalSessions = effectiveConfig.totalSessions;

    const sessionGroupId = randomUUID();

    // Prepare batch booking request for first session only
    const batchRequest = {
      contactId: params.contactId,
      conversationId: params.conversationId,
      serviceId: params.serviceId,
      teamMemberId: params.teamMemberId,
      phoneNumber: params.phoneNumber,
      sessionGroupId,
      bookings: [
        {
          sessionNumber: 1,
          totalSessions: totalSessions,
          title: `${params.serviceName} - Session 1`,
          startTime: params.startDateTime,
          endTime: new Date(params.startDateTime.getTime() + params.durationMinutes * 60 * 1000),
          description: `Multi-session treatment: Session 1 of ${totalSessions} (Sequential)${effectiveConfig.notes ? ` - ${effectiveConfig.notes}` : ''}`,
        },
      ],
    };

    // Execute atomic batch booking
    const result = await batchBookingService.createBatchBooking(batchRequest);

    if (!result.success) {
      const errorMsg = result.errors?.join(', ') || 'Unknown error';
      throw new Error(`Failed to book first session: ${errorMsg}`);
    }

    return result.bookings[0];
  }

  /**
   * Book N sessions for FLEXIBLE strategy
   */
  async bookFlexibleStrategy(params: MultiSessionBookingParams): Promise<any[]> {
    // Check for customer-specific configuration overrides
    const effectiveConfig = await this.getEffectiveMultiSessionConfig(
      params.contactId,
      params.serviceId,
      {
        totalSessions: params.totalSessions,
        strategy: params.strategy,
        sessionBufferConfig: params.sessionBufferConfig,
      }
    );

    const totalSessions = effectiveConfig.totalSessions;
    const sessionBufferConfig = effectiveConfig.sessionBufferConfig;

    const sessionsToBook = params.sessionsToBook || 1;
    
    // Check if there's an existing group for this contact/service
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('session_group_id, session_number')
      .eq('contact_id', params.contactId)
      .eq('service_id', params.serviceId)
      .eq('is_part_of_multi_session', true)
      .order('session_number', { ascending: false })
      .limit(1);

    let sessionGroupId: string;
    let startingSessionNumber: number;

    if (existingBookings && existingBookings.length > 0) {
      // Continue existing group
      sessionGroupId = existingBookings[0].session_group_id;
      startingSessionNumber = existingBookings[0].session_number + 1;
    } else {
      // Create new group
      sessionGroupId = randomUUID();
      startingSessionNumber = 1;
    }

    const schedule = this.calculateSessionSchedule(
      { ...params, startDateTime: params.startDateTime, sessionBufferConfig, totalSessions },
      sessionsToBook
    );

    // Prepare batch booking request for N sessions
    const batchRequest = {
      contactId: params.contactId,
      conversationId: params.conversationId,
      serviceId: params.serviceId,
      teamMemberId: params.teamMemberId,
      phoneNumber: params.phoneNumber,
      sessionGroupId,
      bookings: schedule.map((session, index) => ({
        sessionNumber: startingSessionNumber + index,
        totalSessions: totalSessions,
        title: `${params.serviceName} - Session ${startingSessionNumber + index}`,
        startTime: session.startTime,
        endTime: new Date(session.startTime.getTime() + params.durationMinutes * 60 * 1000),
        description: `Multi-session treatment: Session ${startingSessionNumber + index} of ${totalSessions} (Flexible)${effectiveConfig.notes ? ` - ${effectiveConfig.notes}` : ''}`,
      })),
    };

    // Execute atomic batch booking
    const result = await batchBookingService.createBatchBooking(batchRequest);

    if (!result.success) {
      const errorMsg = result.errors?.join(', ') || 'Unknown error';
      throw new Error(`Failed to book sessions: ${errorMsg}`);
    }

    return result.bookings;
  }

  /**
   * Get multi-session booking progress for a contact
   */
  async getMultiSessionProgress(
    contactId: string,
    serviceId: string
  ): Promise<{
    totalSessions: number;
    bookedSessions: number;
    completedSessions: number;
    remainingSessions: number;
    sessionGroupId: string | null;
  }> {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('contact_id', contactId)
      .eq('service_id', serviceId)
      .eq('is_part_of_multi_session', true)
      .order('session_number', { ascending: true });

    if (!bookings || bookings.length === 0) {
      return {
        totalSessions: 0,
        bookedSessions: 0,
        completedSessions: 0,
        remainingSessions: 0,
        sessionGroupId: null,
      };
    }

    const totalSessions = bookings[0].total_sessions || 0;
    const bookedSessions = bookings.length;
    const completedSessions = bookings.filter(
      (b) => b.status === 'completed'
    ).length;
    const remainingSessions = totalSessions - bookedSessions;

    return {
      totalSessions,
      bookedSessions,
      completedSessions,
      remainingSessions,
      sessionGroupId: bookings[0].session_group_id,
    };
  }

  /**
   * Check if next session should be triggered (for sequential strategy)
   */
  async shouldTriggerNextSession(bookingId: string): Promise<boolean> {
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, services(*)')
      .eq('id', bookingId)
      .single();

    if (!booking || !booking.is_part_of_multi_session) {
      return false;
    }

    // Check if service uses sequential strategy
    const service = booking.services;
    if (service?.multi_session_strategy !== 'sequential') {
      return false;
    }

    // Check if this session is completed
    if (booking.status !== 'completed') {
      return false;
    }

    // Check if there are more sessions to book
    const progress = await this.getMultiSessionProgress(
      booking.contact_id,
      booking.service_id
    );

    return progress.bookedSessions < progress.totalSessions;
  }

  /**
   * Generate progress message for customer
   */
  generateProgressMessage(
    bookedSessions: number,
    completedSessions: number,
    totalSessions: number
  ): string {
    if (completedSessions === totalSessions) {
      return `🏆 Congratulations! You've completed all ${totalSessions} sessions!`;
    }

    if (completedSessions === Math.floor(totalSessions / 2)) {
      return `🎉 Milestone! You're halfway through - ${completedSessions} of ${totalSessions} sessions complete!`;
    }

    if (completedSessions === totalSessions - 1) {
      return `Almost there! Session ${completedSessions} of ${totalSessions} complete. Just 1 more to go!`;
    }

    const remainingToBook = totalSessions - bookedSessions;
    const remainingToComplete = totalSessions - completedSessions;

    if (remainingToBook > 0) {
      return `Progress: ${completedSessions} completed, ${bookedSessions - completedSessions} upcoming, ${remainingToBook} still to book`;
    }

    return `Progress: ${completedSessions} of ${totalSessions} sessions complete. ${remainingToComplete} sessions to go!`;
  }
}

export default new MultiSessionBookingLogic();
