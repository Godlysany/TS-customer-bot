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
exports.SessionCompletionTrigger = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
const MultiSessionBookingLogic_1 = __importDefault(require("./MultiSessionBookingLogic"));
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
class SessionCompletionTrigger {
    multiSessionLogic;
    constructor() {
        this.multiSessionLogic = MultiSessionBookingLogic_1.default;
    }
    /**
     * Called when a booking status changes to 'completed'
     * Checks if next session should be auto-triggered
     */
    async onBookingCompleted(bookingId) {
        try {
            // Get booking details with service info
            const { data: booking, error: bookingError } = await supabase_1.supabase
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
            const bookingData = (0, mapper_1.toCamelCase)(booking);
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
            const progress = await this.multiSessionLogic.getMultiSessionProgress(bookingData.contactId, bookingData.serviceId);
            const nextSessionNumber = bookingData.sessionNumber + 1;
            // Generate WhatsApp message
            const message = this.generateNextSessionMessage(bookingData.services?.name || 'Treatment', bookingData.sessionNumber, nextSessionNumber, bookingData.totalSessions, progress);
            // Send WhatsApp message (import whatsappService dynamically to avoid circular deps)
            await this.sendWhatsAppMessage(bookingData.contacts?.phoneNumber, message, bookingData.contactId);
            // Log trigger event
            console.log(`✅ SessionCompletionTrigger: Sent next session prompt for ${bookingData.services?.name} (Session ${nextSessionNumber}/${bookingData.totalSessions}) to ${bookingData.contacts?.phoneNumber}`);
            // Create a note in the conversation
            const { data: conversation } = await supabase_1.supabase
                .from('conversations')
                .select('id')
                .eq('contact_id', bookingData.contactId)
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();
            if (conversation) {
                await supabase_1.supabase.from('messages').insert({
                    conversation_id: conversation.id,
                    content: `AUTO-TRIGGER: Sequential session completion prompt sent for ${bookingData.services?.name} Session ${nextSessionNumber}`,
                    message_type: 'system_note',
                    direction: 'outbound',
                    sender: 'system',
                    created_at: new Date().toISOString(),
                });
            }
        }
        catch (error) {
            console.error('SessionCompletionTrigger error:', error);
            // Don't throw - this is a background trigger and shouldn't break the booking completion
        }
    }
    /**
     * Generate customer-friendly message prompting next session booking
     */
    generateNextSessionMessage(serviceName, completedSessionNumber, nextSessionNumber, totalSessions, progress) {
        const progressMsg = this.multiSessionLogic.generateProgressMessage(progress.bookedSessions, progress.completedSessions, progress.totalSessions);
        const message = `🎉 Congratulations on completing Session ${completedSessionNumber} of your ${serviceName} treatment!\n\n` +
            `${progressMsg}\n\n` +
            `When would you like to schedule Session ${nextSessionNumber}? ` +
            `Just let me know your preferred date and time, and I'll book it for you!`;
        return message;
    }
    /**
     * Send WhatsApp message (dynamically import to avoid circular dependencies)
     */
    async sendWhatsAppMessage(phoneNumber, message, contactId) {
        try {
            // Dynamic import to avoid circular dependency with whatsapp adapter
            const { sendProactiveMessage } = await Promise.resolve().then(() => __importStar(require('../adapters/whatsapp')));
            await sendProactiveMessage(phoneNumber, message, contactId || '');
        }
        catch (error) {
            console.error('Failed to send WhatsApp message:', error);
            // Fall back to creating a system note for manual follow-up
            console.log(`FALLBACK: Manual follow-up needed for ${phoneNumber}: ${message}`);
        }
    }
}
exports.SessionCompletionTrigger = SessionCompletionTrigger;
exports.default = new SessionCompletionTrigger();
