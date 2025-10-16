"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const BotDiscountService_1 = __importDefault(require("../core/BotDiscountService"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All routes require Master role
// Get pending discount requests
router.get('/bot-discounts/pending', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const requests = await BotDiscountService_1.default.getPendingRequests();
        res.json(requests);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Approve discount request
router.post('/bot-discounts/:id/approve', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const { admin_notes } = req.body;
        const result = await BotDiscountService_1.default.approveDiscountRequest(req.params.id, req.agent.id, admin_notes);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Reject discount request
router.post('/bot-discounts/:id/reject', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const { admin_notes } = req.body;
        if (!admin_notes) {
            return res.status(400).json({ error: 'Admin notes required for rejection' });
        }
        await BotDiscountService_1.default.rejectDiscountRequest(req.params.id, req.agent.id, admin_notes);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Get request history
router.get('/bot-discounts/history', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            contactId: req.query.contactId,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        };
        const history = await BotDiscountService_1.default.getRequestHistory(filters);
        res.json(history);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get discount analytics
router.get('/bot-discounts/analytics', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const analytics = await BotDiscountService_1.default.getDiscountAnalytics();
        res.json(analytics);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Evaluate discount eligibility (for testing)
router.post('/bot-discounts/evaluate', auth_1.authMiddleware, async (req, res) => {
    try {
        const { contact_id, conversation_id } = req.body;
        const decision = await BotDiscountService_1.default.evaluateDiscountEligibility(contact_id, conversation_id);
        res.json(decision);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create discount request (internal use by bot)
router.post('/bot-discounts/create', auth_1.authMiddleware, async (req, res) => {
    try {
        const result = await BotDiscountService_1.default.createDiscountRequest(req.body);
        res.status(201).json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
