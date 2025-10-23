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
import { isValidUUID } from '../utils/uuid-validator';

// Import new feature routes
import promotionRoutes from './promotion-routes';
import contactRoutes from './contact-routes';
import paymentRoutes from './payment-routes';
import botDiscountRoutes from './bot-discount-routes';
import calendarRoutes from './calendar-routes';
import botConfigRoutes from './bot-config';
import escalationRoutes from './escalation-routes';
import servicesRoutes from './services';
import customersRoutes from './customers';
import messageApprovalRoutes from './message-approval';
import questionnaireResponsesRoutes from './questionnaire-responses';

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
    const { id } = req.params;
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format' });
    }
    
    const messages = await messageService.getConversationMessages(id);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format' });
    }
    
    const { data: conversation } = await supabase
      .from('conversations')
      .select('contact_id, contact:contacts(phone_number)')
      .eq('id', id)
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
    const { id } = req.params;
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format' });
    }
    
    await conversationService.updateConversationStatus(id, 'escalated');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/conversations/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format' });
    }
    
    await conversationService.updateConversationStatus(id, 'resolved');
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
    const { id } = req.params;
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid prompt ID format' });
    }
    
    await supabase.from('prompts').update({ is_active: false }).neq('id', id);
    
    const { data, error } = await supabase
      .from('prompts')
      .update({ is_active: true })
      .eq('id', id)
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

