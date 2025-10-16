import { Router } from 'express';
import botDiscountService from '../core/BotDiscountService';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// All routes require Master role

// Get pending discount requests
router.get('/bot-discounts/pending', authMiddleware, requireRole('master'), async (req: AuthRequest, res) => {
  try {
    const requests = await botDiscountService.getPendingRequests();
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approve discount request
router.post('/bot-discounts/:id/approve', authMiddleware, requireRole('master'), async (req: AuthRequest, res) => {
  try {
    const { admin_notes } = req.body;
    const result = await botDiscountService.approveDiscountRequest(
      req.params.id,
      req.agent!.id,
      admin_notes
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Reject discount request
router.post('/bot-discounts/:id/reject', authMiddleware, requireRole('master'), async (req: AuthRequest, res) => {
  try {
    const { admin_notes } = req.body;
    if (!admin_notes) {
      return res.status(400).json({ error: 'Admin notes required for rejection' });
    }
    await botDiscountService.rejectDiscountRequest(
      req.params.id,
      req.agent!.id,
      admin_notes
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get request history
router.get('/bot-discounts/history', authMiddleware, requireRole('master'), async (req: AuthRequest, res) => {
  try {
    const filters = {
      status: req.query.status as string,
      contactId: req.query.contactId as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };
    const history = await botDiscountService.getRequestHistory(filters);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get discount analytics
router.get('/bot-discounts/analytics', authMiddleware, requireRole('master'), async (req: AuthRequest, res) => {
  try {
    const analytics = await botDiscountService.getDiscountAnalytics();
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Evaluate discount eligibility (for testing)
router.post('/bot-discounts/evaluate', authMiddleware, async (req, res) => {
  try {
    const { contact_id, conversation_id } = req.body;
    const decision = await botDiscountService.evaluateDiscountEligibility(contact_id, conversation_id);
    res.json(decision);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create discount request (internal use by bot)
router.post('/bot-discounts/create', authMiddleware, async (req, res) => {
  try {
    const result = await botDiscountService.createDiscountRequest(req.body);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
