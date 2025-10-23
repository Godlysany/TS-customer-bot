import express from 'express';
import escalationService from '../core/EscalationService';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = express.Router();

/**
 * Get all escalations with optional filtering
 */
router.get('/escalations', authMiddleware, async (req, res) => {
  try {
    const filters: any = {};

    if (req.query.status) {
      filters.status = req.query.status;
    }

    if (req.query.agent_id) {
      filters.agentId = req.query.agent_id as string;
    }

    const escalations = await escalationService.getEscalations(filters);
    res.json(escalations);
  } catch (error: any) {
    console.error('Error fetching escalations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get escalation by ID
 */
router.get('/escalations/:id', authMiddleware, async (req, res) => {
  try {
    const escalation = await escalationService.getEscalationById(req.params.id);
    
    if (!escalation) {
      return res.status(404).json({ error: 'Escalation not found' });
    }

    res.json(escalation);
  } catch (error: any) {
    console.error('Error fetching escalation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new escalation
 */
router.post('/escalations', authMiddleware, async (req, res) => {
  try {
    const { conversation_id, reason } = req.body;

    if (!conversation_id) {
      return res.status(400).json({ error: 'conversation_id is required' });
    }

    const escalation = await escalationService.createEscalation(conversation_id, reason);
    res.status(201).json(escalation);
  } catch (error: any) {
    console.error('Error creating escalation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Assign escalation to an agent
 */
router.post('/escalations/:id/assign', authMiddleware, async (req, res) => {
  try {
    const { agent_id } = req.body;

    if (!agent_id) {
      return res.status(400).json({ error: 'agent_id is required' });
    }

    const escalation = await escalationService.assignEscalation(req.params.id, agent_id);
    res.json(escalation);
  } catch (error: any) {
    console.error('Error assigning escalation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update escalation status
 */
router.put('/escalations/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !['pending', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be one of: pending, in_progress, resolved' 
      });
    }

    const escalation = await escalationService.updateEscalationStatus(req.params.id, status);
    res.json(escalation);
  } catch (error: any) {
    console.error('Error updating escalation status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send admin reply directly from escalation
 */
router.post('/escalations/:id/reply', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    // Get escalation with conversation and contact details
    const escalation = await escalationService.getEscalationById(id);
    
    if (!escalation) {
      return res.status(404).json({ error: 'Escalation not found' });
    }
    
    // Get conversation and contact details
    const { supabase } = await import('../infrastructure/supabase');
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, contact_id, contact:contacts(phone_number)')
      .eq('id', escalation.conversationId)
      .single();
    
    if (!conversation || !conversation.contact) {
      return res.status(404).json({ error: 'Conversation or contact not found' });
    }
    
    const phoneNumber = (conversation.contact as any).phone_number;
    const contactId = conversation.contact_id;
    
    console.log(`📤 Sending escalation reply to ${phoneNumber} from escalation ${id}`);
    
    // Send message via WhatsApp
    const { sendProactiveMessage } = await import('../adapters/whatsapp');
    await sendProactiveMessage(phoneNumber, content, contactId);
    console.log(`✅ Escalation reply sent via WhatsApp to ${phoneNumber}`);
    
    // Save message to database
    const messageService = (await import('../core/MessageService')).default;
    await messageService.createMessage({
      conversationId: escalation.conversationId,
      content,
      messageType: 'text',
      direction: 'outbound',
      sender: 'agent',
    });
    
    await messageService.updateConversationLastMessage(escalation.conversationId);
    
    res.json({ success: true, message: 'Reply sent successfully' });
  } catch (error: any) {
    console.error('Error sending escalation reply:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Resolve escalation
 */
router.post('/escalations/:id/resolve', authMiddleware, async (req, res) => {
  try {
    const escalation = await escalationService.resolveEscalation(req.params.id);
    res.json(escalation);
  } catch (error: any) {
    console.error('Error resolving escalation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get escalation counts
 */
router.get('/escalations-stats/counts', authMiddleware, async (req, res) => {
  try {
    const counts = await escalationService.getEscalationCounts();
    res.json(counts);
  } catch (error: any) {
    console.error('Error getting escalation counts:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