// Create new booking (with before_booking questionnaire trigger)
router.post('/api/bookings', authMiddleware, async (req, res) => {
  try {
    const { contactId, conversationId, event, serviceId, discountCode, discountAmount, promoVoucher, teamMemberId } = req.body;

    if (!contactId || !conversationId || !event) {
      return res.status(400).json({ error: 'Missing required fields: contactId, conversationId, event' });
    }

    // BEFORE_BOOKING TRIGGER: Check if questionnaire should be triggered
    const { QuestionnaireService } = await import('../core/QuestionnaireService');
    const questionnaireService = new QuestionnaireService();
    
    const beforeBookingQuestionnaires = await questionnaireService.getActiveQuestionnaires('before_booking');
    let questionnaireTriggered = false;
    
    if (beforeBookingQuestionnaires.length > 0) {
      // Check service-specific questionnaires first
      let targetQuestionnaire = beforeBookingQuestionnaires[0];
      
      if (serviceId) {
        const serviceQuestionnaires = await questionnaireService.getQuestionnairesForService(serviceId);
        if (serviceQuestionnaires.length > 0) {
          targetQuestionnaire = serviceQuestionnaires[0];
        }
      }

      // Check if contact already completed this questionnaire
      const alreadyCompleted = await questionnaireService.hasContactCompletedQuestionnaire(
        contactId,
        targetQuestionnaire.id
      );

      if (!alreadyCompleted) {
        questionnaireTriggered = true;
        // Return questionnaire to frontend - booking will be pending
        return res.json({
          questionnairePending: true,
          questionnaireId: targetQuestionnaire.id,
          questionnaire: targetQuestionnaire,
          message: 'Please complete the questionnaire before booking',
        });
      }
    }

    // Create the booking
    const booking = await bookingService.createBooking(contactId, conversationId, event, {
      serviceId,
      discountCode,
      discountAmount,
      promoVoucher,
    });

    // AFTER_BOOKING TRIGGER: Check if questionnaire should be triggered
    const afterBookingQuestionnaires = await questionnaireService.getActiveQuestionnaires('after_booking');
    
    if (afterBookingQuestionnaires.length > 0) {
      const targetQuestionnaire = afterBookingQuestionnaires[0];
      const alreadyCompleted = await questionnaireService.hasContactCompletedQuestionnaire(
        contactId,
        targetQuestionnaire.id
      );

      if (!alreadyCompleted) {
        // Trigger after-booking questionnaire (can be sent async)
        // Store it in response so frontend/WhatsApp can trigger it
        return res.json({
          booking,
          afterBookingQuestionnaire: targetQuestionnaire,
        });
      }
    }

    res.json({ booking });
  } catch (error: any) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/bookings/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid booking ID format' });
    }
    
    await bookingService.cancelBooking(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update booking status (with multi-session completion trigger)
router.patch('/api/bookings/:id/status', authMiddleware, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { status } = req.body;
    
    if (!isValidUUID(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID format' });
    }

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Valid status values
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    // Update booking status
    const { data: booking, error } = await supabase
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .select()
      .single();

    if (error) throw error;

    // If status is 'completed', trigger multi-session completion check
    if (status === 'completed') {
      const sessionCompletionTrigger = (await import('../core/SessionCompletionTrigger')).default;
      await sessionCompletionTrigger.onBookingCompleted(bookingId);
    }

    res.json({ success: true, booking });
  } catch (error: any) {
    console.error('Error updating booking status:', error);
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
    const { id } = req.params;
    const { agentId, type, notes } = req.body;
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format' });
    }
    
    await conversationTakeoverService.startTakeover(id, agentId, type, notes);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/conversations/:id/takeover/end', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format' });
    }
    
    await conversationTakeoverService.endTakeover(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/conversations/:id/takeover/status', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format' });
    }
    
    const takeover = await conversationTakeoverService.getActiveTakeover(id);
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
    const { name, messageTemplate, filterCriteria, promotionId, questionnaireId, promotionAfterCompletion, scheduledAt, status, createdBy } = req.body;
    const campaign = await marketingService.createCampaign(
      name,
      messageTemplate,
      filterCriteria,
      promotionId,
      questionnaireId,
      promotionAfterCompletion,
      scheduledAt,  // Pass as-is (string or Date), service handles it
      status,       // Pass status from frontend
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
    const { count: customerCount, error: customerError } = await customerQuery;
    if (customerError) {
      console.error('❌ Dashboard: Error counting customers:', customerError);
    }

    // Get conversation count
    let conversationQuery = supabase.from('conversations').select('id', { count: 'exact', head: true });
    if (startDate) {
      conversationQuery = conversationQuery.gte('created_at', new Date(startDate as string).toISOString());
    }
    if (endDate) {
      conversationQuery = conversationQuery.lte('created_at', new Date(endDate as string).toISOString());
    }
    const { count: conversationCount, error: conversationError } = await conversationQuery;
    if (conversationError) {
      console.error('❌ Dashboard: Error counting conversations:', conversationError);
    }

    // Get message activity count
    let messageQuery = supabase.from('messages').select('id', { count: 'exact', head: true });
    if (startDate) {
      messageQuery = messageQuery.gte('timestamp', new Date(startDate as string).toISOString());
    }
    if (endDate) {
      messageQuery = messageQuery.lte('timestamp', new Date(endDate as string).toISOString());
    }
    const { count: messageCount, error: messageError } = await messageQuery;
    if (messageError) {
      console.error('❌ Dashboard: Error counting messages:', messageError);
    }

    console.log('📊 Dashboard stats:', {
      customers: customerCount,
      conversations: conversationCount,
      messages: messageCount,
      bookings: bookingStats.total
    });

    res.json({
      ...bookingStats,
      totalCustomers: customerCount || 0,
      totalConversations: conversationCount || 0,
      totalMessages: messageCount || 0,
    });
  } catch (error: any) {
    console.error('❌ Dashboard stats error:', error);
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

router.put('/api/questionnaires/:id', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('questionnaires')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/api/questionnaires/:id', authMiddleware, requireRole('master'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('questionnaires')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    res.json({ success: true });
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
router.use('/api/bot-config', botConfigRoutes);
router.use('/api', escalationRoutes);
router.use('/api/services', servicesRoutes);
router.use('/api/customers', customersRoutes);
router.use('/api/message-approval', messageApprovalRoutes);
router.use('/api/questionnaire-responses', questionnaireResponsesRoutes);

export default router;
