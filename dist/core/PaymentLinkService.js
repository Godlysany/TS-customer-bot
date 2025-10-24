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
const stripe_1 = __importDefault(require("stripe"));
const supabase_1 = require("../infrastructure/supabase");
const SettingsService_1 = __importDefault(require("./SettingsService"));
const logger_1 = require("../infrastructure/logger");
class PaymentLinkService {
    stripe = null;
    /**
     * Initialize Stripe client
     */
    async getStripeClient() {
        if (this.stripe)
            return this.stripe;
        const apiKey = await SettingsService_1.default.getSetting('stripe_api_key');
        if (!apiKey) {
            throw new Error('Stripe API key not configured');
        }
        this.stripe = new stripe_1.default(apiKey, {
            apiVersion: '2024-12-18.acacia', // Use latest version
        });
        return this.stripe;
    }
    /**
     * Create a payment link for a booking
     */
    async createPaymentLink(request) {
        let stripeSessionId = null;
        let paymentLinkId = null;
        try {
            (0, logger_1.logInfo)('Creating payment link', { booking_id: request.booking_id, amount: request.amount_chf });
            const stripe = await this.getStripeClient();
            // Get booking details for metadata
            const { data: booking, error: bookingError } = await supabase_1.supabase
                .from('bookings')
                .select('title, start_time, service_id')
                .eq('id', request.booking_id)
                .single();
            if (bookingError || !booking) {
                throw new Error(`Booking not found: ${request.booking_id}`);
            }
            // Get contact details
            const { data: contact, error: contactError } = await supabase_1.supabase
                .from('contacts')
                .select('name, email, phone_number')
                .eq('id', request.contact_id)
                .single();
            if (contactError || !contact) {
                throw new Error(`Contact not found: ${request.contact_id}`);
            }
            // Prepare metadata
            const metadata = {
                booking_id: request.booking_id,
                contact_id: request.contact_id,
                phone_number: contact.phone_number || '',
                ...request.metadata,
            };
            if (request.promotion_id) {
                metadata.promotion_id = request.promotion_id;
                metadata.discount_chf = request.discount_chf?.toString() || '0';
            }
            // Get success/cancel URLs from environment or settings
            const baseUrl = process.env.REPLIT_DEV_DOMAIN
                ? `https://${process.env.REPLIT_DEV_DOMAIN}`
                : await SettingsService_1.default.getSetting('base_url') || 'http://localhost:8080';
            // Create Stripe Checkout Session with retry logic
            let session;
            try {
                session = await stripe.checkout.sessions.create({
                    payment_method_types: ['card'],
                    line_items: [
                        {
                            price_data: {
                                currency: 'chf',
                                product_data: {
                                    name: booking.title || request.description,
                                    description: request.description,
                                },
                                unit_amount: Math.round(request.amount_chf * 100),
                            },
                            quantity: 1,
                        },
                    ],
                    mode: 'payment',
                    success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `${baseUrl}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
                    customer_email: contact.email || undefined,
                    metadata,
                    expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
                });
                stripeSessionId = session.id;
                (0, logger_1.logInfo)('Stripe session created', { session_id: session.id });
            }
            catch (stripeError) {
                (0, logger_1.logError)('Stripe checkout session creation failed', stripeError);
                throw new Error(`Stripe payment link creation failed: ${stripeError.message}`);
            }
            // Store payment link in database
            const expiresAt = new Date(session.expires_at * 1000).toISOString();
            const { data: paymentLink, error } = await supabase_1.supabase
                .from('payment_links')
                .insert({
                booking_id: request.booking_id,
                contact_id: request.contact_id,
                stripe_checkout_session_id: session.id,
                checkout_url: session.url,
                amount_chf: request.amount_chf,
                original_amount_chf: request.original_amount_chf || request.amount_chf,
                promotion_id: request.promotion_id || null,
                discount_applied_chf: request.discount_chf || 0,
                payment_status: 'pending',
                expires_at: expiresAt,
            })
                .select('id')
                .single();
            if (error) {
                (0, logger_1.logError)('Database insert failed for payment link', error);
                throw new Error(`Failed to save payment link: ${error.message}`);
            }
            paymentLinkId = paymentLink.id;
            (0, logger_1.logInfo)('Payment link created successfully', { payment_link_id: paymentLinkId });
            return {
                payment_link_id: paymentLink.id,
                checkout_url: session.url,
                stripe_session_id: session.id,
                expires_at: expiresAt,
            };
        }
        catch (error) {
            (0, logger_1.logError)('Payment link creation failed - initiating rollback', {
                error: error.message,
                booking_id: request.booking_id,
                stripe_session_id: stripeSessionId
            });
            // M2: ROLLBACK - Clean up Stripe session if database insert failed
            if (stripeSessionId && !paymentLinkId) {
                try {
                    const stripe = await this.getStripeClient();
                    await stripe.checkout.sessions.expire(stripeSessionId);
                    (0, logger_1.logInfo)('Stripe session expired during rollback', { session_id: stripeSessionId });
                }
                catch (rollbackError) {
                    (0, logger_1.logWarn)('Failed to expire Stripe session during rollback', {
                        session_id: stripeSessionId,
                        error: rollbackError.message
                    });
                }
            }
            // Re-throw with context
            throw new Error(`Payment link creation failed: ${error.message}`);
        }
    }
    /**
     * Handle Stripe webhook for payment confirmation
     */
    async handleWebhookEvent(event) {
        try {
            switch (event.type) {
                case 'checkout.session.completed':
                    await this.handleCheckoutSessionCompleted(event.data.object);
                    break;
                case 'checkout.session.expired':
                    await this.handleCheckoutSessionExpired(event.data.object);
                    break;
                case 'payment_intent.succeeded':
                    await this.handlePaymentIntentSucceeded(event.data.object);
                    break;
                case 'payment_intent.payment_failed':
                    await this.handlePaymentIntentFailed(event.data.object);
                    break;
                default:
                    console.log(`Unhandled event type: ${event.type}`);
            }
        }
        catch (error) {
            console.error('Error handling webhook event:', error);
            throw error;
        }
    }
    /**
     * Handle checkout session completed
     */
    async handleCheckoutSessionCompleted(session) {
        try {
            // Update payment link status
            const { data: paymentLink } = await supabase_1.supabase
                .from('payment_links')
                .select('booking_id, contact_id, amount_chf') // amount_chf exists in payment_links table
                .eq('stripe_checkout_session_id', session.id)
                .single();
            if (!paymentLink) {
                console.error('Payment link not found for session:', session.id);
                return;
            }
            await supabase_1.supabase
                .from('payment_links')
                .update({
                payment_status: 'paid',
                stripe_payment_intent_id: session.payment_intent,
                paid_at: new Date().toISOString(),
            })
                .eq('stripe_checkout_session_id', session.id);
            // Update booking status
            await supabase_1.supabase
                .from('bookings')
                .update({
                status: 'confirmed',
                updated_at: new Date().toISOString(),
            })
                .eq('id', paymentLink.booking_id);
            // Create payment transaction record (using 'amount' column)
            await supabase_1.supabase.from('payment_transactions').insert({
                contact_id: paymentLink.contact_id,
                booking_id: paymentLink.booking_id,
                amount: paymentLink.amount_chf, // Use base 'amount' column
                currency: 'CHF',
                payment_method: 'card',
                payment_type: 'booking',
                status: 'succeeded',
                stripe_payment_intent_id: session.payment_intent,
                stripe_charge_id: session.payment_intent,
            });
            console.log(`Payment confirmed for booking: ${paymentLink.booking_id}`);
            // BOT INTEGRATION: Send WhatsApp confirmation to customer
            await this.sendPaymentConfirmationWhatsApp(paymentLink.contact_id, paymentLink.amount_chf, 'success', paymentLink.booking_id);
        }
        catch (error) {
            console.error('Error handling checkout session completed:', error);
            throw error;
        }
    }
    /**
     * Handle checkout session expired
     */
    async handleCheckoutSessionExpired(session) {
        try {
            // Get payment link to find associated booking(s)
            const { data: paymentLink } = await supabase_1.supabase
                .from('payment_links')
                .select('booking_id')
                .eq('stripe_checkout_session_id', session.id)
                .single();
            // Update payment link status
            await supabase_1.supabase
                .from('payment_links')
                .update({
                payment_status: 'expired',
            })
                .eq('stripe_checkout_session_id', session.id);
            // CRITICAL: Cancel all pending bookings for this payment link to free up availability
            if (paymentLink?.booking_id) {
                // Find all bookings in pending status for this contact and service
                // (covers multi-session bookings created together)
                const { data: booking } = await supabase_1.supabase
                    .from('bookings')
                    .select('contact_id, service_id, session_group_id')
                    .eq('id', paymentLink.booking_id)
                    .single();
                if (booking) {
                    // Cancel the primary booking
                    await supabase_1.supabase
                        .from('bookings')
                        .update({ status: 'cancelled', cancellation_reason: 'Payment link expired' })
                        .eq('id', paymentLink.booking_id)
                        .eq('status', 'pending');
                    // If part of multi-session group, cancel all pending bookings in the group
                    if (booking.session_group_id) {
                        await supabase_1.supabase
                            .from('bookings')
                            .update({ status: 'cancelled', cancellation_reason: 'Payment link expired for session group' })
                            .eq('session_group_id', booking.session_group_id)
                            .eq('status', 'pending');
                    }
                    console.log(`✅ Payment expired: cancelled pending booking(s) for payment link ${paymentLink.booking_id}`);
                }
            }
            console.log(`Payment link expired for session: ${session.id}`);
            // BOT INTEGRATION: Notify customer of expiration
            if (paymentLink) {
                const { data: linkData } = await supabase_1.supabase
                    .from('payment_links')
                    .select('contact_id, amount_chf')
                    .eq('stripe_checkout_session_id', session.id)
                    .single();
                if (linkData) {
                    await this.sendPaymentConfirmationWhatsApp(linkData.contact_id, linkData.amount_chf, 'expired');
                }
            }
        }
        catch (error) {
            console.error('Error handling checkout session expired:', error);
        }
    }
    /**
     * Handle payment intent succeeded
     */
    async handlePaymentIntentSucceeded(paymentIntent) {
        try {
            // Find payment link by payment intent ID
            const { data: paymentLink } = await supabase_1.supabase
                .from('payment_links')
                .select('*')
                .eq('stripe_payment_intent_id', paymentIntent.id)
                .single();
            if (!paymentLink) {
                console.log('Payment link not found for payment intent:', paymentIntent.id);
                return;
            }
            // Already handled in checkout.session.completed
            console.log(`Payment intent succeeded: ${paymentIntent.id}`);
        }
        catch (error) {
            console.error('Error handling payment intent succeeded:', error);
        }
    }
    /**
     * Handle payment intent failed
     */
    async handlePaymentIntentFailed(paymentIntent) {
        try {
            // CRITICAL FIX: stripe_payment_intent_id is only populated on successful completion
            // For failed payments, we need to look up via checkout session ID from charges metadata
            const stripe = await this.getStripeClient();
            let checkoutSessionId = null;
            // Try metadata first (fastest)
            if (paymentIntent.metadata?.checkout_session_id) {
                checkoutSessionId = paymentIntent.metadata.checkout_session_id;
            }
            else if (paymentIntent.latest_charge) {
                // Get the latest charge to check its metadata
                const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
                if (charge?.metadata?.checkout_session_id) {
                    checkoutSessionId = charge.metadata.checkout_session_id;
                }
            }
            // CRITICAL: If metadata lookup fails OR latest_charge is null (early failures like authentication_cancelled),
            // use Stripe API to find the checkout session by payment intent ID
            if (!checkoutSessionId) {
                const sessions = await stripe.checkout.sessions.list({
                    limit: 100,
                    payment_intent: paymentIntent.id,
                });
                if (sessions.data.length > 0) {
                    checkoutSessionId = sessions.data[0].id;
                }
            }
            if (!checkoutSessionId) {
                console.error(`⚠️ Could not find checkout session for failed payment intent: ${paymentIntent.id}`);
                return;
            }
            // Get payment link using checkout session ID (which is always populated)
            const { data: paymentLink } = await supabase_1.supabase
                .from('payment_links')
                .select('booking_id')
                .eq('stripe_checkout_session_id', checkoutSessionId)
                .single();
            // Update payment link status
            await supabase_1.supabase
                .from('payment_links')
                .update({
                payment_status: 'cancelled',
                stripe_payment_intent_id: paymentIntent.id, // Store it now for reference
            })
                .eq('stripe_checkout_session_id', checkoutSessionId);
            // CRITICAL: Cancel all pending bookings for this payment link to free up availability
            if (paymentLink?.booking_id) {
                // Find all bookings in pending status for this contact and service
                const { data: booking } = await supabase_1.supabase
                    .from('bookings')
                    .select('contact_id, service_id, session_group_id')
                    .eq('id', paymentLink.booking_id)
                    .single();
                if (booking) {
                    // Cancel the primary booking
                    await supabase_1.supabase
                        .from('bookings')
                        .update({ status: 'cancelled', cancellation_reason: 'Payment failed' })
                        .eq('id', paymentLink.booking_id)
                        .eq('status', 'pending');
                    // If part of multi-session group, cancel all pending bookings in the group
                    if (booking.session_group_id) {
                        await supabase_1.supabase
                            .from('bookings')
                            .update({ status: 'cancelled', cancellation_reason: 'Payment failed for session group' })
                            .eq('session_group_id', booking.session_group_id)
                            .eq('status', 'pending');
                    }
                    console.log(`✅ Payment failed: cancelled pending booking(s) for payment link ${paymentLink.booking_id}`);
                }
            }
            console.log(`Payment intent failed: ${paymentIntent.id}`);
            // BOT INTEGRATION: Notify customer of payment failure
            const { data: linkData } = await supabase_1.supabase
                .from('payment_links')
                .select('contact_id, amount_chf')
                .eq('stripe_checkout_session_id', checkoutSessionId)
                .single();
            if (linkData) {
                await this.sendPaymentConfirmationWhatsApp(linkData.contact_id, linkData.amount_chf, 'failure');
            }
        }
        catch (error) {
            console.error('Error handling payment intent failed:', error);
        }
    }
    /**
     * Get payment link by ID
     */
    async getPaymentLink(id) {
        try {
            const { data, error } = await supabase_1.supabase
                .from('payment_links')
                .select('*')
                .eq('id', id)
                .single();
            if (error)
                throw error;
            return data;
        }
        catch (error) {
            console.error('Error fetching payment link:', error);
            return null;
        }
    }
    /**
     * Get payment links for a booking
     */
    async getPaymentLinksByBooking(bookingId) {
        try {
            const { data, error } = await supabase_1.supabase
                .from('payment_links')
                .select('*')
                .eq('booking_id', bookingId)
                .order('created_at', { ascending: false });
            if (error)
                throw error;
            return data || [];
        }
        catch (error) {
            console.error('Error fetching payment links by booking:', error);
            return [];
        }
    }
    /**
     * Mark payment link as sent via WhatsApp
     */
    async markPaymentLinkSent(id, whatsappMessageId) {
        try {
            await supabase_1.supabase
                .from('payment_links')
                .update({
                sent_via_whatsapp: true,
                whatsapp_message_id: whatsappMessageId,
            })
                .eq('id', id);
            // Update booking
            const { data: paymentLink } = await supabase_1.supabase
                .from('payment_links')
                .select('booking_id')
                .eq('id', id)
                .single();
            if (paymentLink) {
                await supabase_1.supabase
                    .from('bookings')
                    .update({
                    payment_link_sent: true,
                    payment_link_sent_at: new Date().toISOString(),
                })
                    .eq('id', paymentLink.booking_id);
            }
        }
        catch (error) {
            console.error('Error marking payment link as sent:', error);
            throw error;
        }
    }
    /**
     * Cancel/expire a payment link
     */
    async cancelPaymentLink(id) {
        try {
            const { data: paymentLink } = await supabase_1.supabase
                .from('payment_links')
                .select('stripe_checkout_session_id')
                .eq('id', id)
                .single();
            if (!paymentLink) {
                throw new Error('Payment link not found');
            }
            // Expire the Stripe session
            const stripe = await this.getStripeClient();
            await stripe.checkout.sessions.expire(paymentLink.stripe_checkout_session_id);
            // Update database
            await supabase_1.supabase
                .from('payment_links')
                .update({
                payment_status: 'cancelled',
            })
                .eq('id', id);
        }
        catch (error) {
            console.error('Error cancelling payment link:', error);
            throw error;
        }
    }
    /**
     * Send payment confirmation/failure WhatsApp notification to customer
     */
    async sendPaymentConfirmationWhatsApp(contactId, amount, status, bookingId) {
        try {
            const { data: contact } = await supabase_1.supabase
                .from('contacts')
                .select('phone_number, name, language')
                .eq('id', contactId)
                .single();
            if (!contact?.phone_number) {
                console.warn('Cannot send payment notification: No phone number for contact');
                return;
            }
            const language = contact.language || 'de';
            let message;
            if (status === 'success') {
                const messages = {
                    de: `✅ *Zahlung erfolgreich*\n\nVielen Dank! Ihre Zahlung über CHF ${amount.toFixed(2)} wurde erfolgreich verarbeitet.\n\nIhr Termin ist nun bestätigt. Sie erhalten in Kürze eine Bestätigungs-E-Mail.`,
                    en: `✅ *Payment Successful*\n\nThank you! Your payment of CHF ${amount.toFixed(2)} has been processed successfully.\n\nYour appointment is now confirmed. You'll receive a confirmation email shortly.`,
                    fr: `✅ *Paiement réussi*\n\nMerci! Votre paiement de CHF ${amount.toFixed(2)} a été traité avec succès.\n\nVotre rendez-vous est maintenant confirmé. Vous recevrez un e-mail de confirmation sous peu.`,
                };
                message = messages[language] || messages.de;
            }
            else if (status === 'failure') {
                const messages = {
                    de: `❌ *Zahlung fehlgeschlagen*\n\nLeider ist Ihre Zahlung über CHF ${amount.toFixed(2)} fehlgeschlagen.\n\nBitte versuchen Sie es erneut oder wählen Sie eine andere Zahlungsmethode. Bei weiteren Fragen kontaktieren Sie uns gerne.`,
                    en: `❌ *Payment Failed*\n\nUnfortunately, your payment of CHF ${amount.toFixed(2)} failed.\n\nPlease try again or choose a different payment method. Feel free to contact us if you have any questions.`,
                    fr: `❌ *Paiement échoué*\n\nMalheureusement, votre paiement de CHF ${amount.toFixed(2)} a échoué.\n\nVeuillez réessayer ou choisir un autre mode de paiement. N'hésitez pas à nous contacter si vous avez des questions.`,
                };
                message = messages[language] || messages.de;
            }
            else { // expired
                const messages = {
                    de: `⏰ *Zahlungslink abgelaufen*\n\nIhr Zahlungslink über CHF ${amount.toFixed(2)} ist abgelaufen.\n\nWenn Sie den Termin noch buchen möchten, starten Sie bitte eine neue Buchung.`,
                    en: `⏰ *Payment Link Expired*\n\nYour payment link for CHF ${amount.toFixed(2)} has expired.\n\nIf you still want to book the appointment, please start a new booking.`,
                    fr: `⏰ *Lien de paiement expiré*\n\nVotre lien de paiement pour CHF ${amount.toFixed(2)} a expiré.\n\nSi vous souhaitez toujours réserver le rendez-vous, veuillez démarrer une nouvelle réservation.`,
                };
                message = messages[language] || messages.de;
            }
            // Send via WhatsApp
            try {
                const whatsappModule = await Promise.resolve().then(() => __importStar(require('../adapters/whatsapp')));
                const sock = whatsappModule.default;
                if (sock) {
                    const formattedPhone = contact.phone_number.includes('@') ? contact.phone_number : `${contact.phone_number}@s.whatsapp.net`;
                    await sock.sendMessage(formattedPhone, { text: message });
                    console.log(`✅ Payment ${status} notification sent to ${contact.name}`);
                }
            }
            catch (whatsappError) {
                console.error('❌ Failed to send payment notification via WhatsApp:', whatsappError);
            }
        }
        catch (error) {
            console.error('❌ Failed to send payment notification:', error);
            // Don't throw - notification failure shouldn't block payment processing
        }
    }
}
exports.default = new PaymentLinkService();
