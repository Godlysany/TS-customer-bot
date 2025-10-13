"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
const stripe_1 = require("../infrastructure/stripe");
class PaymentService {
    async createPaymentIntent(amount, contactId, bookingId, serviceId, paymentType = 'booking', metadata) {
        const enabled = await (0, stripe_1.isStripeEnabled)();
        if (!enabled) {
            throw new Error('Payment processing is not enabled. Please configure Stripe in settings.');
        }
        const stripe = await (0, stripe_1.getStripeClient)();
        if (!stripe) {
            throw new Error('Stripe client not available');
        }
        const { data: contact } = await supabase_1.supabase
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
        const { data: transaction, error } = await supabase_1.supabase
            .from('payment_transactions')
            .insert((0, mapper_1.toSnakeCase)({
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
        if (error)
            throw error;
        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            transactionId: transaction.id,
        };
    }
    async confirmPayment(paymentIntentId) {
        const stripe = await (0, stripe_1.getStripeClient)();
        if (!stripe) {
            throw new Error('Stripe client not available');
        }
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
            expand: ['latest_charge'],
        });
        const status = this.mapStripeStatus(paymentIntent.status);
        const latestCharge = paymentIntent.latest_charge;
        const paymentMethod = latestCharge?.payment_method_details?.type;
        const { data: transaction, error } = await supabase_1.supabase
            .from('payment_transactions')
            .update((0, mapper_1.toSnakeCase)({
            status,
            paymentMethod,
            stripeChargeId: latestCharge?.id,
            paidAt: status === 'succeeded' ? new Date().toISOString() : null,
            failureReason: latestCharge?.failure_message || null,
        }))
            .eq('stripe_payment_intent_id', paymentIntentId)
            .select()
            .single();
        if (error)
            throw error;
        if (status === 'succeeded' && transaction.booking_id) {
            await supabase_1.supabase
                .from('bookings')
                .update({ payment_status: 'paid' })
                .eq('id', transaction.booking_id);
        }
        return (0, mapper_1.toCamelCase)(transaction);
    }
    async refundPayment(paymentIntentId, amount, reason) {
        const stripe = await (0, stripe_1.getStripeClient)();
        if (!stripe) {
            throw new Error('Stripe client not available');
        }
        const { data: transaction } = await supabase_1.supabase
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
            reason: reason || 'requested_by_customer',
        });
        const { data: updatedTransaction, error } = await supabase_1.supabase
            .from('payment_transactions')
            .update((0, mapper_1.toSnakeCase)({
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
        if (error)
            throw error;
        if (transaction.booking_id) {
            await supabase_1.supabase
                .from('bookings')
                .update({ payment_status: 'refunded' })
                .eq('id', transaction.booking_id);
        }
        return (0, mapper_1.toCamelCase)(updatedTransaction);
    }
    async getTransactionsByContact(contactId) {
        const { data, error } = await supabase_1.supabase
            .from('payment_transactions')
            .select('*')
            .eq('contact_id', contactId)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data ? data.map(d => (0, mapper_1.toCamelCase)(d)) : [];
    }
    async getTransactionsByBooking(bookingId) {
        const { data, error } = await supabase_1.supabase
            .from('payment_transactions')
            .select('*')
            .eq('booking_id', bookingId)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data ? data.map(d => (0, mapper_1.toCamelCase)(d)) : [];
    }
    async getTransactionById(transactionId) {
        const { data, error } = await supabase_1.supabase
            .from('payment_transactions')
            .select('*')
            .eq('id', transactionId)
            .single();
        if (error)
            return null;
        return data ? (0, mapper_1.toCamelCase)(data) : null;
    }
    async handleCancellationRefund(bookingId) {
        const transactions = await this.getTransactionsByBooking(bookingId);
        const paidTransaction = transactions.find(t => t.status === 'succeeded');
        if (!paidTransaction || !paidTransaction.stripePaymentIntentId) {
            return null;
        }
        return await this.refundPayment(paidTransaction.stripePaymentIntentId, undefined, 'Booking cancelled');
    }
    mapStripeStatus(stripeStatus) {
        const statusMap = {
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
exports.PaymentService = PaymentService;
exports.default = new PaymentService();
