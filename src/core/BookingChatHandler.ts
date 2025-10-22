import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';
import BookingService from './BookingService';
import { MultiServiceBookingService } from './MultiServiceBookingService';
import multiSessionLogic from './MultiSessionBookingLogic';
import getOpenAIClient from '../infrastructure/openai';
import botConfigService from './BotConfigService';
import paymentLinkService from './PaymentLinkService';
import settingsService from './SettingsService';
import { sendWhatsAppMessage } from '../adapters/whatsapp';

interface BookingContext {
  conversationId: string;
  contactId: string;
  phoneNumber: string;
  currentBookings: any[];
  intent: 'cancel' | 'reschedule' | 'new';
  selectedBookingId?: string;
  proposedDateTime?: Date;
  cancellationReason?: string;
  emailCollectionAsked?: boolean;
  contactEmail?: string;
  // Multi-session fields
  multiSessionService?: any;
  multiSessionStep?: 'confirm_strategy' | 'collect_dates' | 'confirm_all' | 'awaiting_payment';
  sessionsToBook?: number;
  collectedDates?: Date[];
  // Payment tracking fields
  paymentLinkId?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'expired';
  paymentExpiresAt?: Date;
  pendingBookingIds?: string[]; // Temporary booking IDs awaiting payment confirmation
  requiresPayment?: boolean;
  paymentAmount?: number;
}

export class BookingChatHandler {
  private bookingService: typeof BookingService;
  private multiServiceService: MultiServiceBookingService;
  private multiSessionLogic: typeof multiSessionLogic;
  private contexts: Map<string, BookingContext> = new Map();

  constructor() {
    this.bookingService = BookingService;
    this.multiServiceService = new MultiServiceBookingService();
    this.multiSessionLogic = multiSessionLogic;
  }

  /**
   * Check if a conversation has an active booking context
   */
  hasActiveContext(conversationId: string): boolean {
    return this.contexts.has(conversationId);
  }

