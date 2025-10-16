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
    const message = await messageApprovalService.approveMessage(req.params.id, agentId);

    // Trigger WhatsApp send
    const { sendApprovedMessage } = await import('../adapters/whatsapp');
    await sendApprovedMessage(message);

    res.json(message);
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
