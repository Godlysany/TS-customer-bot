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
        const agentId = req.user.id;
        const messageId = req.params.id;
        // Atomic lock: mark as sending (prevents concurrent approvals)
        const locked = await MessageApprovalService_1.default.markAsSending(messageId);
        if (!locked) {
            return res.status(409).json({ error: 'Message is not in pending_approval status or already being processed' });
        }
        // Get message for delivery
        const message = await MessageApprovalService_1.default.getMessageById(messageId);
        if (!message) {
            await MessageApprovalService_1.default.rollbackToPending(messageId);
            return res.status(404).json({ error: 'Message not found' });
        }
        try {
            // Send to WhatsApp
            const { sendApprovedMessage } = await Promise.resolve().then(() => __importStar(require('../adapters/whatsapp')));
            const sent = await sendApprovedMessage(message);
            if (!sent) {
                throw new Error('Failed to send message to WhatsApp');
            }
            // Only mark as approved after successful WhatsApp delivery
            const approvedMessage = await MessageApprovalService_1.default.approveMessage(messageId, agentId);
            res.json(approvedMessage);
        }
        catch (sendError) {
            // Rollback to pending on send failure for retry
            await MessageApprovalService_1.default.rollbackToPending(messageId);
            throw sendError;
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
        const agentId = req.user.id;
        const message = await MessageApprovalService_1.default.rejectMessage(req.params.id, agentId);
        res.json(message);
    }
    catch (error) {
        console.error('Error rejecting message:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
