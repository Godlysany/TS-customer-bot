"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
const EmailService_1 = require("./EmailService");
const ReminderService_1 = require("./ReminderService");
const ReviewService_1 = require("./ReviewService");
const SecretaryNotificationService_1 = require("./SecretaryNotificationService");
const SettingsService_1 = require("./SettingsService");
const DocumentService_1 = require("./DocumentService");
const NoShowService_1 = __importDefault(require("./NoShowService"));
const PaymentService_1 = __importDefault(require("./PaymentService"));
const BotConfigService_1 = __importDefault(require("./BotConfigService"));
class BookingService {
    calendarProvider = null;
    emailService;
    reminderService;
    reviewService;
    secretaryService;
    settingsService;
    documentService;
    noShowService;
    constructor() {
        this.emailService = new EmailService_1.EmailService();
        this.reminderService = new ReminderService_1.ReminderService();
        this.reviewService = new ReviewService_1.ReviewService();
        this.secretaryService = new SecretaryNotificationService_1.SecretaryNotificationService();
        this.settingsService = new SettingsService_1.SettingsService();
        this.documentService = new DocumentService_1.DocumentService();
        this.noShowService = NoShowService_1.default;
    }
    setCalendarProvider(provider) {
        this.calendarProvider = provider;
    }
    async createBooking(contactId, conversationId, event, options) {
        if (!this.calendarProvider) {
            throw new Error('Calendar provider not initialized');
        }
        const suspension = await this.noShowService.isContactSuspended(contactId);
        if (suspension.suspended && suspension.until) {
            throw new Error(`Booking privileges suspended until ${suspension.until.toLocaleDateString()}. Please contact us for assistance.`);
        }
        let bufferTimeBefore = 0;
        let bufferTimeAfter = 0;
        if (options?.serviceId) {
            const { data: service } = await supabase_1.supabase
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
        // Check dynamic bot configuration before booking
        await this.checkConfigurationRestrictions(event, options?.serviceId);
        await this.checkBufferedConflicts(actualStartTime, actualEndTime, options?.serviceId);
        const calendarEventId = await this.calendarProvider.createEvent(event);
        const { data, error } = await supabase_1.supabase
            .from('bookings')
            .insert((0, mapper_1.toSnakeCase)({
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
        if (error)
            throw error;
        const booking = (0, mapper_1.toCamelCase)(data);
        const { data: contact } = await supabase_1.supabase
            .from('contacts')
            .select('name, email')
            .eq('id', contactId)
            .single();
        if (contact?.email) {
            await this.emailService.sendBookingConfirmation(booking.id, contact.email, {
                ...booking,
                contactName: contact.name,
            });
            await supabase_1.supabase
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
    async updateBooking(bookingId, updates) {
        const { data: bookingData } = await supabase_1.supabase
            .from('bookings')
            .select('*')
            .eq('id', bookingId)
            .single();
        if (!bookingData)
            throw new Error('Booking not found');
        const booking = (0, mapper_1.toCamelCase)(bookingData);
        if (this.calendarProvider) {
            await this.calendarProvider.updateEvent(booking.calendarEventId, updates);
        }
        const updateData = {};
        if (updates.title)
            updateData.title = updates.title;
        if (updates.startTime)
            updateData.start_time = updates.startTime.toISOString();
        if (updates.endTime)
            updateData.end_time = updates.endTime.toISOString();
        const { error } = await supabase_1.supabase
            .from('bookings')
            .update(updateData)
            .eq('id', bookingId);
        if (error)
            throw error;
    }
    async cancelBooking(bookingId, reason) {
        const { data: bookingData } = await supabase_1.supabase
            .from('bookings')
            .select('*, contacts(name, email)')
            .eq('id', bookingId)
            .single();
        if (!bookingData)
            throw new Error('Booking not found');
        const booking = (0, mapper_1.toCamelCase)(bookingData);
        const policyHours = parseInt(await this.settingsService.getSetting('cancellation_policy_hours') || '24');
        const penaltyType = await this.settingsService.getSetting('late_cancellation_penalty_type') || 'fixed';
        const penaltyAmount = parseFloat(await this.settingsService.getSetting('late_cancellation_penalty_amount') || '50');
        const hoursUntilAppointment = (new Date(booking.startTime).getTime() - new Date().getTime()) / (1000 * 60 * 60);
        const isLateCancellation = hoursUntilAppointment < policyHours;
        const penaltyFee = isLateCancellation ? penaltyAmount : 0;
        let refunded = false;
        if (booking.paymentStatus === 'paid' && !isLateCancellation) {
            try {
                const refundResult = await PaymentService_1.default.handleCancellationRefund(bookingId);
                if (refundResult) {
                    refunded = true;
                }
            }
            catch (error) {
                console.error('Failed to process refund:', error);
            }
        }
        if (this.calendarProvider) {
            await this.calendarProvider.deleteEvent(booking.calendarEventId);
        }
        const { error } = await supabase_1.supabase
            .from('bookings')
            .update((0, mapper_1.toSnakeCase)({
            status: 'cancelled',
            cancelledAt: new Date(),
            cancellationReason: reason,
            penaltyApplied: isLateCancellation,
            penaltyFee,
        }))
            .eq('id', bookingId);
        if (error)
            throw error;
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
        const { WaitlistService } = await Promise.resolve().then(() => __importStar(require('./WaitlistService')));
        const waitlistService = new WaitlistService();
        const sendMessage = async (phone, message) => {
            try {
                const whatsappModule = await Promise.resolve().then(() => __importStar(require('../adapters/whatsapp')));
                const sock = whatsappModule.default;
                if (sock) {
                    await sock.sendMessage(phone, { text: message });
                }
            }
            catch (error) {
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
    async checkBufferedConflicts(actualStartTime, actualEndTime, excludeServiceId) {
        const { data: allBookings } = await supabase_1.supabase
            .from('bookings')
            .select('id, start_time, end_time, actual_start_time, actual_end_time, title, buffer_time_before, buffer_time_after')
            .eq('status', 'confirmed');
        if (!allBookings)
            return;
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
            throw new Error(`Booking conflict detected (including buffer times). Overlaps with: ${conflictTitles}. Please choose a different time slot.`);
        }
    }
    async checkConfigurationRestrictions(event, serviceId) {
        const config = await BotConfigService_1.default.getConfig();
        // Check if booking feature is enabled
        if (!config.enable_booking) {
            throw new Error('Booking feature is currently disabled. Please contact us for assistance.');
        }
        const startTime = new Date(event.startTime);
        const endTime = new Date(event.endTime);
        // Check opening hours for both start AND end time
        await this.checkOpeningHours(startTime, config.opening_hours);
        await this.checkOpeningHours(endTime, config.opening_hours);
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
            const { data: service } = await supabase_1.supabase
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
    async checkOpeningHours(requestedTime, openingHoursConfig) {
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
            if (!trimmedLine)
                continue;
            // Parse line format: "Day(s): HH:MM-HH:MM" or "Day: Closed"
            const parts = trimmedLine.split(':');
            if (parts.length < 2)
                continue;
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
                    }
                    else {
                        appliesToDay = requestedIdx >= startIdx || requestedIdx <= endIdx;
                    }
                }
            }
            else {
                // Single day or comma-separated days
                const days = dayPart.split(',').map(d => d.trim());
                appliesToDay = days.some(d => requestedDay.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(requestedDay.toLowerCase()));
            }
            if (!appliesToDay)
                continue;
            // Check if closed
            if (timePart.includes('closed')) {
                throw new Error(`We are closed on ${requestedDay}. Please choose a different day.`);
            }
            // Parse time range: "09:00-18:00"
            const timeMatch = timePart.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
            if (!timeMatch)
                continue;
            const [, startHour, startMin, endHour, endMin] = timeMatch.map(Number);
            const openingTimeInMinutes = startHour * 60 + startMin;
            const closingTimeInMinutes = endHour * 60 + endMin;
            if (requestedTimeInMinutes < openingTimeInMinutes) {
                throw new Error(`This time is before our opening hours on ${requestedDay}. We open at ${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}.`);
            }
            if (requestedTimeInMinutes >= closingTimeInMinutes) {
                throw new Error(`This time is after our closing hours on ${requestedDay}. We close at ${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}.`);
            }
            // Time is within hours
            return;
        }
        // If we get here and didn't find a matching day, assume closed
        throw new Error(`Opening hours not configured for ${requestedDay}. Please contact us for available times.`);
    }
    async getAvailability(startDate, endDate) {
        if (!this.calendarProvider) {
            throw new Error('Calendar provider not initialized');
        }
        return this.calendarProvider.getAvailability(startDate, endDate);
    }
    async getBookingStats(startDate, endDate) {
        let query = supabase_1.supabase.from('bookings').select('*');
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
exports.BookingService = BookingService;
exports.default = new BookingService();
