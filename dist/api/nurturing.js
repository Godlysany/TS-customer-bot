"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const NurturingService_1 = __importDefault(require("../core/NurturingService"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/nurturing/settings', auth_1.authMiddleware, async (req, res) => {
    try {
        const settings = await NurturingService_1.default.getSettings();
        res.json(settings);
    }
    catch (error) {
        console.error('Error fetching nurturing settings:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/nurturing/settings/:key', auth_1.authMiddleware, async (req, res) => {
    try {
        const { key } = req.params;
        const value = await NurturingService_1.default.getSetting(key);
        res.json({ key, value });
    }
    catch (error) {
        console.error('Error fetching nurturing setting:', error);
        res.status(500).json({ error: error.message });
    }
});
router.put('/nurturing/settings/:key', auth_1.authMiddleware, async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;
        if (!value && value !== '') {
            return res.status(400).json({ error: 'Value is required' });
        }
        await NurturingService_1.default.updateSetting(key, value);
        res.json({ success: true, key, value });
    }
    catch (error) {
        console.error('Error updating nurturing setting:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/nurturing/stats', auth_1.authMiddleware, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;
        const stats = await NurturingService_1.default.getActivityStats(start, end);
        res.json(stats);
    }
    catch (error) {
        console.error('Error fetching nurturing stats:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/nurturing/contacts/:contactId/profile', auth_1.authMiddleware, async (req, res) => {
    try {
        const { contactId } = req.params;
        const profile = await NurturingService_1.default.getContactNurturingProfile(contactId);
        if (!profile) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        res.json(profile);
    }
    catch (error) {
        console.error('Error fetching contact nurturing profile:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/nurturing/contacts/:contactIdOrType/activities', auth_1.authMiddleware, async (req, res) => {
    try {
        const { contactIdOrType } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const activityType = req.query.type;
        // Check if this is a UUID (contactId) or an activity type string
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contactIdOrType);
        if (isUUID) {
            // Query by contactId
            const activities = await NurturingService_1.default.getContactActivities(contactIdOrType, limit, activityType);
            res.json(activities);
        }
        else {
            // Query by activity type (global query)
            const activities = await NurturingService_1.default.getActivitiesByType(contactIdOrType, limit);
            res.json(activities);
        }
    }
    catch (error) {
        console.error('Error fetching contact activities:', error);
        res.status(500).json({ error: error.message });
    }
});
router.put('/nurturing/contacts/:contactId/birthdate', auth_1.authMiddleware, async (req, res) => {
    try {
        const { contactId } = req.params;
        const { birthdate } = req.body;
        await NurturingService_1.default.updateContactBirthdate(contactId, birthdate);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating contact birthdate:', error);
        res.status(500).json({ error: error.message });
    }
});
router.put('/nurturing/contacts/:contactId/preferences', auth_1.authMiddleware, async (req, res) => {
    try {
        const { contactId } = req.params;
        const preferences = req.body;
        await NurturingService_1.default.updateContactNurturingPreferences(contactId, preferences);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating contact preferences:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/nurturing/birthday-contacts', auth_1.authMiddleware, async (req, res) => {
    try {
        const contacts = await NurturingService_1.default.getBirthdayContactsToday();
        res.json(contacts);
    }
    catch (error) {
        console.error('Error fetching birthday contacts:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/nurturing/review-eligible-contacts', auth_1.authMiddleware, async (req, res) => {
    try {
        const contacts = await NurturingService_1.default.getReviewEligibleContacts();
        res.json(contacts);
    }
    catch (error) {
        console.error('Error fetching review-eligible contacts:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
