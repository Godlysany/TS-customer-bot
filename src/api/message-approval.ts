import { Router } from 'express';
import messageApprovalService from '../core/MessageApprovalService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// Get all pending approval messages
router.get('/pending', async (req, res) => {
  try {
    const messages = await messageApprovalService.getPendingMessages();
    res.json(messages);
  } catch (error: any) {
    console.error('Error fetching pending messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Approve a message and trigger WhatsApp send
router.post('/:id/approve', async (req, res) => {
  try {
    const agentId = (req as any).user.id;
    const messageId = req.params.id;

    // Atomic lock: mark as sending (prevents concurrent approvals)
    const locked = await messageApprovalService.markAsSending(messageId);
    if (!locked) {
      return res.status(409).json({ error: 'Message is not in pending_approval status or already being processed' });
    }

    // Get message for delivery
    const message = await messageApprovalService.getMessageById(messageId);
    if (!message) {
      await messageApprovalService.rollbackToPending(messageId);
      return res.status(404).json({ error: 'Message not found' });
    }

    // Idempotency check: if already delivered, just mark approved without re-sending
    if (message.whatsappMessageId) {
      console.log(`Message ${messageId} already delivered to WhatsApp (${message.whatsappMessageId}), marking as approved`);
      const approvedMessage = await messageApprovalService.approveMessage(messageId, agentId);
      return res.json(approvedMessage);
    }

    try {
      // Send to WhatsApp
      const { sendApprovedMessage } = await import('../adapters/whatsapp');
      const whatsappMsgId = await sendApprovedMessage(message);

      if (!whatsappMsgId) {
        throw new Error('Failed to send message to WhatsApp');
      }

      // Persist delivery immediately (idempotency marker)
      await messageApprovalService.markAsDelivered(messageId, whatsappMsgId);

      // Mark as approved - if this fails, retry will see whatsappMessageId and skip re-send
      try {
        const approvedMessage = await messageApprovalService.approveMessage(messageId, agentId);
        res.json(approvedMessage);
      } catch (approvalError: any) {
        // Delivery succeeded but approval update failed - log and return error
        // Message stays in 'sending' with whatsappMessageId set
        // Retry will detect whatsappMessageId and complete approval without re-sending
        console.error('WhatsApp delivery succeeded but approval update failed:', approvalError);
        res.status(500).json({ 
          error: 'Message delivered but approval update failed - retry to complete',
          delivered: true,
          whatsappMessageId: whatsappMsgId
        });
      }
    } catch (sendError: any) {
      // Rollback to pending on send failure for retry (no whatsappMessageId set)
      await messageApprovalService.rollbackToPending(messageId);
      throw sendError;
    }
  } catch (error: any) {
    console.error('Error approving message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reject a message
router.post('/:id/reject', async (req, res) => {
  try {
    const agentId = (req as any).user.id;
    const message = await messageApprovalService.rejectMessage(req.params.id, agentId);
    res.json(message);
  } catch (error: any) {
    console.error('Error rejecting message:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
