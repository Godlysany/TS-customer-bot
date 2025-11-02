"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchBookingService = void 0;
const BookingService_1 = __importDefault(require("./BookingService"));
class BatchBookingService {
    setCalendarProvider(provider) {
        BookingService_1.default.setCalendarProvider(provider);
    }
    /**
     * Create multiple bookings atomically using BookingService primitives
     *
     * Phase 1: Validate all sessions using bookingService.validateAndPrepare()
     * Phase 2: Persist all bookings using bookingService.persistBooking()
     * Phase 3: Finalize side effects using bookingService.finalizeSideEffects()
     * Phase 4: Rollback all on failure using bookingService.rollbackBooking()
     */
    async createBatchBooking(request) {
        const { contactId, conversationId, serviceId, teamMemberId, sessionGroupId, bookings } = request;
        const contexts = [];
        const createdBookings = [];
        try {
            // PHASE 1: Validate all sessions
            console.log(`📋 Validating ${bookings.length} sessions for batch booking...`);
            for (const booking of bookings) {
                const event = {
                    title: booking.title,
                    description: booking.description,
                    startTime: booking.startTime,
                    endTime: booking.endTime,
                };
                const context = await BookingService_1.default.validateAndPrepare(contactId, conversationId, event, {
                    serviceId,
                    teamMemberId,
                    sessionGroupId,
                    sessionNumber: booking.sessionNumber,
                    totalSessions: booking.totalSessions,
                });
                contexts.push(context);
            }
            console.log(`✅ All ${bookings.length} sessions validated successfully`);
            // PHASE 2: Persist all bookings (calendar events + DB inserts)
            console.log(`💾 Persisting ${contexts.length} bookings...`);
            for (const context of contexts) {
                const booking = await BookingService_1.default.persistBooking(context);
                createdBookings.push(booking);
            }
            console.log(`✅ All ${createdBookings.length} bookings persisted successfully`);
            // PHASE 3: Finalize side effects for all bookings
            console.log(`📧 Finalizing side effects (emails, reminders, documents)...`);
            for (let i = 0; i < createdBookings.length; i++) {
                const booking = createdBookings[i];
                const context = contexts[i];
                await BookingService_1.default.finalizeSideEffects(booking, context);
            }
            console.log(`✅ All side effects finalized successfully`);
            return {
                success: true,
                bookings: createdBookings,
                calendarSyncStatus: 'success',
                emailStatus: 'success',
            };
        }
        catch (error) {
            console.error(`❌ Batch booking failed: ${error.message}`);
            // PHASE 4: Rollback all created bookings
            if (createdBookings.length > 0) {
                console.log(`🔄 Rolling back ${createdBookings.length} created bookings...`);
                for (const booking of createdBookings) {
                    try {
                        await BookingService_1.default.rollbackBooking(booking.id, booking.calendarEventId);
                    }
                    catch (rollbackError) {
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
exports.BatchBookingService = BatchBookingService;
exports.default = new BatchBookingService();