  /**
   * Handle any message within an active booking context
   */
  async handleContextMessage(
    conversationId: string,
    message: string,
    messageHistory: any[]
  ): Promise<string> {
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
    } else if (context.intent === 'reschedule') {
      return await this.handleRescheduling(context, message, messageHistory);
    } else {
      return await this.handleNewBooking(context, message, messageHistory);
    }
  }

  /**
   * Handle booking-related intents through conversational flow
   */
  async handleBookingIntent(
    intent: 'booking_request' | 'booking_modify' | 'booking_cancel',
    conversationId: string,
    contactId: string,
    phoneNumber: string,
    message: string,
    messageHistory: any[]
  ): Promise<string> {
    const context = this.getOrCreateContext(conversationId, contactId, phoneNumber);

    // Fetch user's current bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*, services(name, duration_minutes)')
      .eq('contact_id', contactId)
      .in('status', ['confirmed', 'pending'])
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true });

    context.currentBookings = (bookings || []).map(toCamelCase);

    // Set intent in context for future message routing
    if (intent === 'booking_cancel') {
      context.intent = 'cancel';
      return await this.handleCancellation(context, message, messageHistory);
    } else if (intent === 'booking_modify') {
      context.intent = 'reschedule';
      return await this.handleRescheduling(context, message, messageHistory);
    } else {
      context.intent = 'new';
      return await this.handleNewBooking(context, message, messageHistory);
    }
  }

  private async handleCancellation(
    context: BookingContext,
    message: string,
    messageHistory: any[]
  ): Promise<string> {
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
      } else {
        // Multiple bookings - try to extract selection from message
        const numberMatch = message.match(/\b(\d+)\b/);
        if (numberMatch) {
          const index = parseInt(numberMatch[1]) - 1;
          if (index >= 0 && index < context.currentBookings.length) {
            context.selectedBookingId = context.currentBookings[index].id;
            // Selection successful - continue to next step (fall through)
          } else {
            return `Please enter a valid number between 1 and ${context.currentBookings.length}.`;
          }
        } else {
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
      const openai = await getOpenAIClient();
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
      const result = await this.bookingService.cancelBooking(
        context.selectedBookingId!,
        context.cancellationReason || 'Customer requested cancellation'
      );

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
    } catch (error: any) {
      console.error('Cancellation error:', error);
      this.clearContext(context.conversationId);
      return `I'm sorry, there was an error cancelling your appointment: ${error.message}. Please contact our support team for assistance.`;
    }
  }

  private async handleRescheduling(
    context: BookingContext,
    message: string,
    messageHistory: any[]
  ): Promise<string> {
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
      } else {
        // Multiple bookings - try to extract selection from message
        const numberMatch = message.match(/\b(\d+)\b/);
        if (numberMatch) {
          const index = parseInt(numberMatch[1]) - 1;
          if (index >= 0 && index < context.currentBookings.length) {
            context.selectedBookingId = context.currentBookings[index].id;
            // Selection successful - continue to next step (fall through)
          } else {
            return `Please enter a valid number between 1 and ${context.currentBookings.length}.`;
          }
        } else {
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
      const openai = await getOpenAIClient();
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
      } catch (e) {
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
    await supabase.from('messages').insert({
      conversation_id: context.conversationId,
      content: `RESCHEDULE REQUEST: ${serviceName} from ${oldDate.toISOString()} to ${context.proposedDateTime.toISOString()}`,
      message_type: 'system_note',
      direction: 'inbound',
      sender: 'system',
    });

    this.clearContext(context.conversationId);
    return response;
  }

  private async handleNewBooking(
    context: BookingContext,
    message: string,
    messageHistory: any[]
  ): Promise<string> {
    // Check email collection before allowing booking to complete
    const emailCheckResult = await this.checkEmailCollection(context, message);
    if (emailCheckResult) {
      return emailCheckResult; // Return email collection prompt if needed
    }

    // Query services with multi-session fields
    const { data: services } = await supabase
      .from('services')
      .select('id, name, requires_multiple_sessions, multi_session_strategy, total_sessions_required, session_buffer_config, duration_minutes, cost')
      .eq('is_active', true);

    const serviceMentioned = services?.find(s => 
      message.toLowerCase().includes(s.name.toLowerCase())
    );

    if (serviceMentioned) {
      // Check if this is a multi-session service
      if (serviceMentioned.requires_multiple_sessions) {
        // Route to multi-session handler
        return await this.handleMultiSessionBooking(
          context,
          toCamelCase(serviceMentioned),
          message
        );
      }

      // Standard single-session booking flow
      const recommendations = await this.multiServiceService.getServiceRecommendations(
        context.contactId,
        serviceMentioned.id
      );

      let response = `Great choice! I can help you book a ${serviceMentioned.name} appointment.\n\n`;

      if (recommendations.length > 0) {
        response += await this.multiServiceService.formatRecommendationsMessage(recommendations);
        response += '\n\n';
      }

      response += 'What date and time works best for you?';

      this.clearContext(context.conversationId);
      return response;
    }

    const recommendations = await this.multiServiceService.getServiceRecommendations(
      context.contactId
    );

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

  private async suggestRebooking(context: BookingContext, serviceName: string): Promise<string> {
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
  private async isPaymentEnabled(): Promise<boolean> {
    const paymentsEnabled = await settingsService.getSetting('payments_enabled');
    const stripeKey = await settingsService.getSetting('stripe_api_key');
    return paymentsEnabled === 'true' && !!stripeKey && stripeKey.trim() !== '';
  }

  /**
   * Check if service requires payment
   */
  private async requiresPayment(serviceId: string): Promise<{ required: boolean; amount: number; depositAmount: number }> {
    const { data: service } = await supabase
      .from('services')
      .select('requires_payment, cost, deposit_amount')
      .eq('id', serviceId)
      .single();

    if (!service) {
      return { required: false, amount: 0, depositAmount: 0 };
    }

    const serviceData = toCamelCase(service);
    return {
      required: serviceData.requiresPayment || false,
      amount: serviceData.cost || 0,
      depositAmount: serviceData.depositAmount || 0,
    };
  }

  /**
   * Create payment link and send to customer via WhatsApp
   */
  private async createAndSendPaymentLink(
    context: BookingContext,
    bookingId: string,
    serviceName: string,
    amount: number
  ): Promise<string> {
    try {
      const paymentEnabled = await this.isPaymentEnabled();
      
      if (!paymentEnabled) {
        console.warn('⚠️ Payment required but payments not enabled - allowing booking without payment');
        return ''; // Allow booking to proceed without payment if system not configured
      }

      // Create payment link
      const paymentLink = await paymentLinkService.createPaymentLink({
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

      await sendWhatsAppMessage(context.phoneNumber, paymentMessage);

      // Update payment_link record with WhatsApp message sent
      await supabase
        .from('payment_links')
        .update({ whatsapp_message_sent_at: new Date().toISOString() })
        .eq('id', paymentLink.payment_link_id);

      return `I've sent you a secure payment link via WhatsApp. Please complete the payment to confirm your booking. I'll be here when you're ready! 😊`;
    } catch (error: any) {
      console.error('❌ Error creating payment link:', error);
      throw new Error(`Payment system error: ${error.message}`);
    }
  }

  /**
   * Check payment status from database
   */
  private async checkPaymentStatus(paymentLinkId: string): Promise<'pending' | 'paid' | 'failed' | 'expired'> {
    const { data: paymentLink } = await supabase
      .from('payment_links')
      .select('payment_status, expires_at')
      .eq('id', paymentLinkId)
      .single();

    if (!paymentLink) {
      return 'failed';
    }

    const paymentData = toCamelCase(paymentLink);
    
    // Check if expired
    const now = new Date();
    const expiresAt = new Date(paymentData.expiresAt);
    if (now > expiresAt && paymentData.paymentStatus === 'pending') {
      return 'expired';
    }

    return paymentData.paymentStatus as 'pending' | 'paid' | 'failed' | 'expired';
  }

  /**
   * Handle payment confirmation check during conversation
   */
  private async handlePaymentConfirmation(context: BookingContext): Promise<string | null> {
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
            await supabase
              .from('bookings')
              .update({ status: 'confirmed' })
              .eq('id', bookingId);
          }
        }
        this.clearContext(context.conversationId);
        return `✅ Payment confirmed! Your booking is now complete. You'll receive a confirmation email shortly. Looking forward to seeing you!`;

      case 'expired':
        // Payment link expired
        this.clearContext(context.conversationId);
        return `⏰ Your payment link has expired. To proceed with the booking, please start over and I'll generate a new payment link for you.`;

      case 'failed':
        // Payment failed
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

  private getOrCreateContext(conversationId: string, contactId: string, phoneNumber: string): BookingContext {
    if (!this.contexts.has(conversationId)) {
      this.contexts.set(conversationId, {
        conversationId,
        contactId,
        phoneNumber,
        currentBookings: [],
        intent: 'new',
      });
    }
    return this.contexts.get(conversationId)!;
  }

  private clearContext(conversationId: string): void {
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
  private async handleMultiSessionBooking(
    context: BookingContext,
    service: any,
    message: string
  ): Promise<string> {
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
  private async handleImmediateBooking(
    context: BookingContext,
    service: any,
    message: string
  ): Promise<string> {
    const { totalSessionsRequired, sessionBufferConfig, name, durationMinutes } = service;

    // Step 1: If no proposed date/time, extract from message
    if (!context.proposedDateTime) {
      const openai = await getOpenAIClient();
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
      } catch (e) {
        return "I couldn't understand the date and time you mentioned. Could you please provide it again? For example: 'March 15 at 2pm' or 'next Monday at 10:30am'.";
      }
    }

    // Step 2: Calculate all session dates using MultiSessionBookingLogic
    const schedule = this.multiSessionLogic.calculateSessionSchedule(
      {
        sessionBufferConfig,
        startDateTime: context.proposedDateTime,
        totalSessions: totalSessionsRequired,
      } as any,
      totalSessionsRequired
    );

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
      });

      // If payment required, create payment link and wait for confirmation
      if (paymentInfo.required && paymentInfo.amount > 0) {
        const amountToCharge = paymentInfo.depositAmount > 0 ? paymentInfo.depositAmount : paymentInfo.amount;
        
        // Store booking IDs in context for later confirmation
        context.pendingBookingIds = bookings.map((b: any) => b.id);
        context.multiSessionStep = 'awaiting_payment';
        context.requiresPayment = true;
        
        // Create and send payment link
        try {
          const paymentResponse = await this.createAndSendPaymentLink(
            context,
            bookings[0].id, // Use first booking ID for payment link
            name,
            amountToCharge * totalSessionsRequired // Total for all sessions
          );
          
          return paymentResponse;
        } catch (paymentError: any) {
          // If payment system fails, log error but allow booking if payments not strictly enforced
          console.error('Payment link creation failed:', paymentError);
          
          // Check if payments are strictly enforced
          const strictPayments = await settingsService.getSetting('strict_payment_enforcement');
          if (strictPayments === 'true') {
            // Cancel bookings if strict enforcement
            for (const booking of bookings) {
              await supabase.from('bookings').delete().eq('id', booking.id);
            }
            this.clearContext(context.conversationId);
            return `I'm sorry, our payment system is temporarily unavailable. Please try again later or contact our support team.`;
          }
          
          // Otherwise, allow booking without payment
          console.warn('⚠️ Allowing booking without payment due to payment system error');
        }
      }

      // No payment required OR payment system failed with non-strict enforcement - confirm immediately
      // Generate confirmation message
      let confirmationMsg = `✅ Perfect! All ${totalSessionsRequired} ${name} sessions are now confirmed:\n\n`;
      
      bookings.forEach((booking, idx) => {
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
    } catch (error) {
      console.error('Failed to book immediate multi-session:', error);
      this.clearContext(context.conversationId);
      return `I'm sorry, there was an error booking your sessions. Please try again or contact our support team.`;
    }
  }

  /**
   * SEQUENTIAL STRATEGY: Book one session at a time, auto-trigger next after completion
   * Example: Physiotherapy (8 sessions, book after each completion)
   */
  private async handleSequentialBooking(
    context: BookingContext,
    service: any,
    message: string
  ): Promise<string> {
    const { totalSessionsRequired, name, durationMinutes } = service;

    // Check if customer already has sessions in progress
    const progress = await this.multiSessionLogic.getMultiSessionProgress(
      context.contactId,
      service.id
    );

    if (progress.bookedSessions > 0) {
      // Customer has existing sessions
      const progressMsg = this.multiSessionLogic.generateProgressMessage(
        progress.bookedSessions,
        progress.completedSessions,
        progress.totalSessions
      );
      
      return `${progressMsg}\n\nI'll send you a reminder to book your next session after you complete the current one. Is there anything else I can help with?`;
    }

    // Step 1: Extract date/time for FIRST session only
    if (!context.proposedDateTime) {
      const openai = await getOpenAIClient();
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
      } catch (e) {
        return "I couldn't understand the date and time. Please try again (e.g., 'March 15 at 2pm').";
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
      });

      // If payment required, create payment link and wait for confirmation
      if (paymentInfo.required && paymentInfo.amount > 0) {
        const amountToCharge = paymentInfo.depositAmount > 0 ? paymentInfo.depositAmount : paymentInfo.amount;
        
        context.pendingBookingIds = [booking.id];
        context.multiSessionStep = 'awaiting_payment';
        context.requiresPayment = true;
        
        try {
          const paymentResponse = await this.createAndSendPaymentLink(
            context,
            booking.id,
            `${name} - Session 1`,
            amountToCharge
          );
          
          return paymentResponse;
        } catch (paymentError: any) {
          console.error('Payment link creation failed:', paymentError);
          const strictPayments = await settingsService.getSetting('strict_payment_enforcement');
          if (strictPayments === 'true') {
            await supabase.from('bookings').delete().eq('id', booking.id);
            this.clearContext(context.conversationId);
            return `I'm sorry, our payment system is temporarily unavailable. Please try again later or contact our support team.`;
          }
          console.warn('⚠️ Allowing booking without payment due to payment system error');
        }
      }

      // No payment required OR payment system failed - confirm immediately
      const bookingDate = new Date(booking.startTime);
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
    } catch (error) {
      console.error('Failed to book sequential multi-session:', error);
      this.clearContext(context.conversationId);
      return `I'm sorry, there was an error booking your session. Please try again or contact support.`;
    }
  }

  /**
   * FLEXIBLE STRATEGY: Customer decides how many sessions to book at once
   * Example: Driving lessons (10-lesson package, customer paces)
   */
  private async handleFlexibleBooking(
    context: BookingContext,
    service: any,
    message: string
  ): Promise<string> {
    const { totalSessionsRequired, sessionBufferConfig, name, durationMinutes } = service;

    // Check existing progress
    const progress = await this.multiSessionLogic.getMultiSessionProgress(
      context.contactId,
      service.id
    );

    const remainingSessions = progress.totalSessions - progress.bookedSessions;

    // Step 1: Ask how many sessions to book (if not already asked)
    if (context.sessionsToBook === undefined) {
      const openai = await getOpenAIClient();
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
          const progressMsg = this.multiSessionLogic.generateProgressMessage(
            progress.bookedSessions,
            progress.completedSessions,
            progress.totalSessions
          );
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
    if (context.collectedDates.length < context.sessionsToBook!) {
      const openai = await getOpenAIClient();
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
        if (context.collectedDates.length < context.sessionsToBook!) {
          return `✓ Session ${currentSessionNum} noted.\n\nNow, when would you like Session ${currentSessionNum + 1}?`;
        }
      } catch (e) {
        return "I couldn't understand that date. Please try again (e.g., 'March 10 at 3pm').";
      }
    }

    // Step 3: All dates collected - confirm and book
    if (context.multiSessionStep !== 'confirm_all') {
      context.multiSessionStep = 'confirm_all';

      let preview = `Perfect! Here's your booking summary:\n\n`;
      context.collectedDates!.forEach((date, idx) => {
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

    // Step 5: Check if payment is required BEFORE booking
    const paymentInfo = await this.requiresPayment(service.id);
    
    try {
      // For flexible strategy, we book each date separately but link them
      const bookings = [];
      
      for (let i = 0; i < context.collectedDates!.length; i++) {
        const sessionDate = context.collectedDates![i];
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
          const paymentResponse = await this.createAndSendPaymentLink(
            context,
            bookings[0].id,
            `${name} - ${bookings.length} sessions`,
            amountToCharge * bookings.length
          );
          
          return paymentResponse;
        } catch (paymentError: any) {
          console.error('Payment link creation failed:', paymentError);
          const strictPayments = await settingsService.getSetting('strict_payment_enforcement');
          if (strictPayments === 'true') {
            for (const booking of bookings) {
              await supabase.from('bookings').delete().eq('id', booking.id);
            }
            this.clearContext(context.conversationId);
            return `I'm sorry, our payment system is temporarily unavailable. Please try again later or contact our support team.`;
          }
          console.warn('⚠️ Allowing booking without payment due to payment system error');
        }
      }

      // No payment required OR payment system failed - confirm immediately
      // Generate confirmation with progress
      const newProgress = await this.multiSessionLogic.getMultiSessionProgress(
        context.contactId,
        service.id
      );

      let confirmationMsg = `✅ Sessions confirmed!\n\n`;
      
      bookings.forEach((booking) => {
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

      confirmationMsg += `\n${this.multiSessionLogic.generateProgressMessage(
        newProgress.bookedSessions,
        newProgress.completedSessions,
        newProgress.totalSessions
      )}`;

      confirmationMsg += `\n\nYou can book more sessions anytime. See you soon! 🎉`;

      this.clearContext(context.conversationId);
      return confirmationMsg;
    } catch (error) {
      console.error('Failed to book flexible multi-session:', error);
      this.clearContext(context.conversationId);
      return `I'm sorry, there was an error booking your sessions. Please try again or contact support.`;
    }
  }

  /**
   * Check and enforce email collection based on configured mode
   * Returns null if email is collected or not required, or a prompt string if email collection is needed
   */
  private async checkEmailCollection(context: BookingContext, message: string): Promise<string | null> {
    const config = await botConfigService.getConfig();
    
    // If email collection is disabled, skip
    if (config.email_collection_mode === 'disabled') {
      return null;
    }

    // Get current contact email from database
    if (!context.contactEmail) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('email')
        .eq('id', context.contactId)
        .single();
      
      context.contactEmail = contact?.email || undefined;
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
      await supabase
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

      if (config.email_collection_mode === 'mandatory') {
        // Mandatory mode - require email before proceeding
        return config.email_collection_prompt_mandatory;
      } else if (config.email_collection_mode === 'gentle') {
        // Gentle mode - ask politely but allow skip
        return config.email_collection_prompt_gentle;
      }
    }

    // If gentle mode and already asked, allow to proceed without email
    if (config.email_collection_mode === 'gentle') {
      return null;
    }

    // Mandatory mode and still no email - keep asking
    if (config.email_collection_mode === 'mandatory') {
      return "I still need your email address to complete the booking. Could you please provide it? (e.g., yourname@example.com)";
    }

    return null;
  }
}

export default new BookingChatHandler();
