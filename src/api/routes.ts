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

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'WhatsApp CRM Bot' });
});

router.get('/api/conversations', async (req, res) => {
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

router.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const messages = await messageService.getConversationMessages(req.params.id);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/conversations/:id/messages', async (req, res) => {
  try {
    const { content } = req.body;
    const message = await messageService.createMessage({
      conversationId: req.params.id,
      content,
      messageType: 'text',
      direction: 'outbound',
      sender: 'agent',
    });
    res.json(message);
  } catch (error: any) {
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
router.get('/api/settings', async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const settings = await settingsService.getAllSettings(category);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/settings/:key', async (req, res) => {
  try {
    const { value } = req.body;
    await settingsService.updateSetting(req.params.key, value);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/settings/bot/toggle', async (req, res) => {
  try {
    const { enabled } = req.body;
    await settingsService.setBotEnabled(enabled);
    res.json({ success: true, enabled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/settings/whatsapp/status', async (req, res) => {
  try {
    const connected = await settingsService.isWhatsAppConnected();
    res.json({ connected });
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

router.post('/api/marketing/campaigns', async (req, res) => {
  try {
    const { name, messageTemplate, filterCriteria, scheduledAt, createdBy } = req.body;
    const campaign = await marketingService.createCampaign(
      name,
      messageTemplate,
      filterCriteria,
      scheduledAt ? new Date(scheduledAt) : undefined,
      createdBy
    );
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/marketing/campaigns', async (req, res) => {
  try {
    const campaigns = await marketingService.getCampaigns();
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// WhatsApp QR code endpoint (will be implemented)
router.get('/api/whatsapp/qr', async (req, res) => {
  try {
    // TODO: Implement QR code generation and streaming
    res.json({ message: 'QR code endpoint - to be implemented' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
