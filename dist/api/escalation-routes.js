"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const EscalationService_1 = __importDefault(require("../core/EscalationService"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
/**
 * Get all escalations with optional filtering
 */
router.get('/escalations', auth_1.authMiddleware, async (req, res) => {
    try {
        const filters = {};
        if (req.query.status) {
            filters.status = req.query.status;
        }
        if (req.query.agent_id) {
            filters.agentId = req.query.agent_id;
        }
        const escalations = await EscalationService_1.default.getEscalations(filters);
        res.json(escalations);
    }
    catch (error) {
        console.error('Error fetching escalations:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Get escalation by ID
 */
router.get('/escalations/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const escalation = await EscalationService_1.default.getEscalationById(req.params.id);
        if (!escalation) {
            return res.status(404).json({ error: 'Escalation not found' });
        }
        res.json(escalation);
    }
    catch (error) {
        console.error('Error fetching escalation:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Create a new escalation
 */
router.post('/escalations', auth_1.authMiddleware, async (req, res) => {
    try {
        const { conversation_id, reason } = req.body;
        if (!conversation_id) {
            return res.status(400).json({ error: 'conversation_id is required' });
        }
        const escalation = await EscalationService_1.default.createEscalation(conversation_id, reason);
        res.status(201).json(escalation);
    }
    catch (error) {
        console.error('Error creating escalation:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Assign escalation to an agent
 */
router.post('/escalations/:id/assign', auth_1.authMiddleware, async (req, res) => {
    try {
        const { agent_id } = req.body;
        if (!agent_id) {
            return res.status(400).json({ error: 'agent_id is required' });
        }
        const escalation = await EscalationService_1.default.assignEscalation(req.params.id, agent_id);
        res.json(escalation);
    }
    catch (error) {
        console.error('Error assigning escalation:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Update escalation status
 */
router.put('/escalations/:id/status', auth_1.authMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        if (!status || !['pending', 'in_progress', 'resolved'].includes(status)) {
            return res.status(400).json({
                error: 'Invalid status. Must be one of: pending, in_progress, resolved'
            });
        }
        const escalation = await EscalationService_1.default.updateEscalationStatus(req.params.id, status);
        res.json(escalation);
    }
    catch (error) {
        console.error('Error updating escalation status:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Send admin reply directly from escalation
 */
router.post('/escalations/:id/reply', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        if (!content || content.trim() === '') {
            return res.status(400).json({ error: 'Message content is required' });
        }
        // Get escalation with conversation and contact details
        const escalation = await EscalationService_1.default.getEscalationById(id);
        if (!escalation) {
            return res.status(404).json({ error: 'Escalation not found' });
        }
        // Get conversation and contact details
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../infrastructure/supabase')));
        const { data: conversation } = await supabase
            .from('conversations')
            .select('id, contact_id, contact:contacts(phone_number)')
            .eq('id', escalation.conversationId)
            .single();
        if (!conversation || !conversation.contact) {
            return res.status(404).json({ error: 'Conversation or contact not found' });
        }
        const phoneNumber = conversation.contact.phone_number;
        const contactId = conversation.contact_id;
        console.log(`📤 Sending escalation reply to ${phoneNumber} from escalation ${id}`);
        // Send message via WhatsApp
        const { sendProactiveMessage } = await Promise.resolve().then(() => __importStar(require('../adapters/whatsapp')));
        await sendProactiveMessage(phoneNumber, content, contactId);
        console.log(`✅ Escalation reply sent via WhatsApp to ${phoneNumber}`);
        // Save message to database
        const messageService = (await Promise.resolve().then(() => __importStar(require('../core/MessageService')))).default;
        await messageService.createMessage({
            conversationId: escalation.conversationId,
            content,
            messageType: 'text',
            direction: 'outbound',
            sender: 'agent',
        });
        await messageService.updateConversationLastMessage(escalation.conversationId);
        res.json({ success: true, message: 'Reply sent successfully' });
    }
    catch (error) {
        console.error('Error sending escalation reply:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Resolve escalation
 */
router.post('/escalations/:id/resolve', auth_1.authMiddleware, async (req, res) => {
    try {
        const escalation = await EscalationService_1.default.resolveEscalation(req.params.id);
        res.json(escalation);
    }
    catch (error) {
        console.error('Error resolving escalation:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Get escalation counts
 */
router.get('/escalations-stats/counts', auth_1.authMiddleware, async (req, res) => {
    try {
        const counts = await EscalationService_1.default.getEscalationCounts();
        res.json(counts);
    }
    catch (error) {
        console.error('Error getting escalation counts:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
