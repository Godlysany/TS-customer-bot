import { supabase } from '../infrastructure/supabase';
import { toCamelCase } from '../infrastructure/mapper';
import { v4 as uuid_v4 } from 'uuid';

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
   */
  async bookImmediateStrategy(params: MultiSessionBookingParams): Promise<any[]> {
    const sessionGroupId = uuid_v4();
    const schedule = this.calculateSessionSchedule(params, params.totalSessions);

    const bookings = [];

    for (const session of schedule) {
      try {
        // Create booking record directly in database with multi-session fields
        const { data: booking, error } = await supabase
          .from('bookings')
          .insert({
            contact_id: params.contactId,
            service_id: params.serviceId,
            team_member_id: params.teamMemberId,
            start_time: session.startTime.toISOString(),
            end_time: new Date(
              session.startTime.getTime() + params.durationMinutes * 60 * 1000
            ).toISOString(),
            title: `${params.serviceName} - Session ${session.sessionNumber}`,
            status: 'confirmed',
            phone_number: params.phoneNumber,
            is_part_of_multi_session: true,
            session_group_id: sessionGroupId,
            session_number: session.sessionNumber,
            total_sessions: params.totalSessions,
          })
          .select()
          .single();

        if (error) throw error;
        bookings.push(toCamelCase(booking));
      } catch (error) {
        console.error(`Failed to book session ${session.sessionNumber}:`, error);
        // If any session fails, we should rollback previous ones
        // For now, just continue and return what succeeded
      }
    }

    return bookings;
  }

  /**
   * Book first session for SEQUENTIAL strategy
   */
  async bookSequentialStrategy(params: MultiSessionBookingParams): Promise<any> {
    const sessionGroupId = uuid_v4();

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        contact_id: params.contactId,
        service_id: params.serviceId,
        team_member_id: params.teamMemberId,
        start_time: params.startDateTime.toISOString(),
        end_time: new Date(
          params.startDateTime.getTime() + params.durationMinutes * 60 * 1000
        ).toISOString(),
        title: `${params.serviceName} - Session 1`,
        status: 'confirmed',
        phone_number: params.phoneNumber,
        is_part_of_multi_session: true,
        session_group_id: sessionGroupId,
        session_number: 1,
        total_sessions: params.totalSessions,
      })
      .select()
      .single();

    if (error) throw error;
    return toCamelCase(booking);
  }

  /**
   * Book N sessions for FLEXIBLE strategy
   */
  async bookFlexibleStrategy(params: MultiSessionBookingParams): Promise<any[]> {
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
      sessionGroupId = uuid_v4();
      startingSessionNumber = 1;
    }

    const schedule = this.calculateSessionSchedule(
      { ...params, startDateTime: params.startDateTime },
      sessionsToBook
    );

    const bookings = [];

    for (let i = 0; i < schedule.length; i++) {
      const session = schedule[i];
      const sessionNumber = startingSessionNumber + i;

      try {
        const { data: booking, error } = await supabase
          .from('bookings')
          .insert({
            contact_id: params.contactId,
            service_id: params.serviceId,
            team_member_id: params.teamMemberId,
            start_time: session.startTime.toISOString(),
            end_time: new Date(
              session.startTime.getTime() + params.durationMinutes * 60 * 1000
            ).toISOString(),
            title: `${params.serviceName} - Session ${sessionNumber}`,
            status: 'confirmed',
            phone_number: params.phoneNumber,
            is_part_of_multi_session: true,
            session_group_id: sessionGroupId,
            session_number: sessionNumber,
            total_sessions: params.totalSessions,
          })
          .select()
          .single();

        if (error) throw error;
        bookings.push(toCamelCase(booking));
      } catch (error) {
        console.error(`Failed to book session ${sessionNumber}:`, error);
      }
    }

    return bookings;
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
