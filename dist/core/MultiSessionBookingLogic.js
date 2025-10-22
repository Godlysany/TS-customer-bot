"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiSessionBookingLogic = void 0;
const supabase_1 = require("../infrastructure/supabase");
const crypto_1 = require("crypto");
const BatchBookingService_1 = __importDefault(require("./BatchBookingService"));
class MultiSessionBookingLogic {
    constructor() { }
    /**
     * Calculate all session dates based on buffer configuration
     */
    calculateSessionSchedule(params, sessionsCount) {
        const schedule = [];
        const { startDateTime, sessionBufferConfig, strategy, } = params;
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
    getBufferDays(sessionNumber, bufferConfig, strategy) {
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
    async bookImmediateStrategy(params) {
        const sessionGroupId = (0, crypto_1.randomUUID)();
        const schedule = this.calculateSessionSchedule(params, params.totalSessions);
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
                totalSessions: params.totalSessions,
                title: `${params.serviceName} - Session ${session.sessionNumber}`,
                startTime: session.startTime,
                endTime: new Date(session.startTime.getTime() + params.durationMinutes * 60 * 1000),
                description: `Multi-session treatment: Session ${session.sessionNumber} of ${params.totalSessions}`,
            })),
        };
        // Execute atomic batch booking (all or nothing)
        const result = await BatchBookingService_1.default.createBatchBooking(batchRequest);
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
    async bookSequentialStrategy(params) {
        const sessionGroupId = (0, crypto_1.randomUUID)();
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
                    totalSessions: params.totalSessions,
                    title: `${params.serviceName} - Session 1`,
                    startTime: params.startDateTime,
                    endTime: new Date(params.startDateTime.getTime() + params.durationMinutes * 60 * 1000),
                    description: `Multi-session treatment: Session 1 of ${params.totalSessions} (Sequential)`,
                },
            ],
        };
        // Execute atomic batch booking
        const result = await BatchBookingService_1.default.createBatchBooking(batchRequest);
        if (!result.success) {
            const errorMsg = result.errors?.join(', ') || 'Unknown error';
            throw new Error(`Failed to book first session: ${errorMsg}`);
        }
        return result.bookings[0];
    }
    /**
     * Book N sessions for FLEXIBLE strategy
     */
    async bookFlexibleStrategy(params) {
        const sessionsToBook = params.sessionsToBook || 1;
        // Check if there's an existing group for this contact/service
        const { data: existingBookings } = await supabase_1.supabase
            .from('bookings')
            .select('session_group_id, session_number')
            .eq('contact_id', params.contactId)
            .eq('service_id', params.serviceId)
            .eq('is_part_of_multi_session', true)
            .order('session_number', { ascending: false })
            .limit(1);
        let sessionGroupId;
        let startingSessionNumber;
        if (existingBookings && existingBookings.length > 0) {
            // Continue existing group
            sessionGroupId = existingBookings[0].session_group_id;
            startingSessionNumber = existingBookings[0].session_number + 1;
        }
        else {
            // Create new group
            sessionGroupId = (0, crypto_1.randomUUID)();
            startingSessionNumber = 1;
        }
        const schedule = this.calculateSessionSchedule({ ...params, startDateTime: params.startDateTime }, sessionsToBook);
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
                totalSessions: params.totalSessions,
                title: `${params.serviceName} - Session ${startingSessionNumber + index}`,
                startTime: session.startTime,
                endTime: new Date(session.startTime.getTime() + params.durationMinutes * 60 * 1000),
                description: `Multi-session treatment: Session ${startingSessionNumber + index} of ${params.totalSessions} (Flexible)`,
            })),
        };
        // Execute atomic batch booking
        const result = await BatchBookingService_1.default.createBatchBooking(batchRequest);
        if (!result.success) {
            const errorMsg = result.errors?.join(', ') || 'Unknown error';
            throw new Error(`Failed to book sessions: ${errorMsg}`);
        }
        return result.bookings;
    }
    /**
     * Get multi-session booking progress for a contact
     */
    async getMultiSessionProgress(contactId, serviceId) {
        const { data: bookings } = await supabase_1.supabase
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
        const completedSessions = bookings.filter((b) => b.status === 'completed').length;
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
    async shouldTriggerNextSession(bookingId) {
        const { data: booking } = await supabase_1.supabase
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
        const progress = await this.getMultiSessionProgress(booking.contact_id, booking.service_id);
        return progress.bookedSessions < progress.totalSessions;
    }
    /**
     * Generate progress message for customer
     */
    generateProgressMessage(bookedSessions, completedSessions, totalSessions) {
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
exports.MultiSessionBookingLogic = MultiSessionBookingLogic;
exports.default = new MultiSessionBookingLogic();
