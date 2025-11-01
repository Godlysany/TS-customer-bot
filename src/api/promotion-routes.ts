import { Router } from 'express';
import promotionService from '../core/PromotionService';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Create promotion (Master only)
router.post('/promotions', authMiddleware, requireRole('master', 'operator', 'support'), async (req: AuthRequest, res) => {
  try {
    const result = await promotionService.createPromotion(req.body, req.agent!.id);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update promotion (Master only)
router.put('/promotions/:id', authMiddleware, requireRole('master', 'operator', 'support'), async (req: AuthRequest, res) => {
  try {
    await promotionService.updatePromotion(req.params.id, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get all promotions
router.get('/promotions', authMiddleware, async (req, res) => {
  try {
    const filters = {
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      serviceId: req.query.serviceId as string,
      promotionType: req.query.promotionType as string,
    };
    const promotions = await promotionService.getAllPromotions(filters);
    res.json(promotions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get active promotions
router.get('/promotions/active', authMiddleware, async (req, res) => {
  try {
    const promotions = await promotionService.getActivePromotions();
    res.json(promotions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get promotion by code
router.get('/promotions/code/:code', authMiddleware, async (req, res) => {
  try {
    const promotion = await promotionService.getPromotionByCode(req.params.code);
    if (!promotion) {
      return res.status(404).json({ error: 'Promotion not found' });
    }
    res.json(promotion);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Validate promotion for booking
router.post('/promotions/validate', authMiddleware, async (req, res) => {
  try {
    const result = await promotionService.validatePromotion(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Apply promotion to booking
router.post('/promotions/apply', authMiddleware, async (req, res) => {
  try {
    const { promotion_id, contact_id, service_id, original_price_chf, booking_id, offered_by } = req.body;
    
    const result = await promotionService.applyPromotionToBooking(
      { promotion_id, contact_id, service_id, original_price_chf },
      booking_id,
      offered_by || 'agent'
    );
    
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get promotion performance analytics
router.get('/promotions/performance', authMiddleware, async (req, res) => {
  try {
    const promotionId = req.query.promotionId as string;
    const performance = await promotionService.getPromotionPerformance(promotionId);
    res.json(performance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get contact promotion history
router.get('/promotions/contact/:contactId/history', authMiddleware, async (req, res) => {
  try {
    const history = await promotionService.getContactPromotionHistory(req.params.contactId);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Deactivate promotion (Master only)
router.delete('/promotions/:id/deactivate', authMiddleware, requireRole('master', 'operator', 'support'), async (req: AuthRequest, res) => {
  try {
    await promotionService.deactivatePromotion(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
