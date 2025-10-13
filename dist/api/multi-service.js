"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const MultiServiceBookingService_1 = require("../core/MultiServiceBookingService");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const multiServiceService = new MultiServiceBookingService_1.MultiServiceBookingService();
router.get('/recommendations/:contactId', auth_1.authMiddleware, async (req, res) => {
    try {
        const { serviceId } = req.query;
        const recommendations = await multiServiceService.getServiceRecommendations(req.params.contactId, serviceId);
        res.json({ recommendations });
    }
    catch (error) {
        console.error('Error fetching recommendations:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/calculate-schedule', auth_1.authMiddleware, async (req, res) => {
    try {
        const { serviceIds, startDate } = req.body;
        if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
            return res.status(400).json({ error: 'serviceIds array is required' });
        }
        if (!startDate) {
            return res.status(400).json({ error: 'startDate is required' });
        }
        const schedule = await multiServiceService.calculateMultiServiceSchedule(serviceIds, new Date(startDate));
        res.json({ schedule });
    }
    catch (error) {
        console.error('Error calculating schedule:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/popular-combinations', auth_1.authMiddleware, async (req, res) => {
    try {
        const { serviceIds } = req.query;
        if (!serviceIds || typeof serviceIds !== 'string') {
            return res.status(400).json({ error: 'serviceIds parameter required (comma-separated)' });
        }
        const serviceIdArray = serviceIds.split(',').filter(Boolean);
        const recommendations = await multiServiceService.getPopularCombinations(serviceIdArray);
        res.json({ recommendations });
    }
    catch (error) {
        console.error('Error fetching popular combinations:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
