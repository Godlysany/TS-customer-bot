"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const EngagementService_1 = require("../core/EngagementService");
const EngagementScheduler_1 = require("../core/EngagementScheduler");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const engagementService = new EngagementService_1.EngagementService();
router.get('/campaigns', auth_1.authMiddleware, async (req, res) => {
    try {
        const campaigns = await engagementService.getAllCampaigns();
        res.json({ campaigns });
    }
    catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/campaigns/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const campaign = await engagementService.getCampaignById(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        res.json({ campaign });
    }
    catch (error) {
        console.error('Error fetching campaign:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/campaigns', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        const campaign = await engagementService.createCampaign(req.body);
        if (!campaign) {
            return res.status(400).json({ error: 'Failed to create campaign' });
        }
        res.json({ campaign });
    }
    catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: error.message });
    }
});
router.put('/campaigns/:id', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        const campaign = await engagementService.updateCampaign(req.params.id, req.body);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found or update failed' });
        }
        res.json({ campaign });
    }
    catch (error) {
        console.error('Error updating campaign:', error);
        res.status(500).json({ error: error.message });
    }
});
router.delete('/campaigns/:id', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        const success = await engagementService.deleteCampaign(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Campaign not found or delete failed' });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/campaigns/:id/run', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        const campaign = await engagementService.getCampaignById(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        const targets = await engagementService.findTargetCustomers(campaign);
        res.json({
            success: true,
            targetCount: targets.length,
            message: 'Campaign will be processed by the scheduler'
        });
    }
    catch (error) {
        console.error('Error running campaign:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/scheduler/run-now', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        const scheduler = (0, EngagementScheduler_1.getEngagementScheduler)();
        scheduler.runOnce();
        res.json({ success: true, message: 'Engagement campaigns triggered' });
    }
    catch (error) {
        console.error('Error running engagement scheduler:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
