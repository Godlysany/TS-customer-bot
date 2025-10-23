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
const express_1 = require("express");
const MessageApprovalService_1 = __importDefault(require("../core/MessageApprovalService"));
const auth_1 = require("../middleware/auth");
const uuid_validator_1 = require("../utils/uuid-validator");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// Get all pending approval messages
router.get('/pending', async (req, res) => {
    try {
        const messages = await MessageApprovalService_1.default.getPendingMessages();
        res.json(messages);
    }
    catch (error) {
        console.error('Error fetching pending messages:', error);
        res.status(500).json({ error: error.message });
    }
});
// Approve a message and trigger WhatsApp send
router.post('/:id/approve', async (req, res) => {
    try {
        const messageId = req.params.id;
        if (!(0, uuid_validator_1.isValidUUID)(messageId)) {
            return res.status(400).json({ error: 'Invalid message ID format' });
        }
        const agentId = req.user.id;
        // Get message to check current state
        let message = await MessageApprovalService_1.default.getMessageById(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }
        // If already approved or rejected, return error
        if (message.approvalStatus === 'approved') {
            return res.status(409).json({ error: 'Message already approved' });
        }
        if (message.approvalStatus === 'rejected') {
            return res.status(409).json({ error: 'Message already rejected' });
        }
        // Check for failed persistence state FIRST - block retry to prevent duplicate send
        // This must be checked BEFORE the idempotency check
        if (message.metadata?.requires_manual_recovery) {
            return res.status(423).json({
                error: 'Message was delivered but persistence failed - manual recovery required',
                messageId: messageId,
                whatsappMessageId: message.metadata.whatsapp_message_id_backup,
                instructions: 'Contact administrator to manually update database with WhatsApp message ID'
            });
        }
        // Idempotency check: if already delivered (has whatsapp_message_id OR metadata flag), just mark approved
        const deliveryConfirmed = message.whatsappMessageId || message.metadata?.whatsapp_delivery_confirmed;
        if (deliveryConfirmed) {
            console.log(`Message ${messageId} already delivered to WhatsApp, marking as approved`);
            const approvedMessage = await MessageApprovalService_1.default.approveMessage(messageId, agentId);
            return res.json(approvedMessage);
        }
        // Atomic lock: mark as sending (prevents concurrent approvals)
        // Only attempt if currently pending_approval
        if (message.approvalStatus === 'pending_approval') {
            const locked = await MessageApprovalService_1.default.markAsSending(messageId);
            if (!locked) {
                return res.status(409).json({ error: 'Message is being processed by another request' });
            }
        }
        else if (message.approvalStatus !== 'sending') {
            // If not pending or sending, something is wrong
            return res.status(409).json({ error: `Cannot approve message with status: ${message.approvalStatus}` });
        }
        // If already 'sending', continue (this is a retry)
        // Send to WhatsApp
        const { sendApprovedMessage } = await Promise.resolve().then(() => __importStar(require('../adapters/whatsapp')));
        let whatsappMsgId = null;
        try {
            whatsappMsgId = await sendApprovedMessage(message);
            if (!whatsappMsgId) {
                throw new Error('Failed to send message to WhatsApp');
            }
        }
        catch (sendError) {
            // WhatsApp send failed - rollback to pending for retry
            await MessageApprovalService_1.default.rollbackToPending(messageId);
            throw sendError;
        }
        // WhatsApp send succeeded - persist delivery marker
        // If this fails, DO NOT rollback (message already sent)
        // Mark with metadata to prevent duplicate sends on retry
        try {
            await MessageApprovalService_1.default.markAsDelivered(messageId, whatsappMsgId);
        }
        catch (persistError) {
            console.error('⚠️ CRITICAL: WhatsApp message delivered but failed to persist delivery marker:', persistError);
            console.error(`Message ID: ${messageId}, WhatsApp Message ID: ${whatsappMsgId}`);
            // Store delivery confirmation in metadata to prevent retry-induced duplicates
            await MessageApprovalService_1.default.markAsDeliveryFailed(messageId, whatsappMsgId);
            return res.status(500).json({
                error: 'Message delivered to WhatsApp but database update failed - manual recovery required',
                delivered: true,
                whatsappMessageId: whatsappMsgId,
                messageId: messageId,
                critical: true,
                instructions: 'Do not retry. Contact administrator for manual database update.'
            });
        }
        // Persist delivery succeeded - now mark as approved
        try {
            const approvedMessage = await MessageApprovalService_1.default.approveMessage(messageId, agentId);
            res.json(approvedMessage);
        }
        catch (approvalError) {
            // Delivery marker persisted but approval update failed
            // Message stays in 'sending' with whatsappMessageId set
            // Retry will detect whatsappMessageId and complete approval without re-sending
            console.error('WhatsApp delivery succeeded but approval update failed:', approvalError);
            res.status(500).json({
                error: 'Message delivered but approval update failed - retry to complete',
                delivered: true,
                whatsappMessageId: whatsappMsgId
            });
        }
    }
    catch (error) {
        console.error('Error approving message:', error);
        res.status(500).json({ error: error.message });
    }
});
// Reject a message
router.post('/:id/reject', async (req, res) => {
    try {
        const messageId = req.params.id;
        if (!(0, uuid_validator_1.isValidUUID)(messageId)) {
            return res.status(400).json({ error: 'Invalid message ID format' });
        }
        const agentId = req.user.id;
        const message = await MessageApprovalService_1.default.rejectMessage(messageId, agentId);
        res.json(message);
    }
    catch (error) {
        console.error('Error rejecting message:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
