"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const BusinessHoursService_1 = __importDefault(require("../core/BusinessHoursService"));
const router = (0, express_1.Router)();
/**
 * Get all business opening hours (entire week schedule)
 */
router.get('/business/opening-hours', auth_1.authMiddleware, async (req, res) => {
    try {
        const hours = await BusinessHoursService_1.default.getAll();
        res.json(hours);
    }
    catch (error) {
        console.error('Error fetching business hours:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Get business hours for a specific day
 */
router.get('/business/opening-hours/:dayOfWeek', auth_1.authMiddleware, async (req, res) => {
    try {
        const dayOfWeek = parseInt(req.params.dayOfWeek);
        if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
            return res.status(400).json({ error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)' });
        }
        const hours = await BusinessHoursService_1.default.getByDay(dayOfWeek);
        if (!hours) {
            return res.status(404).json({ error: 'Business hours not found for this day' });
        }
        res.json(hours);
    }
    catch (error) {
        console.error('Error fetching business hours:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Create or update business hours for a specific day (Master only)
 */
router.put('/business/opening-hours/:dayOfWeek', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const dayOfWeek = parseInt(req.params.dayOfWeek);
        if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
            return res.status(400).json({ error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)' });
        }
        const { isClosed, openTime, closeTime, breakStart, breakEnd, notes } = req.body;
        const hours = await BusinessHoursService_1.default.upsert({
            dayOfWeek,
            isClosed: isClosed ?? false,
            openTime,
            closeTime,
            breakStart,
            breakEnd,
            notes,
        });
        res.json(hours);
    }
    catch (error) {
        console.error('Error updating business hours:', error);
        res.status(400).json({ error: error.message });
    }
});
/**
 * Check if business is open at a specific date/time
 */
router.post('/business/opening-hours/check', auth_1.authMiddleware, async (req, res) => {
    try {
        const { dateTime } = req.body;
        if (!dateTime) {
            return res.status(400).json({ error: 'dateTime is required' });
        }
        const date = new Date(dateTime);
        if (isNaN(date.getTime())) {
            return res.status(400).json({ error: 'Invalid dateTime format' });
        }
        const isOpen = await BusinessHoursService_1.default.isOpen(date);
        res.json({ isOpen, dateTime: date.toISOString() });
    }
    catch (error) {
        console.error('Error checking business hours:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Get available time windows for a specific day (excluding breaks)
 */
router.get('/business/opening-hours/:dayOfWeek/windows', auth_1.authMiddleware, async (req, res) => {
    try {
        const dayOfWeek = parseInt(req.params.dayOfWeek);
        if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
            return res.status(400).json({ error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)' });
        }
        const windows = await BusinessHoursService_1.default.getAvailableWindows(dayOfWeek);
        res.json({ dayOfWeek, windows });
    }
    catch (error) {
        console.error('Error fetching available windows:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
