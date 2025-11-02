"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PromotionService_1 = __importDefault(require("../core/PromotionService"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Create promotion (Master only)
router.post('/promotions', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        const result = await PromotionService_1.default.createPromotion(req.body, req.agent.id);
        res.status(201).json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Update promotion (Master only)
router.put('/promotions/:id', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        await PromotionService_1.default.updatePromotion(req.params.id, req.body);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Get all promotions
router.get('/promotions', auth_1.authMiddleware, async (req, res) => {
    try {
        const filters = {
            isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
            serviceId: req.query.serviceId,
            promotionType: req.query.promotionType,
        };
        const promotions = await PromotionService_1.default.getAllPromotions(filters);
        res.json(promotions);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get active promotions
router.get('/promotions/active', auth_1.authMiddleware, async (req, res) => {
    try {
        const promotions = await PromotionService_1.default.getActivePromotions();
        res.json(promotions);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get promotion by code
router.get('/promotions/code/:code', auth_1.authMiddleware, async (req, res) => {
    try {
        const promotion = await PromotionService_1.default.getPromotionByCode(req.params.code);
        if (!promotion) {
            return res.status(404).json({ error: 'Promotion not found' });
        }
        res.json(promotion);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Validate promotion for booking
router.post('/promotions/validate', auth_1.authMiddleware, async (req, res) => {
    try {
        const result = await PromotionService_1.default.validatePromotion(req.body);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Apply promotion to booking
router.post('/promotions/apply', auth_1.authMiddleware, async (req, res) => {
    try {
        const { promotion_id, contact_id, service_id, original_price_chf, booking_id, offered_by } = req.body;
        const result = await PromotionService_1.default.applyPromotionToBooking({ promotion_id, contact_id, service_id, original_price_chf }, booking_id, offered_by || 'agent');
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Get promotion performance analytics
router.get('/promotions/performance', auth_1.authMiddleware, async (req, res) => {
    try {
        const promotionId = req.query.promotionId;
        const performance = await PromotionService_1.default.getPromotionPerformance(promotionId);
        res.json(performance);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get contact promotion history
router.get('/promotions/contact/:contactId/history', auth_1.authMiddleware, async (req, res) => {
    try {
        const history = await PromotionService_1.default.getContactPromotionHistory(req.params.contactId);
        res.json(history);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Deactivate promotion (Master only)
router.delete('/promotions/:id/deactivate', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        await PromotionService_1.default.deactivatePromotion(req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
