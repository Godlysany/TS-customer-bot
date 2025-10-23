"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../infrastructure/supabase");
const auth_1 = require("../middleware/auth");
const mapper_1 = require("../infrastructure/mapper");
const ServiceAvailabilityService_1 = __importDefault(require("../core/ServiceAvailabilityService"));
const uuid_validator_1 = require("../utils/uuid-validator");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', async (req, res) => {
    try {
        const { data: services, error } = await supabase_1.supabase
            .from('services')
            .select('*')
            .order('name', { ascending: true });
        if (error)
            throw error;
        res.json(services?.map(mapper_1.toCamelCase) || []);
    }
    catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Validate UUID format
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid service ID format' });
        }
        const { data: service, error } = await supabase_1.supabase
            .from('services')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            throw error;
        res.json((0, mapper_1.toCamelCase)(service));
    }
    catch (error) {
        console.error('Error fetching service:', error);
        res.status(500).json({ error: 'Failed to fetch service' });
    }
});
router.post('/', (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const serviceData = (0, mapper_1.toSnakeCase)(req.body);
        const { data: service, error } = await supabase_1.supabase
            .from('services')
            .insert(serviceData)
            .select()
            .single();
        if (error)
            throw error;
        res.json((0, mapper_1.toCamelCase)(service));
    }
    catch (error) {
        console.error('Error creating service:', error);
        res.status(500).json({ error: 'Failed to create service' });
    }
});
router.put('/:id', (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const { id } = req.params;
        const serviceData = (0, mapper_1.toSnakeCase)(req.body);
        const { data: service, error } = await supabase_1.supabase
            .from('services')
            .update(serviceData)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        res.json((0, mapper_1.toCamelCase)(service));
    }
    catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({ error: 'Failed to update service' });
    }
});
router.delete('/:id', (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase_1.supabase
            .from('services')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({ error: 'Failed to delete service' });
    }
});
// ========================================
// SERVICE BOOKING WINDOWS ENDPOINTS
// ========================================
// Get all booking windows for a service
router.get('/:id/booking-windows', async (req, res) => {
    try {
        const { id } = req.params;
        const windows = await ServiceAvailabilityService_1.default.getBookingWindows(id);
        res.json(windows);
    }
    catch (error) {
        console.error('Error fetching booking windows:', error);
        res.status(500).json({ error: 'Failed to fetch booking windows' });
    }
});
// Create a booking window for a service
router.post('/:id/booking-windows', (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const { id } = req.params;
        const windowData = { ...req.body, serviceId: id };
        const window = await ServiceAvailabilityService_1.default.createBookingWindow(windowData);
        res.json(window);
    }
    catch (error) {
        console.error('Error creating booking window:', error);
        res.status(500).json({ error: 'Failed to create booking window' });
    }
});
// Bulk replace booking windows for a service
router.put('/:id/booking-windows', (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const { id } = req.params;
        const { windows } = req.body;
        const updated = await ServiceAvailabilityService_1.default.replaceBookingWindows(id, windows);
        res.json(updated);
    }
    catch (error) {
        console.error('Error replacing booking windows:', error);
        res.status(500).json({ error: 'Failed to replace booking windows' });
    }
});
// Update a specific booking window
router.patch('/booking-windows/:windowId', (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const { windowId } = req.params;
        const window = await ServiceAvailabilityService_1.default.updateBookingWindow(windowId, req.body);
        res.json(window);
    }
    catch (error) {
        console.error('Error updating booking window:', error);
        res.status(500).json({ error: 'Failed to update booking window' });
    }
});
// Delete a booking window
router.delete('/booking-windows/:windowId', (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const { windowId } = req.params;
        await ServiceAvailabilityService_1.default.deleteBookingWindow(windowId);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting booking window:', error);
        res.status(500).json({ error: 'Failed to delete booking window' });
    }
});
// ========================================
// SERVICE BLOCKERS ENDPOINTS
// ========================================
// Get all blockers for a service
router.get('/:id/blockers', async (req, res) => {
    try {
        const { id } = req.params;
        const blockers = await ServiceAvailabilityService_1.default.getServiceBlockers(id);
        res.json(blockers);
    }
    catch (error) {
        console.error('Error fetching service blockers:', error);
        res.status(500).json({ error: 'Failed to fetch service blockers' });
    }
});
// Create a blocker for a service
router.post('/:id/blockers', (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const { id } = req.params;
        const blockerData = { ...req.body, serviceId: id };
        const blocker = await ServiceAvailabilityService_1.default.createServiceBlocker(blockerData);
        res.json(blocker);
    }
    catch (error) {
        console.error('Error creating service blocker:', error);
        res.status(500).json({ error: 'Failed to create service blocker' });
    }
});
// Update a service blocker
router.patch('/blockers/:blockerId', (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const { blockerId } = req.params;
        const blocker = await ServiceAvailabilityService_1.default.updateServiceBlocker(blockerId, req.body);
        res.json(blocker);
    }
    catch (error) {
        console.error('Error updating service blocker:', error);
        res.status(500).json({ error: 'Failed to update service blocker' });
    }
});
// Delete a service blocker
router.delete('/blockers/:blockerId', (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const { blockerId } = req.params;
        await ServiceAvailabilityService_1.default.deleteServiceBlocker(blockerId);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting service blocker:', error);
        res.status(500).json({ error: 'Failed to delete service blocker' });
    }
});
// Validate a booking time for a service
router.post('/:id/validate-time', async (req, res) => {
    try {
        const { id } = req.params;
        const { dateTime } = req.body;
        const validation = await ServiceAvailabilityService_1.default.validateBookingTime(id, new Date(dateTime));
        res.json(validation);
    }
    catch (error) {
        console.error('Error validating booking time:', error);
        res.status(500).json({ error: 'Failed to validate booking time' });
    }
});
exports.default = router;
