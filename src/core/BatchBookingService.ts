import type { CalendarProvider, CalendarEvent } from '../types';
import bookingService from './BookingService';
import type { BookingWorkflowContext } from './BookingService';

/**
 * BatchBookingService
 * 
 * Handles atomic creation of multiple bookings (multi-session treatments)
 * using BookingService primitives for consistency and feature completeness.
 * 
 * Key Features:
 * - Uses BookingService.validateAndPrepare() for validation (includes payment blocks, suspensions, conflicts)
 * - Uses BookingService.persistBooking() for calendar + DB creation
 * - Uses BookingService.finalizeSideEffects() for emails, reminders, documents
 * - Uses BookingService.rollbackBooking() for cleanup on failure
 * - All-or-nothing atomicity maintained (rollback on any failure)
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
  setCalendarProvider(provider: CalendarProvider) {
    bookingService.setCalendarProvider(provider);
  }

  /**
   * Create multiple bookings atomically using BookingService primitives
   * 
   * Phase 1: Validate all sessions using bookingService.validateAndPrepare()
   * Phase 2: Persist all bookings using bookingService.persistBooking()
   * Phase 3: Finalize side effects using bookingService.finalizeSideEffects()
   * Phase 4: Rollback all on failure using bookingService.rollbackBooking()
   */
  async createBatchBooking(request: BatchBookingRequest): Promise<BatchBookingResult> {
    const { contactId, conversationId, serviceId, teamMemberId, sessionGroupId, bookings } = request;

    const contexts: BookingWorkflowContext[] = [];
    const createdBookings: any[] = [];

    try {
      // PHASE 1: Validate all sessions
      console.log(`📋 Validating ${bookings.length} sessions for batch booking...`);
      for (const booking of bookings) {
        const event: CalendarEvent = {
          title: booking.title,
          description: booking.description,
          startTime: booking.startTime,
          endTime: booking.endTime,
        };

        const context = await bookingService.validateAndPrepare(
          contactId,
          conversationId,
          event,
          {
            serviceId,
            teamMemberId,
            sessionGroupId,
            sessionNumber: booking.sessionNumber,
            totalSessions: booking.totalSessions,
          }
        );

        contexts.push(context);
      }
      console.log(`✅ All ${bookings.length} sessions validated successfully`);

      // PHASE 2: Persist all bookings (calendar events + DB inserts)
      console.log(`💾 Persisting ${contexts.length} bookings...`);
      for (const context of contexts) {
        const booking = await bookingService.persistBooking(context);
        createdBookings.push(booking);
      }
      console.log(`✅ All ${createdBookings.length} bookings persisted successfully`);

      // PHASE 3: Finalize side effects for all bookings
      console.log(`📧 Finalizing side effects (emails, reminders, documents)...`);
      for (let i = 0; i < createdBookings.length; i++) {
        const booking = createdBookings[i];
        const context = contexts[i];
        await bookingService.finalizeSideEffects(booking, context);
      }
      console.log(`✅ All side effects finalized successfully`);

      return {
        success: true,
        bookings: createdBookings,
        calendarSyncStatus: 'success',
        emailStatus: 'success',
      };

    } catch (error: any) {
      console.error(`❌ Batch booking failed: ${error.message}`);

      // PHASE 4: Rollback all created bookings
      if (createdBookings.length > 0) {
        console.log(`🔄 Rolling back ${createdBookings.length} created bookings...`);
        for (const booking of createdBookings) {
          try {
            await bookingService.rollbackBooking(booking.id, booking.calendarEventId);
          } catch (rollbackError) {
            console.error(`⚠️ Rollback failed for booking ${booking.id}:`, rollbackError);
          }
        }
        console.log(`✅ Rollback complete`);
      }

      return {
        success: false,
        bookings: [],
        errors: [error.message],
      };
    }
  }

}

export default new BatchBookingService();
