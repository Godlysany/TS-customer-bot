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
