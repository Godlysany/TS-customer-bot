import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase } from '../infrastructure/mapper';
import { getStripeClient, isStripeEnabled } from '../infrastructure/stripe';
import Stripe from 'stripe';

export interface PaymentTransaction {
  id: string;
  bookingId?: string;
  contactId: string;
  serviceId?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'cancelled';
  paymentType: 'booking' | 'deposit' | 'penalty' | 'full_payment';
  paymentMethod?: string;
  failureReason?: string;
  refundAmount: number;
  metadata?: any;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export class PaymentService {
  async createPaymentIntent(
    amount: number,
    contactId: string,
    bookingId?: string,
    serviceId?: string,
    paymentType: 'booking' | 'deposit' | 'penalty' | 'full_payment' = 'booking',
    metadata?: any
  ): Promise<{ clientSecret: string; paymentIntentId: string; transactionId: string }> {
    const enabled = await isStripeEnabled();
    if (!enabled) {
      throw new Error('Payment processing is not enabled. Please configure Stripe in settings.');
    }

    const stripe = await getStripeClient();
    if (!stripe) {
      throw new Error('Stripe client not available');
    }

    const { data: contact } = await supabase
      .from('contacts')
      .select('email, name')
      .eq('id', contactId)
      .single();

    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      receipt_email: contact?.email || undefined,
      metadata: {
        contactId,
        bookingId: bookingId || '',
        serviceId: serviceId || '',
        paymentType,
        ...metadata,
      },
    });

    const { data: transaction, error } = await supabase
      .from('payment_transactions')
      .insert(toSnakeCase({
        bookingId,
        contactId,
        serviceId,
        stripePaymentIntentId: paymentIntent.id,
        amount,
        currency: 'usd',
        status: 'pending',
        paymentType,
        metadata,
      }))
      .select()
      .single();

    if (error) throw error;

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
      transactionId: transaction.id,
    };
  }

  async confirmPayment(paymentIntentId: string): Promise<PaymentTransaction> {
    const stripe = await getStripeClient();
    if (!stripe) {
      throw new Error('Stripe client not available');
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    });

    const status = this.mapStripeStatus(paymentIntent.status);
    const latestCharge = paymentIntent.latest_charge as Stripe.Charge | null;
    const paymentMethod = latestCharge?.payment_method_details?.type;

    const { data: transaction, error } = await supabase
      .from('payment_transactions')
      .update(toSnakeCase({
        status,
        paymentMethod,
        stripeChargeId: latestCharge?.id,
        paidAt: status === 'succeeded' ? new Date().toISOString() : null,
        failureReason: latestCharge?.failure_message || null,
      }))
      .eq('stripe_payment_intent_id', paymentIntentId)
      .select()
      .single();

    if (error) throw error;

    if (status === 'succeeded' && transaction.booking_id) {
      await supabase
        .from('bookings')
        .update({ payment_status: 'paid' })
        .eq('id', transaction.booking_id);
    }

    return toCamelCase(transaction) as PaymentTransaction;
  }

  async refundPayment(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<PaymentTransaction> {
    const stripe = await getStripeClient();
    if (!stripe) {
      throw new Error('Stripe client not available');
    }

    const { data: transaction } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const refundAmount = amount || transaction.amount;
    const refundAmountInCents = Math.round(refundAmount * 100);

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: refundAmountInCents,
      reason: reason as Stripe.RefundCreateParams.Reason || 'requested_by_customer',
    });

    const { data: updatedTransaction, error } = await supabase
      .from('payment_transactions')
      .update(toSnakeCase({
        status: 'refunded',
        refundAmount,
        metadata: {
          ...transaction.metadata,
          refundId: refund.id,
          refundReason: reason,
        },
      }))
      .eq('id', transaction.id)
      .select()
      .single();

    if (error) throw error;

    if (transaction.booking_id) {
      await supabase
        .from('bookings')
        .update({ payment_status: 'refunded' })
        .eq('id', transaction.booking_id);
    }

    return toCamelCase(updatedTransaction) as PaymentTransaction;
  }

  async getTransactionsByContact(contactId: string): Promise<PaymentTransaction[]> {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ? data.map(d => toCamelCase(d) as PaymentTransaction) : [];
  }

  async getTransactionsByBooking(bookingId: string): Promise<PaymentTransaction[]> {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ? data.map(d => toCamelCase(d) as PaymentTransaction) : [];
  }

  async getTransactionById(transactionId: string): Promise<PaymentTransaction | null> {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error) return null;
    return data ? toCamelCase(data) as PaymentTransaction : null;
  }

  async handleCancellationRefund(bookingId: string): Promise<PaymentTransaction | null> {
    const transactions = await this.getTransactionsByBooking(bookingId);
    const paidTransaction = transactions.find(t => t.status === 'succeeded');

    if (!paidTransaction || !paidTransaction.stripePaymentIntentId) {
      return null;
    }

    return await this.refundPayment(
      paidTransaction.stripePaymentIntentId,
      undefined,
      'Booking cancelled'
    );
  }

  private mapStripeStatus(stripeStatus: string): PaymentTransaction['status'] {
    const statusMap: Record<string, PaymentTransaction['status']> = {
      'requires_payment_method': 'pending',
      'requires_confirmation': 'pending',
      'requires_action': 'processing',
      'processing': 'processing',
      'requires_capture': 'processing',
      'canceled': 'cancelled',
      'succeeded': 'succeeded',
    };

    return statusMap[stripeStatus] || 'failed';
  }
}

export default new PaymentService();
