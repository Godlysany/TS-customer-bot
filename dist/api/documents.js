"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const DocumentService_1 = require("../core/DocumentService");
const auth_1 = __importDefault(require("./auth"));
const uuid_validator_1 = require("../utils/uuid-validator");
const router = express_1.default.Router();
const documentService = new DocumentService_1.DocumentService();
router.get('/service/:serviceId', auth_1.default, async (req, res) => {
    try {
        const { serviceId } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(serviceId)) {
            return res.status(400).json({ error: 'Invalid service ID format' });
        }
        const documents = await documentService.getDocumentsForService(serviceId);
        res.json({ documents });
    }
    catch (error) {
        console.error('Error fetching service documents:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/', auth_1.default, async (req, res) => {
    try {
        const document = await documentService.createDocument(req.body);
        res.json({ document });
    }
    catch (error) {
        console.error('Error creating document:', error);
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id', auth_1.default, async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid document ID format' });
        }
        const document = await documentService.updateDocument(id, req.body);
        res.json({ document });
    }
    catch (error) {
        console.error('Error updating document:', error);
        res.status(500).json({ error: error.message });
    }
});
router.delete('/:id', auth_1.default, async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid document ID format' });
        }
        await documentService.deleteDocument(id);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/deliver/:bookingId', auth_1.default, async (req, res) => {
    try {
        const { bookingId } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(bookingId)) {
            return res.status(400).json({ error: 'Invalid booking ID format' });
        }
        const { timing } = req.body;
        if (!['pre_booking', 'post_booking', 'pre_appointment', 'post_appointment'].includes(timing)) {
            return res.status(400).json({ error: 'Invalid timing parameter' });
        }
        const result = await documentService.deliverDocumentsForBooking(bookingId, timing);
        res.json(result);
    }
    catch (error) {
        console.error('Error delivering documents:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
