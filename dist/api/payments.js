"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const PaymentService_1 = __importDefault(require("../core/PaymentService"));
const router = (0, express_1.Router)();
router.post('/create-intent', auth_1.authMiddleware, async (req, res) => {
    try {
        const { amount, contactId, bookingId, serviceId, paymentType, metadata } = req.body;
        if (!amount || !contactId) {
            return res.status(400).json({ error: 'Amount and contactId are required' });
        }
        const result = await PaymentService_1.default.createPaymentIntent(amount, contactId, bookingId, serviceId, paymentType, metadata);
        res.json(result);
    }
    catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/confirm/:paymentIntentId', auth_1.authMiddleware, async (req, res) => {
    try {
        const { paymentIntentId } = req.params;
        const transaction = await PaymentService_1.default.confirmPayment(paymentIntentId);
        res.json({ success: true, transaction });
    }
    catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/refund/:paymentIntentId', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        const { paymentIntentId } = req.params;
        const { amount, reason } = req.body;
        const transaction = await PaymentService_1.default.refundPayment(paymentIntentId, amount, reason);
        res.json({ success: true, transaction });
    }
    catch (error) {
        console.error('Error refunding payment:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/transactions/contact/:contactId', auth_1.authMiddleware, async (req, res) => {
    try {
        const { contactId } = req.params;
        const transactions = await PaymentService_1.default.getTransactionsByContact(contactId);
        res.json({ transactions });
    }
    catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/transactions/booking/:bookingId', auth_1.authMiddleware, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const transactions = await PaymentService_1.default.getTransactionsByBooking(bookingId);
        res.json({ transactions });
    }
    catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/transaction/:transactionId', auth_1.authMiddleware, async (req, res) => {
    try {
        const { transactionId } = req.params;
        const transaction = await PaymentService_1.default.getTransactionById(transactionId);
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        res.json({ transaction });
    }
    catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
