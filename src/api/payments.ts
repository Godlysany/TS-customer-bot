import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import PaymentService from '../core/PaymentService';

const router = Router();

router.post('/create-intent', authMiddleware, async (req, res) => {
  try {
    const { amount, contactId, bookingId, serviceId, paymentType, metadata } = req.body;

    if (!amount || !contactId) {
      return res.status(400).json({ error: 'Amount and contactId are required' });
    }

    const result = await PaymentService.createPaymentIntent(
      amount,
      contactId,
      bookingId,
      serviceId,
      paymentType,
      metadata
    );

    res.json(result);
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/confirm/:paymentIntentId', authMiddleware, async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const transaction = await PaymentService.confirmPayment(paymentIntentId);

    res.json({ success: true, transaction });
  } catch (error: any) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/refund/:paymentIntentId', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const { amount, reason } = req.body;

    const transaction = await PaymentService.refundPayment(paymentIntentId, amount, reason);

    res.json({ success: true, transaction });
  } catch (error: any) {
    console.error('Error refunding payment:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/transactions/contact/:contactId', authMiddleware, async (req, res) => {
  try {
    const { contactId } = req.params;
    const transactions = await PaymentService.getTransactionsByContact(contactId);

    res.json({ transactions });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/transactions/booking/:bookingId', authMiddleware, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const transactions = await PaymentService.getTransactionsByBooking(bookingId);

    res.json({ transactions });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/transaction/:transactionId', authMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = await PaymentService.getTransactionById(transactionId);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ transaction });
  } catch (error: any) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
