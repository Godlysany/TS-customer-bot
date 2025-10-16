"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ContactService_1 = __importDefault(require("../core/ContactService"));
const auth_1 = require("../middleware/auth");
const multer_1 = __importDefault(require("multer"));
const sync_1 = require("csv-parse/sync");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Create contact manually
router.post('/contacts', auth_1.authMiddleware, async (req, res) => {
    try {
        const result = await ContactService_1.default.createContact(req.body, req.agent.id);
        res.status(201).json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Update contact
router.put('/contacts/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        await ContactService_1.default.updateContact(req.params.id, req.body);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Get all contacts with filters
router.get('/contacts', auth_1.authMiddleware, async (req, res) => {
    try {
        const filters = {
            source: req.query.source,
            hasConversation: req.query.hasConversation === 'true' ? true : req.query.hasConversation === 'false' ? false : undefined,
            tags: req.query.tags ? req.query.tags.split(',') : undefined,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined,
            offset: req.query.offset ? parseInt(req.query.offset) : undefined,
        };
        const contacts = await ContactService_1.default.getAllContacts(filters);
        res.json(contacts);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get contact by ID
router.get('/contacts/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const contact = await ContactService_1.default.getContact(req.params.id);
        if (!contact) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        res.json(contact);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Search contacts
router.get('/contacts/search/:query', auth_1.authMiddleware, async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const contacts = await ContactService_1.default.searchContacts(req.params.query, limit);
        res.json(contacts);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get contact statistics
router.get('/contacts/stats/summary', auth_1.authMiddleware, async (req, res) => {
    try {
        const stats = await ContactService_1.default.getContactStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Bulk CSV upload (Master only)
router.post('/contacts/bulk-upload', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        // Parse CSV
        const fileContent = req.file.buffer.toString('utf-8');
        const records = (0, sync_1.parse)(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        // Import contacts
        const result = await ContactService_1.default.importContactsFromCSV(records, req.agent.id);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Get import batch history
router.get('/contacts/import-batches', auth_1.authMiddleware, async (req, res) => {
    try {
        const uploadedBy = req.query.uploadedBy;
        const batches = await ContactService_1.default.getImportBatches(uploadedBy);
        res.json(batches);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get contacts by batch
router.get('/contacts/batch/:batchId', auth_1.authMiddleware, async (req, res) => {
    try {
        const contacts = await ContactService_1.default.getContactsByBatch(req.params.batchId);
        res.json(contacts);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Delete contact
router.delete('/contacts/:id', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        await ContactService_1.default.deleteContact(req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
