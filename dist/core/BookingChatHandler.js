"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingChatHandler = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
const BookingService_1 = require("./BookingService");
const openai_1 = __importDefault(require("../infrastructure/openai"));
class BookingChatHandler {
    bookingService;
    contexts = new Map();
    constructor() {
        this.bookingService = new BookingService_1.BookingService();
    }
    /**
     * Check if a conversation has an active booking context
     */
    hasActiveContext(conversationId) {
        return this.contexts.has(conversationId);
    }
    /**
     * Handle any message within an active booking context
     */
    async handleContextMessage(conversationId, message, messageHistory) {
        const context = this.contexts.get(conversationId);
        if (!context) {
            return "I'm sorry, I seem to have lost track of our conversation. Could you please start over?";
        }
        // Route to appropriate handler based on context intent
        if (context.intent === 'cancel') {
            return await this.handleCancellation(context, message, messageHistory);
        }
        else if (context.intent === 'reschedule') {
            return await this.handleRescheduling(context, message, messageHistory);
        }
        else {
            return await this.handleNewBooking(context, message, messageHistory);
        }
    }
    /**
     * Handle booking-related intents through conversational flow
     */
    async handleBookingIntent(intent, conversationId, contactId, phoneNumber, message, messageHistory) {
        const context = this.getOrCreateContext(conversationId, contactId, phoneNumber);
        // Fetch user's current bookings
        const { data: bookings } = await supabase_1.supabase
            .from('bookings')
            .select('*, services(name, duration_minutes)')
            .eq('contact_id', contactId)
            .in('status', ['confirmed', 'pending'])
            .gte('start_time', new Date().toISOString())
            .order('start_time', { ascending: true });
        context.currentBookings = (bookings || []).map(mapper_1.toCamelCase);
        // Set intent in context for future message routing
        if (intent === 'booking_cancel') {
            context.intent = 'cancel';
            return await this.handleCancellation(context, message, messageHistory);
        }
        else if (intent === 'booking_modify') {
            context.intent = 'reschedule';
            return await this.handleRescheduling(context, message, messageHistory);
        }
        else {
            context.intent = 'new';
            return await this.handleNewBooking(context, message, messageHistory);
        }
    }
    async handleCancellation(context, message, messageHistory) {
        // Step 1: Check if user has bookings
        if (context.currentBookings.length === 0) {
            this.clearContext(context.conversationId);
            return "I checked your account and you don't have any upcoming appointments to cancel. Would you like to book a new appointment instead?";
        }
        // Step 2 & 3: Handle booking selection (combined to fix loop)
        if (!context.selectedBookingId) {
            if (context.currentBookings.length === 1) {
                // Only one booking - select it automatically
                context.selectedBookingId = context.currentBookings[0].id;
            }
            else {
                // Multiple bookings - try to extract selection from message
                const numberMatch = message.match(/\b(\d+)\b/);
                if (numberMatch) {
                    const index = parseInt(numberMatch[1]) - 1;
                    if (index >= 0 && index < context.currentBookings.length) {
                        context.selectedBookingId = context.currentBookings[index].id;
                        // Selection successful - continue to next step (fall through)
                    }
                    else {
                        return `Please enter a valid number between 1 and ${context.currentBookings.length}.`;
                    }
                }
                else {
                    // No valid selection found - show list and prompt
                    const bookingsList = context.currentBookings
                        .map((b, idx) => {
                        const date = new Date(b.startTime);
                        const serviceName = b.services?.name || b.title;
                        return `${idx + 1}. ${serviceName} on ${date.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                        })} at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
                    })
                        .join('\n');
                    return `You have ${context.currentBookings.length} upcoming appointments:\n\n${bookingsList}\n\nWhich appointment would you like to cancel? Please reply with the number (1, 2, etc.)`;
                }
            }
        }
        // At this point, selectedBookingId is set - continue to reason step
        // Step 4: Ask for cancellation reason if not provided
        if (!context.cancellationReason) {
            const openai = await (0, openai_1.default)();
            const reasonResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Extract the cancellation reason from the user's message. If no clear reason is provided, return "not_specified". Otherwise, return a brief summary of the reason.`,
                    },
                    { role: 'user', content: message },
                ],
            });
            const extractedReason = reasonResponse.choices[0]?.message?.content?.trim() || 'not_specified';
            if (extractedReason === 'not_specified' && messageHistory.length < 3) {
                return "I understand you want to cancel this appointment. Could you briefly tell me why? This helps us improve our service.";
            }
            context.cancellationReason = extractedReason === 'not_specified' ? 'Customer requested cancellation' : extractedReason;
        }
        // Step 5: Process the cancellation
        const booking = context.currentBookings.find(b => b.id === context.selectedBookingId);
        if (!booking) {
            this.clearContext(context.conversationId);
            return "I couldn't find that booking. Please try again or contact our support team.";
        }
        const serviceName = booking.services?.name || booking.title;
        const appointmentDate = new Date(booking.startTime);
        try {
            const result = await this.bookingService.cancelBooking(context.selectedBookingId, context.cancellationReason || 'Customer requested cancellation');
            let response = `✅ Your appointment for ${serviceName} on ${appointmentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
            })} has been cancelled.`;
            if (result.penaltyApplied) {
                response += `\n\n⚠️ Note: Since this cancellation was made within 24 hours of your appointment, a cancellation fee of $${result.penaltyFee} will be applied as per our policy.`;
            }
            // Smart follow-up: suggest rebooking
            const followUp = await this.suggestRebooking(context, serviceName);
            response += `\n\n${followUp}`;
            this.clearContext(context.conversationId);
            return response;
        }
        catch (error) {
            console.error('Cancellation error:', error);
            this.clearContext(context.conversationId);
            return `I'm sorry, there was an error cancelling your appointment: ${error.message}. Please contact our support team for assistance.`;
        }
    }
    async handleRescheduling(context, message, messageHistory) {
        // Step 1: Check if user has bookings
        if (context.currentBookings.length === 0) {
            this.clearContext(context.conversationId);
            return "I checked your account and you don't have any upcoming appointments to reschedule. Would you like to book a new appointment?";
        }
        // Step 2 & 3: Handle booking selection (combined to fix loop)
        if (!context.selectedBookingId) {
            if (context.currentBookings.length === 1) {
                // Only one booking - select it automatically
                context.selectedBookingId = context.currentBookings[0].id;
            }
            else {
                // Multiple bookings - try to extract selection from message
                const numberMatch = message.match(/\b(\d+)\b/);
                if (numberMatch) {
                    const index = parseInt(numberMatch[1]) - 1;
                    if (index >= 0 && index < context.currentBookings.length) {
                        context.selectedBookingId = context.currentBookings[index].id;
                        // Selection successful - continue to next step (fall through)
                    }
                    else {
                        return `Please enter a valid number between 1 and ${context.currentBookings.length}.`;
                    }
                }
                else {
                    // No valid selection found - show list and prompt
                    const bookingsList = context.currentBookings
                        .map((b, idx) => {
                        const date = new Date(b.startTime);
                        const serviceName = b.services?.name || b.title;
                        return `${idx + 1}. ${serviceName} on ${date.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                        })} at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
                    })
                        .join('\n');
                    return `You have ${context.currentBookings.length} upcoming appointments:\n\n${bookingsList}\n\nWhich appointment would you like to reschedule? Please reply with the number.`;
                }
            }
        }
        // At this point, selectedBookingId is set - continue to date/time step
        // Step 4: Extract new date/time preference
        if (!context.proposedDateTime) {
            const openai = await (0, openai_1.default)();
            const dateTimeResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Extract date and time preferences from the user's message. Return JSON:
{
  "hasDateTime": true/false,
  "suggestedDate": "YYYY-MM-DD" or null,
  "suggestedTime": "HH:MM" or null,
  "description": "brief summary of their preference"
}`,
                    },
                    { role: 'user', content: message },
                ],
                response_format: { type: 'json_object' },
            });
            const dateTimeInfo = JSON.parse(dateTimeResponse.choices[0]?.message?.content || '{}');
            if (!dateTimeInfo.hasDateTime || !dateTimeInfo.suggestedDate) {
                const booking = context.currentBookings.find(b => b.id === context.selectedBookingId);
                const serviceName = booking.services?.name || booking.title;
                return `Great! I'll help you reschedule your ${serviceName} appointment. When would you prefer to have it instead? Please let me know your preferred date and time (e.g., "next Monday at 2pm" or "December 15th at 10am").`;
            }
            // Parse the suggested date and time
            try {
                const dateStr = `${dateTimeInfo.suggestedDate}T${dateTimeInfo.suggestedTime || '10:00'}:00`;
                context.proposedDateTime = new Date(dateStr);
            }
            catch (e) {
                return "I couldn't understand the date and time you mentioned. Could you please provide it again? For example: 'next Monday at 2pm' or 'December 15th at 10:30am'.";
            }
        }
        // Step 5: Confirm and process rescheduling
        const booking = context.currentBookings.find(b => b.id === context.selectedBookingId);
        const serviceName = booking.services?.name || booking.title;
        const oldDate = new Date(booking.startTime);
        // Check if proposed time is in the future
        if (context.proposedDateTime <= new Date()) {
            return "The time you suggested has already passed. Could you please provide a future date and time?";
        }
        // For now, we'll provide a confirmation message and note that calendar integration is needed
        const newDateStr = context.proposedDateTime.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
        const newTimeStr = context.proposedDateTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
        const response = `Perfect! I'll reschedule your ${serviceName} appointment from ${oldDate.toLocaleDateString()} to ${newDateStr} at ${newTimeStr}.\n\n✅ Your request has been noted. Our team will confirm availability and update your booking shortly. You'll receive a confirmation message once it's finalized.\n\nIs there anything else I can help you with?`;
        // Note: Full calendar integration would happen here
        // For now, we create a note for the support team
        await supabase_1.supabase.from('messages').insert({
            conversation_id: context.conversationId,
            content: `RESCHEDULE REQUEST: ${serviceName} from ${oldDate.toISOString()} to ${context.proposedDateTime.toISOString()}`,
            message_type: 'system_note',
            direction: 'inbound',
            sender: 'system',
        });
        this.clearContext(context.conversationId);
        return response;
    }
    async handleNewBooking(context, message, messageHistory) {
        // For now, provide information about booking process
        return "I'd love to help you book an appointment! To ensure I find the perfect time for you, could you please let me know:\n\n1. Which service you're interested in?\n2. Your preferred date and time?\n\nOnce I have this information, I'll check availability for you.";
    }
    async suggestRebooking(context, serviceName) {
        // Smart follow-up: suggest rebooking based on the cancelled service
        const suggestions = [
            `Would you like to reschedule your ${serviceName} appointment for a different time?`,
            `If you'd like to book another ${serviceName} session in the future, just let me know!`,
            `Need to reschedule? I'm here to help you find a new time that works better for you.`,
        ];
        return suggestions[Math.floor(Math.random() * suggestions.length)];
    }
    getOrCreateContext(conversationId, contactId, phoneNumber) {
        if (!this.contexts.has(conversationId)) {
            this.contexts.set(conversationId, {
                conversationId,
                contactId,
                phoneNumber,
                currentBookings: [],
                intent: 'new',
            });
        }
        return this.contexts.get(conversationId);
    }
    clearContext(conversationId) {
        this.contexts.delete(conversationId);
    }
}
exports.BookingChatHandler = BookingChatHandler;
exports.default = new BookingChatHandler();
