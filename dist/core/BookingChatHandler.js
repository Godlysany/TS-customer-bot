"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingChatHandler = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
const BookingService_1 = __importDefault(require("./BookingService"));
const MultiServiceBookingService_1 = require("./MultiServiceBookingService");
const MultiSessionBookingLogic_1 = __importDefault(require("./MultiSessionBookingLogic"));
const openai_1 = __importDefault(require("../infrastructure/openai"));
const BotConfigService_1 = __importDefault(require("./BotConfigService"));
const PaymentLinkService_1 = __importDefault(require("./PaymentLinkService"));
const SettingsService_1 = __importDefault(require("./SettingsService"));
const whatsapp_1 = require("../adapters/whatsapp");
const AIService_1 = __importDefault(require("./AIService"));
const BatchBookingService_1 = __importDefault(require("./BatchBookingService"));
const crypto_1 = require("crypto");
class BookingChatHandler {
    bookingService;
    multiServiceService;
    multiSessionLogic;
    contexts = new Map();
    constructor() {
        this.bookingService = BookingService_1.default;
        this.multiServiceService = new MultiServiceBookingService_1.MultiServiceBookingService();
        this.multiSessionLogic = MultiSessionBookingLogic_1.default;
    }
    /**
     * Helper function to get day name from Date
     */
    getDayName(date) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[date.getDay()];
    }
    /**
     * Helper function to format time as HH:MM
     */
    formatTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    /**
     * Select optimal team member based on availability, customer history, and load balancing
     */
    async selectOptimalTeamMember(serviceId, startTime, endTime, contactId) {
        // Step 1: Get team members assigned to this service
        const { data: teamMembers } = await supabase_1.supabase
            .from('service_team_members')
            .select('team_member_id, team_members(*)')
            .eq('service_id', serviceId);
        if (!teamMembers || teamMembers.length === 0) {
            return null; // No team members configured for this service
        }
        // Step 2: Filter by availability schedule and conflicts
        const available = [];
        for (const assignment of teamMembers) {
            const member = (0, mapper_1.toCamelCase)(assignment.team_members);
            // Check availability schedule
            const dayOfWeek = this.getDayName(startTime);
            const schedule = member.availabilitySchedule?.[dayOfWeek];
            if (!schedule || schedule.length === 0)
                continue;
            const startTimeStr = this.formatTime(startTime);
            const endTimeStr = this.formatTime(endTime);
            const isWithinSchedule = schedule.some((window) => startTimeStr >= window.start && endTimeStr <= window.end);
            if (!isWithinSchedule)
                continue;
            // Check for conflicts
            const { data: conflicts } = await supabase_1.supabase
                .from('bookings')
                .select('id')
                .eq('team_member_id', member.id)
                .in('status', ['confirmed', 'pending'])
                .lt('actual_start_time', endTime.toISOString())
                .gt('actual_end_time', startTime.toISOString());
            if (conflicts && conflicts.length > 0)
                continue;
            available.push(member);
        }
        if (available.length === 0) {
            throw new Error('No team members available at this time');
        }
        // Step 3: Check customer preference (previous bookings)
        const { data: previousBookings } = await supabase_1.supabase
            .from('bookings')
            .select('team_member_id')
            .eq('contact_id', contactId)
            .not('team_member_id', 'is', null)
            .order('start_time', { ascending: false })
            .limit(3);
        if (previousBookings && previousBookings.length > 0) {
            const preferredId = previousBookings[0].team_member_id;
            const preferred = available.find((tm) => tm.id === preferredId);
            if (preferred)
                return preferred.id;
        }
        // Step 4: Load balancing - count upcoming bookings per team member
        const loadCounts = await Promise.all(available.map(async (tm) => {
            const { count } = await supabase_1.supabase
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .eq('team_member_id', tm.id)
                .in('status', ['confirmed', 'pending'])
                .gte('start_time', new Date().toISOString());
            return { id: tm.id, count: count || 0 };
        }));
        // Select team member with lowest load
        const leastBusy = loadCounts.sort((a, b) => a.count - b.count)[0];
        return leastBusy.id;
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
        // PRIORITY CHECK: If user is in payment flow, check payment status first
        if (context.multiSessionStep === 'awaiting_payment' || context.paymentLinkId) {
            const paymentResponse = await this.handlePaymentConfirmation(context);
            if (paymentResponse) {
                return paymentResponse;
            }
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
        // Query services with multi-session fields
        const { data: services } = await supabase_1.supabase
            .from('services')
            .select('id, name, requires_multiple_sessions, multi_session_strategy, total_sessions_required, session_buffer_config, duration_minutes, cost')
            .eq('is_active', true);
        const serviceMentioned = services?.find(s => message.toLowerCase().includes(s.name.toLowerCase()));
        if (serviceMentioned) {
            // Check if this is a multi-session service
            if (serviceMentioned.requires_multiple_sessions) {
                // Route to multi-session handler
                return await this.handleMultiSessionBooking(context, (0, mapper_1.toCamelCase)(serviceMentioned), message);
            }
            // Standard single-session booking flow
            const recommendations = await this.multiServiceService.getServiceRecommendations(context.contactId, serviceMentioned.id);
            let response = `Great choice! I can help you book a ${serviceMentioned.name} appointment.\n\n`;
            if (recommendations.length > 0) {
                response += await this.multiServiceService.formatRecommendationsMessage(recommendations);
                response += '\n\n';
            }
            response += 'What date and time works best for you?';
            this.clearContext(context.conversationId);
            return response;
        }
        const recommendations = await this.multiServiceService.getServiceRecommendations(context.contactId);
        let response = "I'd love to help you book an appointment! ";
        if (services && services.length > 0) {
            response += "Here are our available services:\n\n";
            services.slice(0, 5).forEach((s, i) => {
                response += `${i + 1}. ${s.name}\n`;
            });
            response += '\n';
        }
        if (recommendations.length > 0) {
            response += await this.multiServiceService.formatRecommendationsMessage(recommendations);
            response += '\n\n';
        }
        response += 'Which service interests you, and when would you like to come in?';
        this.clearContext(context.conversationId);
        return response;
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
    /**
     * ========================================
     * PAYMENT INTEGRATION METHODS
     * ========================================
     */
    /**
     * Check if payments are enabled system-wide
     */
    async isPaymentEnabled() {
        const paymentsEnabled = await SettingsService_1.default.getSetting('payments_enabled');
        const stripeKey = await SettingsService_1.default.getSetting('stripe_api_key');
        return paymentsEnabled === 'true' && !!stripeKey && stripeKey.trim() !== '';
    }
    /**
     * Check if service requires payment
     */
    async requiresPayment(serviceId) {
        const { data: service } = await supabase_1.supabase
            .from('services')
            .select('requires_payment, cost, deposit_amount')
            .eq('id', serviceId)
            .single();
        if (!service) {
            return { required: false, amount: 0, depositAmount: 0 };
        }
        const serviceData = (0, mapper_1.toCamelCase)(service);
        return {
            required: serviceData.requiresPayment || false,
            amount: serviceData.cost || 0,
            depositAmount: serviceData.depositAmount || 0,
        };
    }
    /**
     * Create payment link and send to customer via WhatsApp
     */
    async createAndSendPaymentLink(context, bookingId, serviceName, amount) {
        try {
            const paymentEnabled = await this.isPaymentEnabled();
            if (!paymentEnabled) {
                console.warn('⚠️ Payment required but payments not enabled - allowing booking without payment');
                return ''; // Allow booking to proceed without payment if system not configured
            }
            // Create payment link
            const paymentLink = await PaymentLinkService_1.default.createPaymentLink({
                booking_id: bookingId,
                contact_id: context.contactId,
                amount_chf: amount,
                description: `Payment for ${serviceName} appointment`,
                metadata: {
                    conversation_id: context.conversationId,
                },
            });
            // Store payment link in context
            context.paymentLinkId = paymentLink.payment_link_id;
            context.paymentStatus = 'pending';
            context.paymentExpiresAt = new Date(paymentLink.expires_at);
            context.paymentAmount = amount;
            // Send payment link via WhatsApp
            const paymentMessage = `💳 Payment Required\n\n` +
                `To confirm your ${serviceName} appointment, please complete the payment of CHF ${amount.toFixed(2)}.\n\n` +
                `Click here to pay securely with Stripe:\n${paymentLink.checkout_url}\n\n` +
                `Payment link expires in 24 hours.\n\n` +
                `Once payment is confirmed, I'll finalize your booking! 🎉`;
            await (0, whatsapp_1.sendProactiveMessage)(context.phoneNumber, paymentMessage, context.contactId);
            // Update payment_link record with WhatsApp message sent
            await supabase_1.supabase
                .from('payment_links')
                .update({ whatsapp_message_sent_at: new Date().toISOString() })
                .eq('id', paymentLink.payment_link_id);
            return `I've sent you a secure payment link via WhatsApp. Please complete the payment to confirm your booking. I'll be here when you're ready! 😊`;
        }
        catch (error) {
            console.error('❌ Error creating payment link:', error);
            throw new Error(`Payment system error: ${error.message}`);
        }
    }
    /**
     * Check payment status from database
     */
    async checkPaymentStatus(paymentLinkId) {
        const { data: paymentLink } = await supabase_1.supabase
            .from('payment_links')
            .select('payment_status, expires_at')
            .eq('id', paymentLinkId)
            .single();
        if (!paymentLink) {
            return 'failed';
        }
        const paymentData = (0, mapper_1.toCamelCase)(paymentLink);
        // Check if expired
        const now = new Date();
        const expiresAt = new Date(paymentData.expiresAt);
        if (now > expiresAt && paymentData.paymentStatus === 'pending') {
            return 'expired';
        }
        return paymentData.paymentStatus;
    }
    /**
     * Handle payment confirmation check during conversation
     */
    async handlePaymentConfirmation(context) {
        if (!context.paymentLinkId) {
            return null; // No payment required
        }
        const status = await this.checkPaymentStatus(context.paymentLinkId);
        context.paymentStatus = status;
        switch (status) {
            case 'paid':
                // Payment successful - finalize booking
                if (context.pendingBookingIds && context.pendingBookingIds.length > 0) {
                    // Confirm all pending bookings
                    for (const bookingId of context.pendingBookingIds) {
                        await supabase_1.supabase
                            .from('bookings')
                            .update({ status: 'confirmed' })
                            .eq('id', bookingId);
                    }
                }
                this.clearContext(context.conversationId);
                return `✅ Payment confirmed! Your booking is now complete. You'll receive a confirmation email shortly. Looking forward to seeing you!`;
            case 'expired':
                // Payment link expired - cancel pending bookings to free availability
                if (context.pendingBookingIds && context.pendingBookingIds.length > 0) {
                    for (const bookingId of context.pendingBookingIds) {
                        await supabase_1.supabase
                            .from('bookings')
                            .update({
                            status: 'cancelled',
                            cancellation_reason: 'Payment link expired (conversational timeout)'
                        })
                            .eq('id', bookingId)
                            .eq('status', 'pending'); // Only cancel if still pending
                    }
                    console.log(`✅ Cancelled ${context.pendingBookingIds.length} pending booking(s) due to payment expiration`);
                }
                this.clearContext(context.conversationId);
                return `⏰ Your payment link has expired. To proceed with the booking, please start over and I'll generate a new payment link for you.`;
            case 'failed':
                // Payment failed - cancel pending bookings to free availability
                if (context.pendingBookingIds && context.pendingBookingIds.length > 0) {
                    for (const bookingId of context.pendingBookingIds) {
                        await supabase_1.supabase
                            .from('bookings')
                            .update({
                            status: 'cancelled',
                            cancellation_reason: 'Payment failed (conversational check)'
                        })
                            .eq('id', bookingId)
                            .eq('status', 'pending');
                    }
                    console.log(`✅ Cancelled ${context.pendingBookingIds.length} pending booking(s) due to payment failure`);
                }
                this.clearContext(context.conversationId);
                return `❌ There was an issue with your payment. Please try booking again, and I'll assist you with a new payment link.`;
            case 'pending':
                // Still waiting for payment
                const minutesRemaining = context.paymentExpiresAt
                    ? Math.floor((context.paymentExpiresAt.getTime() - Date.now()) / (1000 * 60))
                    : 0;
                return `I'm still waiting for your payment confirmation. You have ${minutesRemaining} minutes remaining to complete the payment. Once done, your booking will be automatically confirmed! 💳`;
            default:
                return null;
        }
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
    /**
     * ========================================
     * MULTI-SESSION BOOKING HANDLERS
     * ========================================
     */
    /**
     * Main handler for multi-session bookings - routes to strategy-specific handler
     */
    async handleMultiSessionBooking(context, service, message) {
        // Store service in context for subsequent messages
        if (!context.multiSessionService) {
            context.multiSessionService = service;
        }
        const { multiSessionStrategy, totalSessionsRequired } = service;
        // Route to appropriate strategy handler
        switch (multiSessionStrategy) {
            case 'immediate':
                return await this.handleImmediateBooking(context, service, message);
            case 'sequential':
                return await this.handleSequentialBooking(context, service, message);
            case 'flexible':
                return await this.handleFlexibleBooking(context, service, message);
            default:
                return `I'm sorry, but this service has an invalid booking configuration. Please contact support.`;
        }
    }
    /**
     * IMMEDIATE STRATEGY: Book all sessions upfront with specific buffer times
     * Example: Dental implant (3 sessions: placement, healing check, crown)
     */
    async handleImmediateBooking(context, service, message) {
        const { totalSessionsRequired, sessionBufferConfig, name, durationMinutes } = service;
        // Step 1: If no proposed date/time, extract from message
        if (!context.proposedDateTime) {
            const openai = await (0, openai_1.default)();
            const dateTimeResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Extract date and time for the FIRST session from the user's message. Return JSON:
{
  "hasDateTime": true/false,
  "suggestedDate": "YYYY-MM-DD" or null,
  "suggestedTime": "HH:MM" or null
}`,
                    },
                    { role: 'user', content: message },
                ],
                response_format: { type: 'json_object' },
            });
            const dateTimeInfo = JSON.parse(dateTimeResponse.choices[0]?.message?.content || '{}');
            if (!dateTimeInfo.hasDateTime || !dateTimeInfo.suggestedDate) {
                // Ask for start date/time
                return `Perfect! ${name} requires ${totalSessionsRequired} sessions. I'll book all ${totalSessionsRequired} sessions for you with the appropriate healing time between each.\n\nWhen would you like to start with Session 1? Please provide your preferred date and time (e.g., "March 15 at 2pm" or "next Monday at 10am").`;
            }
            // Parse the suggested date and time
            try {
                const dateStr = `${dateTimeInfo.suggestedDate}T${dateTimeInfo.suggestedTime || '10:00'}:00`;
                context.proposedDateTime = new Date(dateStr);
                // Validate future date
                if (context.proposedDateTime <= new Date()) {
                    context.proposedDateTime = undefined;
                    return "The time you suggested has already passed. Could you please provide a future date and time?";
                }
            }
            catch (e) {
                return "I couldn't understand the date and time you mentioned. Could you please provide it again? For example: 'March 15 at 2pm' or 'next Monday at 10:30am'.";
            }
        }
        // Step 2: Calculate all session dates using MultiSessionBookingLogic
        const schedule = this.multiSessionLogic.calculateSessionSchedule({
            sessionBufferConfig,
            startDateTime: context.proposedDateTime,
            totalSessions: totalSessionsRequired,
        }, totalSessionsRequired);
        // Step 3: Show customer complete schedule preview and ask for confirmation
        if (context.multiSessionStep !== 'confirm_all') {
            context.multiSessionStep = 'confirm_all';
            let schedulePreview = `Excellent! Here's your complete treatment plan for ${name}:\n\n`;
            schedule.forEach((session, idx) => {
                const sessionDate = session.startTime.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                });
                const sessionTime = session.startTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                });
                schedulePreview += `📅 Session ${idx + 1}: ${sessionDate} at ${sessionTime}\n`;
            });
            schedulePreview += `\nAll ${totalSessionsRequired} sessions will be scheduled automatically. Would you like to confirm this treatment plan? (Yes/No)`;
            return schedulePreview;
        }
        // Step 4: Check for confirmation
        const confirmation = message.toLowerCase();
        if (!confirmation.includes('yes') && !confirmation.includes('confirm') && !confirmation.includes('ok')) {
            if (confirmation.includes('no') || confirmation.includes('cancel')) {
                this.clearContext(context.conversationId);
                return "No problem! If you'd like to book at a different time, just let me know.";
            }
            return `Please confirm by replying "yes" to book all ${totalSessionsRequired} sessions, or "no" to cancel.`;
        }
        // Step 4.5: Check email collection AFTER confirmation, BEFORE booking
        const emailCheckResult = await this.checkEmailCollection(context, message);
        if (emailCheckResult) {
            return emailCheckResult; // Return email collection prompt if needed
        }
        // Step 4.6: Select optimal team member if not already selected
        if (!context.selectedTeamMemberId) {
            try {
                const endTime = new Date(context.proposedDateTime.getTime() + durationMinutes * 60 * 1000);
                const teamMemberId = await this.selectOptimalTeamMember(service.id, context.proposedDateTime, endTime, context.contactId);
                context.selectedTeamMemberId = teamMemberId || undefined;
                console.log(`✅ Team member selected for ${name}: ${teamMemberId || 'none (no team members configured)'}`);
            }
            catch (error) {
                // If team member selection fails (e.g., no availability), inform user
                this.clearContext(context.conversationId);
                return error.message || 'No team members are available for this time slot. Please try a different time.';
            }
        }
        // Step 5: Check if payment is required BEFORE booking
        const paymentInfo = await this.requiresPayment(service.id);
        try {
            // Book all sessions using MultiSessionBookingLogic
            const bookings = await this.multiSessionLogic.bookImmediateStrategy({
                serviceId: service.id,
                contactId: context.contactId,
                conversationId: context.conversationId,
                phoneNumber: context.phoneNumber,
                strategy: 'immediate',
                totalSessions: totalSessionsRequired,
                sessionBufferConfig,
                startDateTime: context.proposedDateTime,
                durationMinutes,
                serviceName: name,
                serviceCost: service.cost,
                teamMemberId: context.selectedTeamMemberId,
            });
            // If payment required, create payment link and wait for confirmation
            if (paymentInfo.required && paymentInfo.amount > 0) {
                const amountToCharge = paymentInfo.depositAmount > 0 ? paymentInfo.depositAmount : paymentInfo.amount;
                // Store booking IDs in context for later confirmation
                context.pendingBookingIds = bookings.map((b) => b.id);
                context.multiSessionStep = 'awaiting_payment';
                context.requiresPayment = true;
                // Create and send payment link
                try {
                    const paymentResponse = await this.createAndSendPaymentLink(context, bookings[0].id, // Use first booking ID for payment link
                    name, amountToCharge * totalSessionsRequired // Total for all sessions
                    );
                    return paymentResponse;
                }
                catch (paymentError) {
                    // If payment system fails, log error but allow booking if payments not strictly enforced
                    console.error('Payment link creation failed:', paymentError);
                    // Check if payments are strictly enforced
                    const strictPayments = await SettingsService_1.default.getSetting('strict_payment_enforcement');
                    if (strictPayments === 'true') {
                        // Cancel bookings if strict enforcement
                        for (const booking of bookings) {
                            await supabase_1.supabase.from('bookings').delete().eq('id', booking.id);
                        }
                        this.clearContext(context.conversationId);
                        return `I'm sorry, our payment system is temporarily unavailable. Please try again later or contact our support team.`;
                    }
                    // Otherwise, allow booking without payment
                    console.warn('⚠️ Allowing booking without payment due to payment system error');
                }
            }
            // No payment required OR payment system failed with non-strict enforcement - confirm immediately
            // CRITICAL: Create actual bookings in database BEFORE sending confirmation
            const batchRequest = {
                contactId: context.contactId,
                conversationId: context.conversationId,
                phoneNumber: context.phoneNumber,
                serviceId: service.id,
                teamMemberId: context.selectedTeamMemberId,
                sessionGroupId: (0, crypto_1.randomUUID)(),
                bookings: bookings.map((b, idx) => ({
                    title: `${name} - Session ${idx + 1}/${totalSessionsRequired}`,
                    startTime: b.startTime,
                    endTime: b.endTime,
                    description: service.description || '',
                    sessionNumber: idx + 1,
                    totalSessions: totalSessionsRequired
                }))
            };
            const result = await BatchBookingService_1.default.createBatchBooking(batchRequest);
            if (!result.success) {
                this.clearContext(context.conversationId);
                return `I'm sorry, there was an error creating your bookings: ${result.errors?.join(', ') || 'Unknown error'}`;
            }
            // Generate confirmation message with actual created bookings
            let confirmationMsg = `✅ Perfect! All ${totalSessionsRequired} ${name} sessions are now confirmed:\n\n`;
            result.bookings.forEach((booking, idx) => {
                const bookingDate = new Date(booking.startTime);
                const dateStr = bookingDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                });
                const timeStr = bookingDate.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                });
                confirmationMsg += `📅 Session ${idx + 1}: ${dateStr} at ${timeStr}\n`;
            });
            confirmationMsg += `\nYou'll receive email confirmations for each session. See you soon! 🎉`;
            this.clearContext(context.conversationId);
            return confirmationMsg;
        }
        catch (error) {
            console.error('Failed to book immediate multi-session:', error);
            this.clearContext(context.conversationId);
            return `I'm sorry, there was an error booking your sessions. Please try again or contact our support team.`;
        }
    }
    /**
     * SEQUENTIAL STRATEGY: Book one session at a time, auto-trigger next after completion
     * Example: Physiotherapy (8 sessions, book after each completion)
     */
    async handleSequentialBooking(context, service, message) {
        const { totalSessionsRequired, name, durationMinutes } = service;
        // Check if customer already has sessions in progress
        const progress = await this.multiSessionLogic.getMultiSessionProgress(context.contactId, service.id);
        if (progress.bookedSessions > 0) {
            // Customer has existing sessions
            const progressMsg = this.multiSessionLogic.generateProgressMessage(progress.bookedSessions, progress.completedSessions, progress.totalSessions);
            return `${progressMsg}\n\nI'll send you a reminder to book your next session after you complete the current one. Is there anything else I can help with?`;
        }
        // Step 1: Extract date/time for FIRST session only
        if (!context.proposedDateTime) {
            const openai = await (0, openai_1.default)();
            const dateTimeResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Extract date and time for the first session from the user's message. Return JSON:
{
  "hasDateTime": true/false,
  "suggestedDate": "YYYY-MM-DD" or null,
  "suggestedTime": "HH:MM" or null
}`,
                    },
                    { role: 'user', content: message },
                ],
                response_format: { type: 'json_object' },
            });
            const dateTimeInfo = JSON.parse(dateTimeResponse.choices[0]?.message?.content || '{}');
            if (!dateTimeInfo.hasDateTime || !dateTimeInfo.suggestedDate) {
                return `Perfect! ${name} is a ${totalSessionsRequired}-session treatment plan. We'll book one session at a time.\n\nAfter you complete each session, I'll help you schedule the next one. When would you like Session 1? Please provide your preferred date and time.`;
            }
            // Parse date
            try {
                const dateStr = `${dateTimeInfo.suggestedDate}T${dateTimeInfo.suggestedTime || '10:00'}:00`;
                context.proposedDateTime = new Date(dateStr);
                if (context.proposedDateTime <= new Date()) {
                    context.proposedDateTime = undefined;
                    return "The time you suggested has already passed. Could you please provide a future date and time?";
                }
            }
            catch (e) {
                return "I couldn't understand the date and time. Please try again (e.g., 'March 15 at 2pm').";
            }
        }
        // Step 1.5: Check email collection AFTER date/time, BEFORE booking
        const emailCheckResult = await this.checkEmailCollection(context, message);
        if (emailCheckResult) {
            return emailCheckResult; // Return email collection prompt if needed
        }
        // Step 1.6: Select optimal team member if not already selected
        if (!context.selectedTeamMemberId) {
            try {
                const endTime = new Date(context.proposedDateTime.getTime() + durationMinutes * 60 * 1000);
                const teamMemberId = await this.selectOptimalTeamMember(service.id, context.proposedDateTime, endTime, context.contactId);
                context.selectedTeamMemberId = teamMemberId || undefined;
                console.log(`✅ Team member selected for ${name} (sequential): ${teamMemberId || 'none (no team members configured)'}`);
            }
            catch (error) {
                // If team member selection fails (e.g., no availability), inform user
                this.clearContext(context.conversationId);
                return error.message || 'No team members are available for this time slot. Please try a different time.';
            }
        }
        // Step 2: Check if payment is required BEFORE booking
        const paymentInfo = await this.requiresPayment(service.id);
        try {
            // Book FIRST session only
            const booking = await this.multiSessionLogic.bookSequentialStrategy({
                serviceId: service.id,
                contactId: context.contactId,
                conversationId: context.conversationId,
                phoneNumber: context.phoneNumber,
                strategy: 'sequential',
                totalSessions: totalSessionsRequired,
                sessionBufferConfig: service.sessionBufferConfig || {},
                startDateTime: context.proposedDateTime,
                durationMinutes,
                serviceName: name,
                serviceCost: service.cost,
                teamMemberId: context.selectedTeamMemberId,
            });
            // If payment required, create payment link and wait for confirmation
            if (paymentInfo.required && paymentInfo.amount > 0) {
                const amountToCharge = paymentInfo.depositAmount > 0 ? paymentInfo.depositAmount : paymentInfo.amount;
                context.pendingBookingIds = [booking.id];
                context.multiSessionStep = 'awaiting_payment';
                context.requiresPayment = true;
                try {
                    const paymentResponse = await this.createAndSendPaymentLink(context, booking.id, `${name} - Session 1`, amountToCharge);
                    return paymentResponse;
                }
                catch (paymentError) {
                    console.error('Payment link creation failed:', paymentError);
                    const strictPayments = await SettingsService_1.default.getSetting('strict_payment_enforcement');
                    if (strictPayments === 'true') {
                        await supabase_1.supabase.from('bookings').delete().eq('id', booking.id);
                        this.clearContext(context.conversationId);
                        return `I'm sorry, our payment system is temporarily unavailable. Please try again later or contact our support team.`;
                    }
                    console.warn('⚠️ Allowing booking without payment due to payment system error');
                }
            }
            // No payment required OR payment system failed - confirm immediately
            // CRITICAL: Create actual booking in database BEFORE sending confirmation
            const batchRequest = {
                contactId: context.contactId,
                conversationId: context.conversationId,
                phoneNumber: context.phoneNumber,
                serviceId: service.id,
                teamMemberId: context.selectedTeamMemberId,
                sessionGroupId: (0, crypto_1.randomUUID)(),
                bookings: [{
                        title: `${name} - Session 1/${totalSessionsRequired}`,
                        startTime: booking.startTime,
                        endTime: booking.endTime,
                        description: service.description || '',
                        sessionNumber: 1,
                        totalSessions: totalSessionsRequired
                    }]
            };
            const result = await BatchBookingService_1.default.createBatchBooking(batchRequest);
            if (!result.success) {
                this.clearContext(context.conversationId);
                return `I'm sorry, there was an error creating your booking: ${result.errors?.join(', ') || 'Unknown error'}`;
            }
            // Generate confirmation message with actual created booking
            const createdBooking = result.bookings[0];
            const bookingDate = new Date(createdBooking.startTime);
            const dateStr = bookingDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
            });
            const timeStr = bookingDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
            });
            const confirmationMsg = `✅ Session 1 of ${totalSessionsRequired} confirmed!\n\n📅 ${dateStr} at ${timeStr}\n\nAfter you complete this session, I'll reach out to help you schedule Session 2. See you soon! 🎉`;
            this.clearContext(context.conversationId);
            return confirmationMsg;
        }
        catch (error) {
            console.error('Failed to book sequential multi-session:', error);
            this.clearContext(context.conversationId);
            return `I'm sorry, there was an error booking your session. Please try again or contact support.`;
        }
    }
    /**
     * FLEXIBLE STRATEGY: Customer decides how many sessions to book at once
     * Example: Driving lessons (10-lesson package, customer paces)
     */
    async handleFlexibleBooking(context, service, message) {
        const { totalSessionsRequired, sessionBufferConfig, name, durationMinutes } = service;
        // Check existing progress
        const progress = await this.multiSessionLogic.getMultiSessionProgress(context.contactId, service.id);
        const remainingSessions = progress.totalSessions - progress.bookedSessions;
        // Step 1: Ask how many sessions to book (if not already asked)
        if (context.sessionsToBook === undefined) {
            const openai = await (0, openai_1.default)();
            const countResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Extract the number of sessions the customer wants to book. Return JSON:
{
  "hasCount": true/false,
  "sessionCount": number or null
}`,
                    },
                    { role: 'user', content: message },
                ],
                response_format: { type: 'json_object' },
            });
            const countInfo = JSON.parse(countResponse.choices[0]?.message?.content || '{}');
            if (!countInfo.hasCount || !countInfo.sessionCount) {
                if (progress.bookedSessions > 0) {
                    const progressMsg = this.multiSessionLogic.generateProgressMessage(progress.bookedSessions, progress.completedSessions, progress.totalSessions);
                    return `${progressMsg}\n\nHow many more sessions would you like to book now? (You have ${remainingSessions} remaining)`;
                }
                return `Great! ${name} is a ${totalSessionsRequired}-session package. You can book as many or as few sessions as you'd like at a time.\n\nHow many sessions would you like to book now? (1-${totalSessionsRequired})`;
            }
            context.sessionsToBook = Math.min(Math.max(1, countInfo.sessionCount), remainingSessions);
        }
        // Step 2: Collect dates for each session
        if (!context.collectedDates) {
            context.collectedDates = [];
        }
        const currentSessionNum = context.collectedDates.length + 1;
        // If we still need more dates
        if (context.collectedDates.length < context.sessionsToBook) {
            const openai = await (0, openai_1.default)();
            const dateTimeResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Extract date and time for session ${currentSessionNum}. Return JSON:
{
  "hasDateTime": true/false,
  "suggestedDate": "YYYY-MM-DD" or null,
  "suggestedTime": "HH:MM" or null
}`,
                    },
                    { role: 'user', content: message },
                ],
                response_format: { type: 'json_object' },
            });
            const dateTimeInfo = JSON.parse(dateTimeResponse.choices[0]?.message?.content || '{}');
            if (!dateTimeInfo.hasDateTime || !dateTimeInfo.suggestedDate) {
                return `Perfect! Please provide the date and time for Session ${currentSessionNum} (e.g., "March 10 at 3pm").`;
            }
            // Parse and validate date
            try {
                const dateStr = `${dateTimeInfo.suggestedDate}T${dateTimeInfo.suggestedTime || '10:00'}:00`;
                const sessionDate = new Date(dateStr);
                if (sessionDate <= new Date()) {
                    return "That time has already passed. Please provide a future date and time.";
                }
                context.collectedDates.push(sessionDate);
                // If we still need more dates, ask for the next one
                if (context.collectedDates.length < context.sessionsToBook) {
                    return `✓ Session ${currentSessionNum} noted.\n\nNow, when would you like Session ${currentSessionNum + 1}?`;
                }
            }
            catch (e) {
                return "I couldn't understand that date. Please try again (e.g., 'March 10 at 3pm').";
            }
        }
        // Step 3: All dates collected - confirm and book
        if (context.multiSessionStep !== 'confirm_all') {
            context.multiSessionStep = 'confirm_all';
            let preview = `Perfect! Here's your booking summary:\n\n`;
            context.collectedDates.forEach((date, idx) => {
                const sessionNumber = progress.bookedSessions + idx + 1;
                const dateStr = date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                });
                const timeStr = date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                });
                preview += `📅 Session ${sessionNumber}: ${dateStr} at ${timeStr}\n`;
            });
            preview += `\nConfirm these ${context.sessionsToBook} sessions? (Yes/No)`;
            return preview;
        }
        // Step 4: Check confirmation
        const confirmation = message.toLowerCase();
        if (!confirmation.includes('yes') && !confirmation.includes('confirm') && !confirmation.includes('ok')) {
            if (confirmation.includes('no') || confirmation.includes('cancel')) {
                this.clearContext(context.conversationId);
                return "No problem! Let me know if you'd like to book at different times.";
            }
            return `Please confirm by replying "yes" to book these sessions, or "no" to cancel.`;
        }
        // Step 4.5: Check email collection AFTER confirmation, BEFORE booking
        const emailCheckResult = await this.checkEmailCollection(context, message);
        if (emailCheckResult) {
            return emailCheckResult; // Return email collection prompt if needed
        }
        // Step 4.6: Select optimal team member if not already selected
        // For flexible strategy, select ONCE for all sessions using first session time
        if (!context.selectedTeamMemberId && context.collectedDates && context.collectedDates.length > 0) {
            try {
                const firstSessionStart = context.collectedDates[0];
                const firstSessionEnd = new Date(firstSessionStart.getTime() + durationMinutes * 60 * 1000);
                const teamMemberId = await this.selectOptimalTeamMember(service.id, firstSessionStart, firstSessionEnd, context.contactId);
                context.selectedTeamMemberId = teamMemberId || undefined;
                console.log(`✅ Team member selected for ${name} (flexible): ${teamMemberId || 'none (no team members configured)'}`);
            }
            catch (error) {
                // If team member selection fails (e.g., no availability), inform user
                this.clearContext(context.conversationId);
                return error.message || 'No team members are available for the selected time slots. Please try different times.';
            }
        }
        // Step 5: Check if payment is required BEFORE booking
        const paymentInfo = await this.requiresPayment(service.id);
        try {
            // For flexible strategy, we book each date separately but link them
            const bookings = [];
            for (let i = 0; i < context.collectedDates.length; i++) {
                const sessionDate = context.collectedDates[i];
                const sessionNumber = progress.bookedSessions + i + 1;
                const booking = await this.multiSessionLogic.bookFlexibleStrategy({
                    serviceId: service.id,
                    contactId: context.contactId,
                    conversationId: context.conversationId,
                    phoneNumber: context.phoneNumber,
                    strategy: 'flexible',
                    totalSessions: totalSessionsRequired,
                    sessionBufferConfig,
                    startDateTime: sessionDate,
                    durationMinutes,
                    serviceName: name,
                    serviceCost: service.cost,
                    sessionsToBook: 1, // Book one at a time in the loop
                    teamMemberId: context.selectedTeamMemberId,
                });
                bookings.push(...booking);
            }
            // If payment required, create payment link and wait for confirmation
            if (paymentInfo.required && paymentInfo.amount > 0) {
                const amountToCharge = paymentInfo.depositAmount > 0 ? paymentInfo.depositAmount : paymentInfo.amount;
                context.pendingBookingIds = bookings.map(b => b.id);
                context.multiSessionStep = 'awaiting_payment';
                context.requiresPayment = true;
                try {
                    const paymentResponse = await this.createAndSendPaymentLink(context, bookings[0].id, `${name} - ${bookings.length} sessions`, amountToCharge * bookings.length);
                    return paymentResponse;
                }
                catch (paymentError) {
                    console.error('Payment link creation failed:', paymentError);
                    const strictPayments = await SettingsService_1.default.getSetting('strict_payment_enforcement');
                    if (strictPayments === 'true') {
                        for (const booking of bookings) {
                            await supabase_1.supabase.from('bookings').delete().eq('id', booking.id);
                        }
                        this.clearContext(context.conversationId);
                        return `I'm sorry, our payment system is temporarily unavailable. Please try again later or contact our support team.`;
                    }
                    console.warn('⚠️ Allowing booking without payment due to payment system error');
                }
            }
            // No payment required OR payment system failed - confirm immediately
            // CRITICAL: Create actual bookings in database BEFORE sending confirmation
            const batchRequest = {
                contactId: context.contactId,
                conversationId: context.conversationId,
                phoneNumber: context.phoneNumber,
                serviceId: service.id,
                teamMemberId: context.selectedTeamMemberId,
                sessionGroupId: (0, crypto_1.randomUUID)(),
                bookings: bookings.map((b) => ({
                    title: `${name} - Session ${b.sessionNumber}/${totalSessionsRequired}`,
                    startTime: b.startTime,
                    endTime: b.endTime,
                    description: service.description || '',
                    sessionNumber: b.sessionNumber,
                    totalSessions: totalSessionsRequired
                }))
            };
            const result = await BatchBookingService_1.default.createBatchBooking(batchRequest);
            if (!result.success) {
                this.clearContext(context.conversationId);
                return `I'm sorry, there was an error creating your bookings: ${result.errors?.join(', ') || 'Unknown error'}`;
            }
            // Generate confirmation with progress using actual created bookings
            const newProgress = await this.multiSessionLogic.getMultiSessionProgress(context.contactId, service.id);
            let confirmationMsg = `✅ Sessions confirmed!\n\n`;
            result.bookings.forEach((booking) => {
                const bookingDate = new Date(booking.startTime);
                const dateStr = bookingDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                });
                const timeStr = bookingDate.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                });
                confirmationMsg += `📅 Session ${booking.sessionNumber}: ${dateStr} at ${timeStr}\n`;
            });
            confirmationMsg += `\n${this.multiSessionLogic.generateProgressMessage(newProgress.bookedSessions, newProgress.completedSessions, newProgress.totalSessions)}`;
            confirmationMsg += `\n\nYou can book more sessions anytime. See you soon! 🎉`;
            this.clearContext(context.conversationId);
            return confirmationMsg;
        }
        catch (error) {
            console.error('Failed to book flexible multi-session:', error);
            this.clearContext(context.conversationId);
            return `I'm sorry, there was an error booking your sessions. Please try again or contact support.`;
        }
    }
    /**
     * Check and enforce email collection based on configured mode
     * Returns null if email is collected or not required, or a prompt string if email collection is needed
     */
    async checkEmailCollection(context, message) {
        const config = await BotConfigService_1.default.getConfig();
        // If email collection is disabled, skip
        if (config.email_collection_mode === 'disabled') {
            return null;
        }
        // Get current contact email and name from database
        if (!context.contactEmail) {
            const { data: contact } = await supabase_1.supabase
                .from('contacts')
                .select('email, name')
                .eq('id', context.contactId)
                .single();
            context.contactEmail = contact?.email || undefined;
            // Store contact name for personalization
            if (!context.contactEmail && contact?.name) {
                context.contactName = contact.name;
            }
        }
        // If contact already has email, no need to ask
        if (context.contactEmail) {
            return null;
        }
        // Try to extract email from current message
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const emailMatch = message.match(emailRegex);
        if (emailMatch) {
            // Email found in message - save it
            const extractedEmail = emailMatch[0];
            await supabase_1.supabase
                .from('contacts')
                .update({ email: extractedEmail, updated_at: new Date().toISOString() })
                .eq('id', context.contactId);
            context.contactEmail = extractedEmail;
            context.emailCollectionAsked = true;
            console.log(`✅ Email collected from message: ${extractedEmail}`);
            return null; // Email collected, can proceed
        }
        // Email not found - check if we need to ask for it
        if (!context.emailCollectionAsked) {
            context.emailCollectionAsked = true;
            // Build conversation context for personalization
            const conversationContext = context.multiSessionService
                ? `Customer is booking ${context.multiSessionService.name}`
                : 'Customer is booking an appointment';
            if (config.email_collection_mode === 'mandatory') {
                // Mandatory mode - use personalized prompt through GPT
                const personalizedPrompt = await AIService_1.default.personalizeMessage({
                    templateMessage: config.email_collection_prompt_mandatory,
                    contactId: context.contactId,
                    contactName: context.contactName,
                    conversationContext,
                    messageType: 'email_request',
                });
                return personalizedPrompt;
            }
            else if (config.email_collection_mode === 'gentle') {
                // Gentle mode - use personalized prompt through GPT
                const personalizedPrompt = await AIService_1.default.personalizeMessage({
                    templateMessage: config.email_collection_prompt_gentle,
                    contactId: context.contactId,
                    contactName: context.contactName,
                    conversationContext,
                    messageType: 'email_request',
                });
                return personalizedPrompt;
            }
        }
        // If gentle mode and already asked, allow to proceed without email
        if (config.email_collection_mode === 'gentle') {
            return null;
        }
        // Mandatory mode and still no email - keep asking with personalized message
        if (config.email_collection_mode === 'mandatory') {
            const conversationContext = context.multiSessionService
                ? `Customer is booking ${context.multiSessionService.name}`
                : 'Customer is booking an appointment';
            const personalizedPrompt = await AIService_1.default.personalizeMessage({
                templateMessage: "I still need your email address to complete the booking. Could you please provide it? (e.g., yourname@example.com)",
                contactId: context.contactId,
                contactName: context.contactName,
                conversationContext,
                messageType: 'email_request',
            });
            return personalizedPrompt;
        }
        return null;
    }
}
exports.BookingChatHandler = BookingChatHandler;
exports.default = new BookingChatHandler();
