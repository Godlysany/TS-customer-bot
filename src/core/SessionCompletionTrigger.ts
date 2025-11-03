import { supabase } from '../infrastructure/supabase';
import { toCamelCase } from '../infrastructure/mapper';
import multiSessionLogic from './MultiSessionBookingLogic';

/**
 * SessionCompletionTrigger
 * 
 * Handles automatic triggering of next session booking prompts
 * for sequential multi-session services (e.g., physiotherapy, laser treatments)
 * 
 * When a session is marked as completed:
 * 1. Check if it's part of a multi-session treatment
 * 2. Check if it's a sequential strategy
 * 3. Check if there are more sessions remaining
 * 4. Send WhatsApp message prompting customer to book next session
 * 5. Create booking context for easy continuation
 */
export class SessionCompletionTrigger {
  private multiSessionLogic: typeof multiSessionLogic;

  constructor() {
    this.multiSessionLogic = multiSessionLogic;
  }

  /**
   * Called when a booking status changes to 'completed'
   * Checks if next session should be auto-triggered
   */
  async onBookingCompleted(bookingId: string): Promise<void> {
    try {
      // Get booking details with service info
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          id,
          contact_id,
          service_id,
          is_part_of_multi_session,
          session_group_id,
          session_number,
          total_sessions,
          services (
            id,
            name,
            multi_session_strategy,
            requires_multiple_sessions
          ),
          contacts (
            id,
            phone_number,
            name
          )
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.log('SessionCompletionTrigger: Booking not found', bookingError);
        return;
      }

      const bookingData = toCamelCase(booking);

      // Check if this booking should trigger next session
      if (!bookingData.isPartOfMultiSession) {
        return; // Not a multi-session booking
      }

      if (bookingData.services?.multiSessionStrategy !== 'sequential') {
        return; // Only sequential strategy needs auto-triggers
      }

      // Check if should trigger using MultiSessionBookingLogic
      const shouldTrigger = await this.multiSessionLogic.shouldTriggerNextSession(bookingId);

      if (!shouldTrigger) {
        console.log('SessionCompletionTrigger: Should not trigger for booking', bookingId);
        return;
      }

      // Get progress to show customer
      const progress = await this.multiSessionLogic.getMultiSessionProgress(
        bookingData.contactId,
        bookingData.serviceId
      );

      const nextSessionNumber = bookingData.sessionNumber + 1;

      // Generate WhatsApp message
      const message = this.generateNextSessionMessage(
        bookingData.services?.name || 'Treatment',
        bookingData.sessionNumber,
        nextSessionNumber,
        bookingData.totalSessions,
        progress
      );

      // Send WhatsApp message (import whatsappService dynamically to avoid circular deps)
      await this.sendWhatsAppMessage(
        bookingData.contacts?.phoneNumber,
        message,
        bookingData.contactId
      );

      // Log trigger event
      console.log(`✅ SessionCompletionTrigger: Sent next session prompt for ${bookingData.services?.name} (Session ${nextSessionNumber}/${bookingData.totalSessions}) to ${bookingData.contacts?.phoneNumber}`);

      // Create a note in the conversation
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', bookingData.contactId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (conversation) {
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          content: `AUTO-TRIGGER: Sequential session completion prompt sent for ${bookingData.services?.name} Session ${nextSessionNumber}`,
          message_type: 'system_note',
          direction: 'outbound',
          sender: 'system',
          created_at: new Date().toISOString(),
        });
      }

    } catch (error) {
      console.error('SessionCompletionTrigger error:', error);
      // Don't throw - this is a background trigger and shouldn't break the booking completion
    }
  }

  /**
   * Generate customer-friendly message prompting next session booking
   */
  private generateNextSessionMessage(
    serviceName: string,
    completedSessionNumber: number,
    nextSessionNumber: number,
    totalSessions: number,
    progress: {
      totalSessions: number;
      bookedSessions: number;
      completedSessions: number;
      remainingSessions: number;
    }
  ): string {
    const progressMsg = this.multiSessionLogic.generateProgressMessage(
      progress.bookedSessions,
      progress.completedSessions,
      progress.totalSessions
    );

    const message = `🎉 Congratulations on completing Session ${completedSessionNumber} of your ${serviceName} treatment!\n\n` +
      `${progressMsg}\n\n` +
      `When would you like to schedule Session ${nextSessionNumber}? ` +
      `Just let me know your preferred date and time, and I'll book it for you!`;

    return message;
  }

  /**
   * Send WhatsApp message (dynamically import to avoid circular dependencies)
   */
  private async sendWhatsAppMessage(phoneNumber: string, message: string, contactId?: string): Promise<void> {
    try {
      // Personalize through GPT for natural, language-appropriate delivery
      const { AIService } = await import('./AIService');
      const aiService = new AIService();
      const personalizedMessage = await aiService.personalizeMessage({
        templateMessage: message,
        contactId,
        conversationContext: 'Customer just completed a multi-session appointment',
        messageType: 'general',
      });

      // Dynamic import to avoid circular dependency with whatsapp adapter
      const { sendProactiveMessage } = await import('../adapters/whatsapp');
      await sendProactiveMessage(phoneNumber, personalizedMessage, contactId || '');
    } catch (error) {
      console.error('Failed to send WhatsApp message:', error);
      // Fall back to creating a system note for manual follow-up
      console.log(`FALLBACK: Manual follow-up needed for ${phoneNumber}: ${message}`);
    }
  }
}

export default new SessionCompletionTrigger();
