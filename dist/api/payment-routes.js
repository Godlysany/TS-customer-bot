"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PaymentLinkService_1 = __importDefault(require("../core/PaymentLinkService"));
const auth_1 = require("../middleware/auth");
const stripe_1 = __importDefault(require("stripe"));
const SettingsService_1 = __importDefault(require("../core/SettingsService"));
const router = (0, express_1.Router)();
// Create payment link for booking
router.post('/payments/create-link', auth_1.authMiddleware, async (req, res) => {
    try {
        const result = await PaymentLinkService_1.default.createPaymentLink(req.body);
        res.status(201).json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Stripe webhook (public endpoint) - MUST use raw body for signature verification
// This route is registered BEFORE express.json() middleware in server.ts
router.post('/payments/webhook', async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        if (!sig) {
            console.error('❌ Webhook rejected: Missing stripe-signature header');
            return res.status(400).json({ error: 'Missing stripe-signature header' });
        }
        // Get Stripe API key
        const apiKey = await SettingsService_1.default.getSetting('stripe_api_key');
        if (!apiKey) {
            console.error('❌ Webhook rejected: Stripe API key not configured');
            return res.status(500).json({ error: 'Stripe not configured' });
        }
        // Get webhook secret - REQUIRED for production safety
        const webhookSecret = await SettingsService_1.default.getSetting('stripe_webhook_secret');
        if (!webhookSecret) {
            console.error('❌ CRITICAL: Stripe webhook secret not configured - REJECTING REQUEST');
            console.error('   Configure stripe_webhook_secret in Settings to enable payment webhooks');
            return res.status(500).json({
                error: 'Webhook secret not configured',
                message: 'Configure stripe_webhook_secret in Settings to process payment webhooks'
            });
        }
        const stripe = new stripe_1.default(apiKey, { apiVersion: '2024-12-18.acacia' });
        // Verify webhook signature - CRITICAL for balance sheet security
        let event;
        try {
            // req.body is a Buffer when using express.raw() middleware
            // Stripe requires the exact raw payload, not a serialized version
            const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
            event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
        }
        catch (err) {
            console.error('❌ Webhook signature verification failed:', err.message);
            console.error('   Payload type:', typeof req.body);
            console.error('   This could indicate a forged request or misconfigured webhook secret');
            return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
        }
        console.log(`✅ Webhook verified: ${event.type}`);
        // Handle the verified event
        await PaymentLinkService_1.default.handleWebhookEvent(event);
        res.json({ received: true });
    }
    catch (error) {
        console.error('❌ Webhook handler error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get payment link by ID
router.get('/payments/links/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const paymentLink = await PaymentLinkService_1.default.getPaymentLink(req.params.id);
        if (!paymentLink) {
            return res.status(404).json({ error: 'Payment link not found' });
        }
        res.json(paymentLink);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get payment links for booking
router.get('/payments/booking/:bookingId', auth_1.authMiddleware, async (req, res) => {
    try {
        const paymentLinks = await PaymentLinkService_1.default.getPaymentLinksByBooking(req.params.bookingId);
        res.json(paymentLinks);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Mark payment link as sent via WhatsApp
router.post('/payments/mark-sent/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const { whatsapp_message_id } = req.body;
        await PaymentLinkService_1.default.markPaymentLinkSent(req.params.id, whatsapp_message_id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Cancel payment link
router.delete('/payments/cancel/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        await PaymentLinkService_1.default.cancelPaymentLink(req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
