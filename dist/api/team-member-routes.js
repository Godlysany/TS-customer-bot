"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const TeamMemberService_1 = __importDefault(require("../core/TeamMemberService"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
/**
 * Get all team members
 * Query params: active_only=true to filter only active members
 */
router.get('/team-members', auth_1.authMiddleware, async (req, res) => {
    try {
        const activeOnly = req.query.active_only === 'true';
        const teamMembers = await TeamMemberService_1.default.getAll(activeOnly);
        res.json(teamMembers);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * Get a single team member by ID
 */
router.get('/team-members/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const teamMember = await TeamMemberService_1.default.getById(req.params.id);
        if (!teamMember) {
            return res.status(404).json({ error: 'Team member not found' });
        }
        res.json(teamMember);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * Create a new team member
 */
router.post('/team-members', auth_1.authMiddleware, async (req, res) => {
    try {
        const teamMember = await TeamMemberService_1.default.create(req.body);
        res.status(201).json(teamMember);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
/**
 * Update a team member
 */
router.put('/team-members/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const teamMember = await TeamMemberService_1.default.update(req.params.id, req.body);
        res.json(teamMember);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
/**
 * Delete a team member (soft delete)
 */
router.delete('/team-members/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        await TeamMemberService_1.default.delete(req.params.id);
        res.status(204).send();
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
/**
 * Get team members available for a specific service
 */
router.get('/team-members/service/:serviceId/available', auth_1.authMiddleware, async (req, res) => {
    try {
        const teamMembers = await TeamMemberService_1.default.getAvailableForService(req.params.serviceId);
        res.json(teamMembers);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * Get team member's bookings for a date range
 */
router.get('/team-members/:id/bookings', auth_1.authMiddleware, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'start_date and end_date query params required' });
        }
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        const bookings = await TeamMemberService_1.default.getBookings(req.params.id, startDate, endDate);
        res.json(bookings);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * Check team member availability for a specific date/time
 */
router.post('/team-members/:id/check-availability', auth_1.authMiddleware, async (req, res) => {
    try {
        const { date_time } = req.body;
        if (!date_time) {
            return res.status(400).json({ error: 'date_time required in request body' });
        }
        const dateTime = new Date(date_time);
        const isAvailable = await TeamMemberService_1.default.isAvailable(req.params.id, dateTime);
        res.json({ available: isAvailable });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
