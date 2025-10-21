import { Router } from 'express';
import messageService from '../core/MessageService';
import conversationService from '../core/ConversationService';
import aiService from '../core/AIService';
import bookingService from '../core/BookingService';
import settingsService from '../core/SettingsService';
import customerAnalyticsService from '../core/CustomerAnalyticsService';
import conversationTakeoverService from '../core/ConversationTakeoverService';
import marketingService from '../core/MarketingService';
import { supabase } from '../infrastructure/supabase';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';

// Import new feature routes
import promotionRoutes from './promotion-routes';
import contactRoutes from './contact-routes';
import paymentRoutes from './payment-routes';
import botDiscountRoutes from './bot-discount-routes';
import calendarRoutes from './calendar-routes';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'WhatsApp CRM Bot' });
});

router.get('/api/conversations', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        contact:contacts(*),
        messages(count)
      `)
      .order('last_message_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const messages = await messageService.getConversationMessages(req.params.id);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    
    const { data: conversation } = await supabase
      .from('conversations')
      .select('contact_id, contact:contacts(phone_number)')
      .eq('id', req.params.id)
      .single();
    
    if (!conversation || !conversation.contact) {
      return res.status(404).json({ error: 'Conversation or contact not found' });
    }
    
    const phoneNumber = (conversation.contact as any).phone_number;
    const contactId = conversation.contact_id;
    console.log(`📤 Sending outbound message to ${phoneNumber}`);
    
    const { sendProactiveMessage } = await import('../adapters/whatsapp');
    await sendProactiveMessage(phoneNumber, content, contactId);
    console.log(`✅ Message sent via WhatsApp to ${phoneNumber}`);
    
    const message = await messageService.createMessage({
      conversationId: req.params.id,
      content,
      messageType: 'text',
      direction: 'outbound',
      sender: 'agent',
    });
    
    await messageService.updateConversationLastMessage(req.params.id);
    
    res.json(message);
  } catch (error: any) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/conversations/:id/escalate', async (req, res) => {
  try {
    await conversationService.updateConversationStatus(req.params.id, 'escalated');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/conversations/:id/resolve', async (req, res) => {
  try {
    await conversationService.updateConversationStatus(req.params.id, 'resolved');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/prompts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/prompts', async (req, res) => {
  try {
    const { name, systemPrompt, businessContext, temperature, model } = req.body;
    const { data, error } = await supabase
      .from('prompts')
      .insert({
        name,
        system_prompt: systemPrompt,
        business_context: businessContext,
        temperature: temperature || 0.7,
        model: model || 'gpt-4o',
        is_active: false,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/prompts/:id/activate', async (req, res) => {
  try {
    await supabase.from('prompts').update({ is_active: false }).neq('id', req.params.id);
    
    const { data, error } = await supabase
      .from('prompts')
      .update({ is_active: true })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/bookings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        contact:contacts(*),
        conversation:conversations(*)
      `)
      .order('start_time', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/bookings/:id/cancel', async (req, res) => {
  try {
    await bookingService.cancelBooking(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Settings endpoints
router.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const settings = await settingsService.getAllSettings(category);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/settings/:key', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    const { value } = req.body;
    await settingsService.updateSetting(req.params.key, value);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/settings/bot/toggle', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    // Get current state and toggle it
    const currentState = await settingsService.getBotEnabled();
    const newState = !currentState;
    
    // CRITICAL: Prevent enabling bot if WhatsApp is not connected
    if (newState === true) {
      const { getSock } = await import('../adapters/whatsapp');
      const sock = getSock();
      const whatsappConnected = !!(sock && sock.user);
      
      if (!whatsappConnected) {
        return res.status(400).json({ 
          error: 'Cannot enable bot - WhatsApp is not connected. Please connect WhatsApp first.',
          whatsappConnected: false
        });
      }
    }
    
    await settingsService.setBotEnabled(newState);
    res.json({ success: true, enabled: newState });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/settings/whatsapp/status', async (req, res) => {
  try {
    // Check actual socket connection, not just database setting
    const { getSock } = await import('../adapters/whatsapp');
    const sock = getSock();
    const actuallyConnected = !!(sock && sock.user); // Coerce to boolean
    
    // Update database setting if it's stale
    const dbConnected = await settingsService.isWhatsAppConnected();
    if (dbConnected !== actuallyConnected) {
      await settingsService.setWhatsAppConnected(actuallyConnected);
    }
    
    res.json({ connected: actuallyConnected });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/settings/whatsapp/qr', authMiddleware, async (req, res) => {
  try {
    const { getQrCode } = await import('../adapters/whatsapp');
    const qrCode = getQrCode();
    res.json({ qrCode });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Customer analytics endpoints
router.get('/api/contacts/:id/analytics', async (req, res) => {
  try {
    const analytics = await customerAnalyticsService.getCustomerAnalytics(req.params.id);
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/contacts/:id/analytics/refresh', async (req, res) => {
  try {
    await customerAnalyticsService.updateCustomerAnalytics(req.params.id);
    const analytics = await customerAnalyticsService.getCustomerAnalytics(req.params.id);
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Conversation takeover endpoints
router.post('/api/conversations/:id/takeover', async (req, res) => {
  try {
    const { agentId, type, notes } = req.body;
    await conversationTakeoverService.startTakeover(req.params.id, agentId, type, notes);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/conversations/:id/takeover/end', async (req, res) => {
  try {
    await conversationTakeoverService.endTakeover(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/conversations/:id/takeover/status', async (req, res) => {
  try {
    const takeover = await conversationTakeoverService.getActiveTakeover(req.params.id);
    res.json({ takeover });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Marketing endpoints
router.post('/api/marketing/filter', async (req, res) => {
  try {
    const filters = req.body;
    const contacts = await marketingService.getFilteredContacts(filters);
    res.json({ contacts, count: contacts.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/marketing/campaigns', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    const { name, messageTemplate, filterCriteria, promotionId, questionnaireId, promotionAfterCompletion, scheduledAt, createdBy } = req.body;
    const campaign = await marketingService.createCampaign(
      name,
      messageTemplate,
      filterCriteria,
      promotionId,
      questionnaireId,
      promotionAfterCompletion,
      scheduledAt ? new Date(scheduledAt) : undefined,
      createdBy
    );
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/marketing/campaigns', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    const campaigns = await marketingService.getCampaigns();
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// WhatsApp connection control
router.post('/api/whatsapp/connect', authMiddleware, async (req, res) => {
  try {
    const { startSock } = await import('../adapters/whatsapp');
    await startSock();
    res.json({ success: true, message: 'WhatsApp connection initiated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/whatsapp/disconnect', authMiddleware, async (req, res) => {
  try {
    const { getSock } = await import('../adapters/whatsapp');
    const sock = getSock();
    if (sock) {
      await sock.end(undefined);
      await settingsService.setWhatsAppConnected(false);
      res.json({ success: true, message: 'WhatsApp disconnected' });
    } else {
      res.json({ success: true, message: 'WhatsApp not connected' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/whatsapp/reset', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const authPath = path.join(process.cwd(), 'auth_info');
    
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      console.log('🗑️  WhatsApp auth credentials cleared');
    }
    
    const whatsappModule = await import('../adapters/whatsapp');
    const sock = whatsappModule.default;
    if (sock) {
      await sock.end(undefined);
    }
    
    const { clearQrCode } = whatsappModule;
    clearQrCode();
    
    await settingsService.setWhatsAppConnected(false);
    res.json({ success: true, message: 'WhatsApp credentials reset. You can now connect again.' });
  } catch (error: any) {
    console.error('Error resetting WhatsApp:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/whatsapp/qr', async (req, res) => {
  try {
    res.json({ message: 'QR code endpoint - scan via terminal or use connect endpoint' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard Stats
router.get('/api/dashboard/stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Get booking stats
    const bookingStats = await bookingService.getBookingStats(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    // Get customer count
    let customerQuery = supabase.from('contacts').select('id', { count: 'exact', head: true });
    if (startDate) {
      customerQuery = customerQuery.gte('created_at', new Date(startDate as string).toISOString());
    }
    if (endDate) {
      customerQuery = customerQuery.lte('created_at', new Date(endDate as string).toISOString());
    }
    const { count: customerCount } = await customerQuery;

    // Get conversation count
    let conversationQuery = supabase.from('conversations').select('id', { count: 'exact', head: true });
    if (startDate) {
      conversationQuery = conversationQuery.gte('created_at', new Date(startDate as string).toISOString());
    }
    if (endDate) {
      conversationQuery = conversationQuery.lte('created_at', new Date(endDate as string).toISOString());
    }
    const { count: conversationCount } = await conversationQuery;

    // Get message activity count
    let messageQuery = supabase.from('conversation_messages').select('id', { count: 'exact', head: true });
    if (startDate) {
      messageQuery = messageQuery.gte('created_at', new Date(startDate as string).toISOString());
    }
    if (endDate) {
      messageQuery = messageQuery.lte('created_at', new Date(endDate as string).toISOString());
    }
    const { count: messageCount } = await messageQuery;

    res.json({
      ...bookingStats,
      totalCustomers: customerCount || 0,
      totalConversations: conversationCount || 0,
      totalMessages: messageCount || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Waitlist Management
router.post('/api/waitlist', async (req, res) => {
  try {
    const { WaitlistService } = await import('../core/WaitlistService');
    const waitlistService = new WaitlistService();
    const entry = await waitlistService.addToWaitlist(req.body);
    res.json(entry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/waitlist', async (req, res) => {
  try {
    const { WaitlistService } = await import('../core/WaitlistService');
    const waitlistService = new WaitlistService();
    const entries = await waitlistService.getActiveWaitlist();
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/waitlist/:id/cancel', async (req, res) => {
  try {
    const { WaitlistService } = await import('../core/WaitlistService');
    const waitlistService = new WaitlistService();
    await waitlistService.cancelWaitlistEntry(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Questionnaires
router.post('/api/questionnaires', async (req, res) => {
  try {
    const { QuestionnaireService } = await import('../core/QuestionnaireService');
    const questionnaireService = new QuestionnaireService();
    const questionnaire = await questionnaireService.createQuestionnaire(req.body);
    res.json(questionnaire);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/questionnaires', async (req, res) => {
  try {
    const { QuestionnaireService } = await import('../core/QuestionnaireService');
    const questionnaireService = new QuestionnaireService();
    const questionnaires = await questionnaireService.getActiveQuestionnaires(req.query.triggerType as string);
    res.json(questionnaires);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/questionnaires/responses', async (req, res) => {
  try {
    const { QuestionnaireService } = await import('../core/QuestionnaireService');
    const questionnaireService = new QuestionnaireService();
    const response = await questionnaireService.saveResponse(req.body);
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/contacts/:id/questionnaires', async (req, res) => {
  try {
    const { QuestionnaireService } = await import('../core/QuestionnaireService');
    const questionnaireService = new QuestionnaireService();
    const responses = await questionnaireService.getContactResponses(req.params.id);
    res.json(responses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reviews
router.get('/api/reviews/stats', async (req, res) => {
  try {
    const { ReviewService } = await import('../core/ReviewService');
    const reviewService = new ReviewService();
    const { startDate, endDate } = req.query;
    const stats = await reviewService.getReviewStats(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/reviews/:bookingId/feedback', async (req, res) => {
  try {
    const { ReviewService } = await import('../core/ReviewService');
    const reviewService = new ReviewService();
    await reviewService.recordReviewFeedback({
      bookingId: req.params.bookingId,
      ...req.body,
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Penalty Policies
router.get('/api/policies/cancellation', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cancellation_policies')
      .select('*')
      .eq('is_active', true)
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/policies/cancellation/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cancellation_policies')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mount new feature routes
router.use('/api', promotionRoutes);
router.use('/api', contactRoutes);
router.use('/api', paymentRoutes);
router.use('/api', botDiscountRoutes);
router.use('/api/calendar', calendarRoutes);

export default router;
