"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../infrastructure/supabase");
const auth_1 = require("../middleware/auth");
const mapper_1 = require("../infrastructure/mapper");
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
exports.default = router;
