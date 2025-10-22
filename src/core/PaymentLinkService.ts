import Stripe from 'stripe';
import { supabase } from '../infrastructure/supabase';
import settingsService from './SettingsService';

export interface PaymentLinkRequest {
  booking_id: string;
  contact_id: string;
  amount_chf: number;
  original_amount_chf?: number;
  promotion_id?: string;
  discount_chf?: number;
  description: string;
  metadata?: Record<string, string>;
}

export interface PaymentLinkResult {
  payment_link_id: string;
  checkout_url: string;
  stripe_session_id: string;
  expires_at: string;
}

class PaymentLinkService {
  private stripe: Stripe | null = null;

  /**
   * Initialize Stripe client
   */
  private async getStripeClient(): Promise<Stripe> {
    if (this.stripe) return this.stripe;

    const apiKey = await settingsService.getSetting('stripe_api_key');
    if (!apiKey) {
      throw new Error('Stripe API key not configured');
    }

    this.stripe = new Stripe(apiKey, {
      apiVersion: '2024-12-18.acacia' as any, // Use latest version
    });

    return this.stripe;
  }

  /**
   * Create a payment link for a booking
   */
  async createPaymentLink(request: PaymentLinkRequest): Promise<PaymentLinkResult> {
    try {
      const stripe = await this.getStripeClient();

      // Get booking details for metadata
      const { data: booking } = await supabase
        .from('bookings')
        .select('title, start_time, service_id')
        .eq('id', request.booking_id)
        .single();

      // Get contact details
      const { data: contact } = await supabase
        .from('contacts')
        .select('name, email, phone_number')
        .eq('id', request.contact_id)
        .single();

      // Prepare metadata
      const metadata: Record<string, string> = {
        booking_id: request.booking_id,
        contact_id: request.contact_id,
        phone_number: contact?.phone_number || '',
        ...request.metadata,
      };

      if (request.promotion_id) {
        metadata.promotion_id = request.promotion_id;
        metadata.discount_chf = request.discount_chf?.toString() || '0';
      }

      // Get success/cancel URLs from environment or settings
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : await settingsService.getSetting('base_url') || 'http://localhost:8080';

      // Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'chf',
              product_data: {
                name: booking?.title || request.description,
                description: request.description,
              },
              unit_amount: Math.round(request.amount_chf * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
        customer_email: contact?.email || undefined,
        metadata,
        expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      });

      // Store payment link in database
      const expiresAt = new Date(session.expires_at * 1000).toISOString();

      const { data: paymentLink, error } = await supabase
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

      if (error) throw error;

      return {
        payment_link_id: paymentLink.id,
        checkout_url: session.url!,
        stripe_session_id: session.id,
        expires_at: expiresAt,
      };
    } catch (error: any) {
      console.error('Error creating payment link:', error);
      throw error;
    }
  }

  /**
   * Handle Stripe webhook for payment confirmation
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'checkout.session.expired':
          await this.handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
          break;

        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error: any) {
      console.error('Error handling webhook event:', error);
      throw error;
    }
  }

  /**
   * Handle checkout session completed
   */
  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    try {
      // Update payment link status
      const { data: paymentLink } = await supabase
        .from('payment_links')
        .select('booking_id, contact_id, amount_chf')
        .eq('stripe_checkout_session_id', session.id)
        .single();

      if (!paymentLink) {
        console.error('Payment link not found for session:', session.id);
        return;
      }

      await supabase
        .from('payment_links')
        .update({
          payment_status: 'paid',
          stripe_payment_intent_id: session.payment_intent as string,
          paid_at: new Date().toISOString(),
        })
        .eq('stripe_checkout_session_id', session.id);

      // Update booking status
      await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentLink.booking_id);

      // Create payment transaction record
      await supabase.from('payment_transactions').insert({
        contact_id: paymentLink.contact_id,
        booking_id: paymentLink.booking_id,
        amount_chf: paymentLink.amount_chf,
        currency: 'CHF',
        payment_method: 'card',
        status: 'succeeded',
        stripe_payment_intent_id: session.payment_intent as string,
        stripe_charge_id: session.payment_intent as string,
      });

      console.log(`Payment confirmed for booking: ${paymentLink.booking_id}`);
    } catch (error: any) {
      console.error('Error handling checkout session completed:', error);
      throw error;
    }
  }

  /**
   * Handle checkout session expired
   */
  private async handleCheckoutSessionExpired(session: Stripe.Checkout.Session): Promise<void> {
    try {
      // Get payment link to find associated booking(s)
      const { data: paymentLink } = await supabase
        .from('payment_links')
        .select('booking_id')
        .eq('stripe_checkout_session_id', session.id)
        .single();

      // Update payment link status
      await supabase
        .from('payment_links')
        .update({
          payment_status: 'expired',
        })
        .eq('stripe_checkout_session_id', session.id);

      // CRITICAL: Cancel all pending bookings for this payment link to free up availability
      if (paymentLink?.booking_id) {
        // Find all bookings in pending status for this contact and service
        // (covers multi-session bookings created together)
        const { data: booking } = await supabase
          .from('bookings')
          .select('contact_id, service_id, session_group_id')
          .eq('id', paymentLink.booking_id)
          .single();

        if (booking) {
          // Cancel the primary booking
          await supabase
            .from('bookings')
            .update({ status: 'cancelled', cancellation_reason: 'Payment link expired' })
            .eq('id', paymentLink.booking_id)
            .eq('status', 'pending');

          // If part of multi-session group, cancel all pending bookings in the group
          if (booking.session_group_id) {
            await supabase
              .from('bookings')
              .update({ status: 'cancelled', cancellation_reason: 'Payment link expired for session group' })
              .eq('session_group_id', booking.session_group_id)
              .eq('status', 'pending');
          }

          console.log(`✅ Payment expired: cancelled pending booking(s) for payment link ${paymentLink.booking_id}`);
        }
      }

      console.log(`Payment link expired for session: ${session.id}`);
    } catch (error: any) {
      console.error('Error handling checkout session expired:', error);
    }
  }

  /**
   * Handle payment intent succeeded
   */
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      // Find payment link by payment intent ID
      const { data: paymentLink } = await supabase
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
    } catch (error: any) {
      console.error('Error handling payment intent succeeded:', error);
    }
  }

  /**
   * Handle payment intent failed
   */
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      // Get payment link to find associated booking(s)
      const { data: paymentLink } = await supabase
        .from('payment_links')
        .select('booking_id')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .single();

      // Update payment link status
      await supabase
        .from('payment_links')
        .update({
          payment_status: 'cancelled',
        })
        .eq('stripe_payment_intent_id', paymentIntent.id);

      // CRITICAL: Cancel all pending bookings for this payment link to free up availability
      if (paymentLink?.booking_id) {
        // Find all bookings in pending status for this contact and service
        const { data: booking } = await supabase
          .from('bookings')
          .select('contact_id, service_id, session_group_id')
          .eq('id', paymentLink.booking_id)
          .single();

        if (booking) {
          // Cancel the primary booking
          await supabase
            .from('bookings')
            .update({ status: 'cancelled', cancellation_reason: 'Payment failed' })
            .eq('id', paymentLink.booking_id)
            .eq('status', 'pending');

          // If part of multi-session group, cancel all pending bookings in the group
          if (booking.session_group_id) {
            await supabase
              .from('bookings')
              .update({ status: 'cancelled', cancellation_reason: 'Payment failed for session group' })
              .eq('session_group_id', booking.session_group_id)
              .eq('status', 'pending');
          }

          console.log(`✅ Payment failed: cancelled pending booking(s) for payment link ${paymentLink.booking_id}`);
        }
      }

      console.log(`Payment intent failed: ${paymentIntent.id}`);
    } catch (error: any) {
      console.error('Error handling payment intent failed:', error);
    }
  }

  /**
   * Get payment link by ID
   */
  async getPaymentLink(id: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('payment_links')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching payment link:', error);
      return null;
    }
  }

  /**
   * Get payment links for a booking
   */
  async getPaymentLinksByBooking(bookingId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('payment_links')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching payment links by booking:', error);
      return [];
    }
  }

  /**
   * Mark payment link as sent via WhatsApp
   */
  async markPaymentLinkSent(id: string, whatsappMessageId: string): Promise<void> {
    try {
      await supabase
        .from('payment_links')
        .update({
          sent_via_whatsapp: true,
          whatsapp_message_id: whatsappMessageId,
        })
        .eq('id', id);

      // Update booking
      const { data: paymentLink } = await supabase
        .from('payment_links')
        .select('booking_id')
        .eq('id', id)
        .single();

      if (paymentLink) {
        await supabase
          .from('bookings')
          .update({
            payment_link_sent: true,
            payment_link_sent_at: new Date().toISOString(),
          })
          .eq('id', paymentLink.booking_id);
      }
    } catch (error: any) {
      console.error('Error marking payment link as sent:', error);
      throw error;
    }
  }

  /**
   * Cancel/expire a payment link
   */
  async cancelPaymentLink(id: string): Promise<void> {
    try {
      const { data: paymentLink } = await supabase
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
      await supabase
        .from('payment_links')
        .update({
          payment_status: 'cancelled',
        })
        .eq('id', id);
    } catch (error: any) {
      console.error('Error cancelling payment link:', error);
      throw error;
    }
  }
}

export default new PaymentLinkService();
