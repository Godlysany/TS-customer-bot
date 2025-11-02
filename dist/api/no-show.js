"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const NoShowService_1 = __importDefault(require("../core/NoShowService"));
const router = (0, express_1.Router)();
router.post('/mark/:bookingId', auth_1.authMiddleware, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { notes } = req.body;
        const result = await NoShowService_1.default.markAsNoShow(bookingId, notes);
        res.json({
            success: true,
            tracking: result.tracking,
            suspended: result.suspended,
        });
    }
    catch (error) {
        console.error('Error marking no-show:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/history/:contactId', auth_1.authMiddleware, async (req, res) => {
    try {
        const { contactId } = req.params;
        const history = await NoShowService_1.default.getNoShowHistory(contactId);
        res.json({ history });
    }
    catch (error) {
        console.error('Error fetching no-show history:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/status/:contactId', auth_1.authMiddleware, async (req, res) => {
    try {
        const { contactId } = req.params;
        const strikeCount = await NoShowService_1.default.getContactStrikeCount(contactId);
        const suspension = await NoShowService_1.default.isContactSuspended(contactId);
        res.json({
            strikeCount,
            ...suspension,
        });
    }
    catch (error) {
        console.error('Error fetching no-show status:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/lift-suspension/:contactId', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        const { contactId } = req.params;
        await NoShowService_1.default.liftSuspension(contactId);
        res.json({ success: true, message: 'Suspension lifted' });
    }
    catch (error) {
        console.error('Error lifting suspension:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/reset-strikes/:contactId', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        const { contactId } = req.params;
        await NoShowService_1.default.resetStrikes(contactId);
        res.json({ success: true, message: 'Strikes reset' });
    }
    catch (error) {
        console.error('Error resetting strikes:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
