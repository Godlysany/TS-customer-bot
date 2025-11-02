"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const RecurringAppointmentService_1 = require("../core/RecurringAppointmentService");
const RecurringAppointmentScheduler_1 = require("../core/RecurringAppointmentScheduler");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const recurringService = new RecurringAppointmentService_1.RecurringAppointmentService();
router.get('/routines/:contactId', auth_1.authMiddleware, async (req, res) => {
    try {
        const routines = await recurringService.getRoutinesByContact(req.params.contactId);
        res.json({ routines });
    }
    catch (error) {
        console.error('Error fetching routines:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/routines', auth_1.authMiddleware, async (req, res) => {
    try {
        const routine = await recurringService.createRoutine(req.body);
        if (!routine) {
            return res.status(400).json({ error: 'Failed to create routine' });
        }
        res.json({ routine });
    }
    catch (error) {
        console.error('Error creating routine:', error);
        res.status(500).json({ error: error.message });
    }
});
router.put('/routines/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const routine = await recurringService.updateRoutine(req.params.id, req.body);
        if (!routine) {
            return res.status(404).json({ error: 'Routine not found or update failed' });
        }
        res.json({ routine });
    }
    catch (error) {
        console.error('Error updating routine:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/appointments', auth_1.authMiddleware, async (req, res) => {
    try {
        const appointments = await recurringService.getActiveRecurringAppointments();
        res.json({ appointments });
    }
    catch (error) {
        console.error('Error fetching recurring appointments:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/appointments/:contactId', auth_1.authMiddleware, async (req, res) => {
    try {
        const appointments = await recurringService.getRecurringByContact(req.params.contactId);
        res.json({ appointments });
    }
    catch (error) {
        console.error('Error fetching contact recurring appointments:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/appointments', auth_1.authMiddleware, async (req, res) => {
    try {
        const appointment = await recurringService.createRecurringAppointment(req.body);
        if (!appointment) {
            return res.status(400).json({ error: 'Failed to create recurring appointment' });
        }
        res.json({ appointment });
    }
    catch (error) {
        console.error('Error creating recurring appointment:', error);
        res.status(500).json({ error: error.message });
    }
});
router.put('/appointments/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const appointment = await recurringService.updateRecurringAppointment(req.params.id, req.body);
        if (!appointment) {
            return res.status(404).json({ error: 'Recurring appointment not found or update failed' });
        }
        res.json({ appointment });
    }
    catch (error) {
        console.error('Error updating recurring appointment:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/appointments/:id/pause', auth_1.authMiddleware, async (req, res) => {
    try {
        const success = await recurringService.pauseRecurring(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Failed to pause recurring appointment' });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error pausing recurring appointment:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/appointments/:id/resume', auth_1.authMiddleware, async (req, res) => {
    try {
        const success = await recurringService.resumeRecurring(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Failed to resume recurring appointment' });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error resuming recurring appointment:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/appointments/:id/cancel', auth_1.authMiddleware, async (req, res) => {
    try {
        const success = await recurringService.cancelRecurring(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Failed to cancel recurring appointment' });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error cancelling recurring appointment:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/scheduler/run-now', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        const scheduler = (0, RecurringAppointmentScheduler_1.getRecurringScheduler)();
        scheduler.runOnce();
        res.json({ success: true, message: 'Recurring appointment processing triggered' });
    }
    catch (error) {
        console.error('Error running recurring scheduler:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
