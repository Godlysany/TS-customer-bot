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
const MessageService_1 = __importDefault(require("../core/MessageService"));
const ConversationService_1 = __importDefault(require("../core/ConversationService"));
const BookingService_1 = __importDefault(require("../core/BookingService"));
const SettingsService_1 = __importDefault(require("../core/SettingsService"));
const CustomerAnalyticsService_1 = __importDefault(require("../core/CustomerAnalyticsService"));
const ConversationTakeoverService_1 = __importDefault(require("../core/ConversationTakeoverService"));
const MarketingService_1 = __importDefault(require("../core/MarketingService"));
const supabase_1 = require("../infrastructure/supabase");
const auth_1 = require("../middleware/auth");
const uuid_validator_1 = require("../utils/uuid-validator");
// Import new feature routes
const promotion_routes_1 = __importDefault(require("./promotion-routes"));
const contact_routes_1 = __importDefault(require("./contact-routes"));
const payment_routes_1 = __importDefault(require("./payment-routes"));
const bot_discount_routes_1 = __importDefault(require("./bot-discount-routes"));
const calendar_routes_1 = __importDefault(require("./calendar-routes"));
const bot_config_1 = __importDefault(require("./bot-config"));
const escalation_routes_1 = __importDefault(require("./escalation-routes"));
const services_1 = __importDefault(require("./services"));
const customers_1 = __importDefault(require("./customers"));
const message_approval_1 = __importDefault(require("./message-approval"));
const questionnaire_responses_1 = __importDefault(require("./questionnaire-responses"));
const router = (0, express_1.Router)();
router.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'WhatsApp CRM Bot' });
});
router.get('/api/conversations', auth_1.authMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('conversations')
            .select(`
        *,
        contact:contacts(*),
        messages(count)
      `)
            .order('last_message_at', { ascending: false });
        if (error)
            throw error;
        // Map to camelCase for frontend compatibility
        const { toCamelCaseArray } = await Promise.resolve().then(() => __importStar(require('../infrastructure/mapper')));
        res.json(toCamelCaseArray(data || []));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/conversations/:id/messages', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid conversation ID format' });
        }
        const messages = await MessageService_1.default.getConversationMessages(id);
        res.json(messages);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/conversations/:id/messages', auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid conversation ID format' });
        }
        const { data: conversation } = await supabase_1.supabase
            .from('conversations')
            .select('contact_id, contact:contacts(phone_number)')
            .eq('id', id)
            .single();
        if (!conversation || !conversation.contact) {
            return res.status(404).json({ error: 'Conversation or contact not found' });
        }
        const phoneNumber = conversation.contact.phone_number;
        const contactId = conversation.contact_id;
        console.log(`📤 Sending outbound message to ${phoneNumber}`);
        const { sendProactiveMessage } = await Promise.resolve().then(() => __importStar(require('../adapters/whatsapp')));
        await sendProactiveMessage(phoneNumber, content, contactId);
        console.log(`✅ Message sent via WhatsApp to ${phoneNumber}`);
        const message = await MessageService_1.default.createMessage({
            conversationId: req.params.id,
            content,
            messageType: 'text',
            direction: 'outbound',
            sender: 'agent',
        });
        await MessageService_1.default.updateConversationLastMessage(req.params.id);
        res.json(message);
    }
    catch (error) {
        console.error('❌ Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/conversations/:id/escalate', async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid conversation ID format' });
        }
        await ConversationService_1.default.updateConversationStatus(id, 'escalated');
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/conversations/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid conversation ID format' });
        }
        await ConversationService_1.default.updateConversationStatus(id, 'resolved');
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/prompts', async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('prompts')
            .select('*')
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/prompts', async (req, res) => {
    try {
        const { name, systemPrompt, businessContext, temperature, model } = req.body;
        const { data, error } = await supabase_1.supabase
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
        if (error)
            throw error;
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/api/prompts/:id/activate', async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid prompt ID format' });
        }
        await supabase_1.supabase.from('prompts').update({ is_active: false }).neq('id', id);
        const { data, error } = await supabase_1.supabase
            .from('prompts')
            .update({ is_active: true })
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/bookings', async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('bookings')
            .select(`
        *,
        contact:contacts(*),
        conversation:conversations(*)
      `)
            .order('start_time', { ascending: true });
        if (error)
            throw error;
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create new booking (with before_booking questionnaire trigger)
router.post('/api/bookings', auth_1.authMiddleware, async (req, res) => {
    try {
        const { contactId, conversationId, event, serviceId, discountCode, discountAmount, promoVoucher, teamMemberId } = req.body;
        if (!contactId || !conversationId || !event) {
            return res.status(400).json({ error: 'Missing required fields: contactId, conversationId, event' });
        }
        // BEFORE_BOOKING TRIGGER: Check if questionnaire should be triggered
        const { QuestionnaireService } = await Promise.resolve().then(() => __importStar(require('../core/QuestionnaireService')));
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
            const alreadyCompleted = await questionnaireService.hasContactCompletedQuestionnaire(contactId, targetQuestionnaire.id);
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
        const booking = await BookingService_1.default.createBooking(contactId, conversationId, event, {
            serviceId,
            discountCode,
            discountAmount,
            promoVoucher,
        });
        // AFTER_BOOKING TRIGGER: Check if questionnaire should be triggered
        const afterBookingQuestionnaires = await questionnaireService.getActiveQuestionnaires('after_booking');
        if (afterBookingQuestionnaires.length > 0) {
            const targetQuestionnaire = afterBookingQuestionnaires[0];
            const alreadyCompleted = await questionnaireService.hasContactCompletedQuestionnaire(contactId, targetQuestionnaire.id);
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
    }
    catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/bookings/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid booking ID format' });
        }
        await BookingService_1.default.cancelBooking(id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Update booking status (with multi-session completion trigger)
router.patch('/api/bookings/:id/status', auth_1.authMiddleware, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { status } = req.body;
        if (!(0, uuid_validator_1.isValidUUID)(bookingId)) {
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
        const { data: booking, error } = await supabase_1.supabase
            .from('bookings')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', bookingId)
            .select()
            .single();
        if (error)
            throw error;
        // If status is 'completed', trigger multi-session completion check and nurturing activities
        if (status === 'completed') {
            const sessionCompletionTrigger = (await Promise.resolve().then(() => __importStar(require('../core/SessionCompletionTrigger')))).default;
            await sessionCompletionTrigger.onBookingCompleted(bookingId);
            const nurturingService = (await Promise.resolve().then(() => __importStar(require('../core/NurturingService')))).default;
            try {
                await nurturingService.logActivity({
                    contactId: booking.contact_id,
                    activityType: 'post_appointment_followup',
                    status: 'pending',
                    metadata: {
                        bookingId,
                        serviceId: booking.service_id,
                        completedAt: new Date().toISOString(),
                    },
                });
                console.log('✅ Logged post-appointment nurturing activity for booking:', bookingId);
            }
            catch (err) {
                console.error('❌ Failed to log nurturing activity:', err);
            }
        }
        res.json({ success: true, booking });
    }
    catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ error: error.message });
    }
});
// Settings endpoints
router.get('/api/settings', auth_1.authMiddleware, async (req, res) => {
    try {
        const category = req.query.category;
        const settings = await SettingsService_1.default.getAllSettings(category);
        res.json(settings);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/api/settings/:key', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator'), async (req, res) => {
    try {
        const { value, category, description } = req.body;
        await SettingsService_1.default.updateSetting(req.params.key, value, category, description);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/settings/bot/toggle', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator'), async (req, res) => {
    try {
        // Get current state and toggle it
        const currentState = await SettingsService_1.default.getBotEnabled();
        const newState = !currentState;
        // CRITICAL: Prevent enabling bot if WhatsApp is not connected
        if (newState === true) {
            const { getSock } = await Promise.resolve().then(() => __importStar(require('../adapters/whatsapp')));
            const sock = getSock();
            const whatsappConnected = !!(sock && sock.user);
            if (!whatsappConnected) {
                return res.status(400).json({
                    error: 'Cannot enable bot - WhatsApp is not connected. Please connect WhatsApp first.',
                    whatsappConnected: false
                });
            }
        }
        await SettingsService_1.default.setBotEnabled(newState);
        res.json({ success: true, enabled: newState });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/settings/whatsapp/status', async (req, res) => {
    try {
        // Check actual socket connection, not just database setting
        const { getSock } = await Promise.resolve().then(() => __importStar(require('../adapters/whatsapp')));
        const sock = getSock();
        const actuallyConnected = !!(sock && sock.user); // Coerce to boolean
        // Update database setting if it's stale
        const dbConnected = await SettingsService_1.default.isWhatsAppConnected();
        if (dbConnected !== actuallyConnected) {
            await SettingsService_1.default.setWhatsAppConnected(actuallyConnected);
        }
        res.json({ connected: actuallyConnected });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/settings/whatsapp/qr', auth_1.authMiddleware, async (req, res) => {
    try {
        const { getQrCode } = await Promise.resolve().then(() => __importStar(require('../adapters/whatsapp')));
        const qrCode = getQrCode();
        res.json({ qrCode });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Customer analytics endpoints
router.get('/api/contacts/:id/analytics', async (req, res) => {
    try {
        const analytics = await CustomerAnalyticsService_1.default.getCustomerAnalytics(req.params.id);
        res.json(analytics);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/contacts/:id/analytics/refresh', async (req, res) => {
    try {
        await CustomerAnalyticsService_1.default.updateCustomerAnalytics(req.params.id);
        const analytics = await CustomerAnalyticsService_1.default.getCustomerAnalytics(req.params.id);
        res.json(analytics);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Conversation takeover endpoints
router.post('/api/conversations/:id/takeover', async (req, res) => {
    try {
        const { id } = req.params;
        const { agentId, type, notes } = req.body;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid conversation ID format' });
        }
        await ConversationTakeoverService_1.default.startTakeover(id, agentId, type, notes);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/conversations/:id/takeover/end', async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid conversation ID format' });
        }
        await ConversationTakeoverService_1.default.endTakeover(id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/conversations/:id/takeover/status', async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid conversation ID format' });
        }
        const takeover = await ConversationTakeoverService_1.default.getActiveTakeover(id);
        // Return takeover directly with isActive flag for easier frontend access
        res.json(takeover ? { ...takeover, isActive: takeover.isActive } : { isActive: false });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Marketing endpoints
router.post('/api/marketing/filter', async (req, res) => {
    try {
        const filters = req.body;
        const contacts = await MarketingService_1.default.getFilteredContacts(filters);
        res.json({ contacts, count: contacts.length });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/marketing/campaigns', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        const { name, messageTemplate, filterCriteria, promotionId, questionnaireId, promotionAfterCompletion, scheduledAt, status, createdBy } = req.body;
        const campaign = await MarketingService_1.default.createCampaign(name, messageTemplate, filterCriteria, promotionId, questionnaireId, promotionAfterCompletion, scheduledAt, // Pass as-is (string or Date), service handles it
        status, // Pass status from frontend
        createdBy);
        res.json(campaign);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/marketing/campaigns', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        const campaigns = await MarketingService_1.default.getCampaigns();
        res.json(campaigns);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// WhatsApp connection control
router.post('/api/whatsapp/connect', auth_1.authMiddleware, async (req, res) => {
    try {
        const { startSock } = await Promise.resolve().then(() => __importStar(require('../adapters/whatsapp')));
        await startSock();
        res.json({ success: true, message: 'WhatsApp connection initiated' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/whatsapp/disconnect', auth_1.authMiddleware, async (req, res) => {
    try {
        const { getSock } = await Promise.resolve().then(() => __importStar(require('../adapters/whatsapp')));
        const sock = getSock();
        if (sock) {
            await sock.end(undefined);
            await SettingsService_1.default.setWhatsAppConnected(false);
            res.json({ success: true, message: 'WhatsApp disconnected' });
        }
        else {
            res.json({ success: true, message: 'WhatsApp not connected' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/whatsapp/reset', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        const authPath = path.join(process.cwd(), 'auth_info');
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
            console.log('🗑️  WhatsApp auth credentials cleared');
        }
        const whatsappModule = await Promise.resolve().then(() => __importStar(require('../adapters/whatsapp')));
        const sock = whatsappModule.default;
        if (sock) {
            await sock.end(undefined);
        }
        const { clearQrCode } = whatsappModule;
        clearQrCode();
        await SettingsService_1.default.setWhatsAppConnected(false);
        res.json({ success: true, message: 'WhatsApp credentials reset. You can now connect again.' });
    }
    catch (error) {
        console.error('Error resetting WhatsApp:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/whatsapp/qr', async (req, res) => {
    try {
        res.json({ message: 'QR code endpoint - scan via terminal or use connect endpoint' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Dashboard Stats
router.get('/api/dashboard/stats', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        // Get booking stats
        const bookingStats = await BookingService_1.default.getBookingStats(startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
        // Get customer count - use last_message_at for "today's activity" (customers with recent activity)
        let customerCount = 0;
        let conversationCount = 0;
        // For dashboard stats, we want ACTIVE customers (those with recent conversations)
        // Use last_message_at from conversations to filter by activity date
        if (startDate || endDate) {
            let activeCustomersQuery = supabase_1.supabase
                .from('conversations')
                .select('contact_id');
            if (startDate) {
                activeCustomersQuery = activeCustomersQuery.gte('last_message_at', new Date(startDate).toISOString());
            }
            if (endDate) {
                activeCustomersQuery = activeCustomersQuery.lte('last_message_at', new Date(endDate).toISOString());
            }
            const { data: activeContacts, error: activeError } = await activeCustomersQuery;
            if (activeError) {
                console.error('❌ Dashboard: Error fetching active contacts:', activeError);
            }
            // Count unique contact IDs from conversations with activity in date range
            const uniqueContactIds = new Set(activeContacts?.map(c => c.contact_id) || []);
            customerCount = uniqueContactIds.size;
            // Get conversation count - use last_message_at for activity-based filtering
            let conversationQuery = supabase_1.supabase.from('conversations').select('id', { count: 'exact', head: true });
            if (startDate) {
                conversationQuery = conversationQuery.gte('last_message_at', new Date(startDate).toISOString());
            }
            if (endDate) {
                conversationQuery = conversationQuery.lte('last_message_at', new Date(endDate).toISOString());
            }
            const { count, error: conversationError } = await conversationQuery;
            conversationCount = count || 0;
            if (conversationError) {
                console.error('❌ Dashboard: Error counting conversations:', conversationError);
            }
        }
        else {
            // No date filter - return total counts
            const { count, error: customerError } = await supabase_1.supabase
                .from('contacts')
                .select('id', { count: 'exact', head: true });
            customerCount = count || 0;
            if (customerError) {
                console.error('❌ Dashboard: Error counting customers:', customerError);
            }
            // Get conversation count
            const { count: convCount, error: conversationError } = await supabase_1.supabase
                .from('conversations')
                .select('id', { count: 'exact', head: true });
            conversationCount = convCount || 0;
            if (conversationError) {
                console.error('❌ Dashboard: Error counting conversations:', conversationError);
            }
        }
        // Get message activity count
        let messageQuery = supabase_1.supabase.from('messages').select('id', { count: 'exact', head: true });
        if (startDate) {
            messageQuery = messageQuery.gte('timestamp', new Date(startDate).toISOString());
        }
        if (endDate) {
            messageQuery = messageQuery.lte('timestamp', new Date(endDate).toISOString());
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
    }
    catch (error) {
        console.error('❌ Dashboard stats error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Waitlist Management
router.post('/api/waitlist', async (req, res) => {
    try {
        const { WaitlistService } = await Promise.resolve().then(() => __importStar(require('../core/WaitlistService')));
        const waitlistService = new WaitlistService();
        const entry = await waitlistService.addToWaitlist(req.body);
        res.json(entry);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/waitlist', async (req, res) => {
    try {
        const { WaitlistService } = await Promise.resolve().then(() => __importStar(require('../core/WaitlistService')));
        const waitlistService = new WaitlistService();
        const entries = await waitlistService.getActiveWaitlist();
        res.json(entries);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/waitlist/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid waitlist ID format' });
        }
        const { WaitlistService } = await Promise.resolve().then(() => __importStar(require('../core/WaitlistService')));
        const waitlistService = new WaitlistService();
        await waitlistService.cancelWaitlistEntry(id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Questionnaires
router.post('/api/questionnaires', async (req, res) => {
    try {
        const { QuestionnaireService } = await Promise.resolve().then(() => __importStar(require('../core/QuestionnaireService')));
        const questionnaireService = new QuestionnaireService();
        const questionnaire = await questionnaireService.createQuestionnaire(req.body);
        res.json(questionnaire);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/questionnaires', async (req, res) => {
    try {
        const { QuestionnaireService } = await Promise.resolve().then(() => __importStar(require('../core/QuestionnaireService')));
        const questionnaireService = new QuestionnaireService();
        const questionnaires = await questionnaireService.getActiveQuestionnaires(req.query.triggerType);
        res.json(questionnaires);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/api/questionnaires/:id', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid questionnaire ID format' });
        }
        const updates = req.body;
        const { data, error } = await supabase_1.supabase
            .from('questionnaires')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/api/questionnaires/:id', auth_1.authMiddleware, (0, auth_1.requireRole)('master', 'operator', 'support'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid questionnaire ID format' });
        }
        const { error } = await supabase_1.supabase
            .from('questionnaires')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/questionnaires/responses', async (req, res) => {
    try {
        const { QuestionnaireService } = await Promise.resolve().then(() => __importStar(require('../core/QuestionnaireService')));
        const questionnaireService = new QuestionnaireService();
        const response = await questionnaireService.saveResponse(req.body);
        res.json(response);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/contacts/:id/questionnaires', async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid contact ID format' });
        }
        const { QuestionnaireService } = await Promise.resolve().then(() => __importStar(require('../core/QuestionnaireService')));
        const questionnaireService = new QuestionnaireService();
        const responses = await questionnaireService.getContactResponses(id);
        res.json(responses);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Reviews
router.get('/api/reviews/stats', async (req, res) => {
    try {
        const { ReviewService } = await Promise.resolve().then(() => __importStar(require('../core/ReviewService')));
        const reviewService = new ReviewService();
        const { startDate, endDate } = req.query;
        const stats = await reviewService.getReviewStats(startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/reviews/:bookingId/feedback', async (req, res) => {
    try {
        const { bookingId } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(bookingId)) {
            return res.status(400).json({ error: 'Invalid booking ID format' });
        }
        const { ReviewService } = await Promise.resolve().then(() => __importStar(require('../core/ReviewService')));
        const reviewService = new ReviewService();
        await reviewService.recordReviewFeedback({
            bookingId,
            ...req.body,
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Penalty Policies
router.get('/api/policies/cancellation', async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('cancellation_policies')
            .select('*')
            .eq('is_active', true)
            .single();
        if (error)
            throw error;
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/api/policies/cancellation/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!(0, uuid_validator_1.isValidUUID)(id)) {
            return res.status(400).json({ error: 'Invalid policy ID format' });
        }
        const { data, error } = await supabase_1.supabase
            .from('cancellation_policies')
            .update(req.body)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Mount new feature routes
router.use('/api', promotion_routes_1.default);
router.use('/api', contact_routes_1.default);
router.use('/api', payment_routes_1.default);
router.use('/api', bot_discount_routes_1.default);
router.use('/api/calendar', calendar_routes_1.default);
router.use('/api/bot-config', bot_config_1.default);
router.use('/api', escalation_routes_1.default);
router.use('/api/services', services_1.default);
router.use('/api/customers', customers_1.default);
router.use('/api/message-approval', message_approval_1.default);
router.use('/api/questionnaire-responses', questionnaire_responses_1.default);
exports.default = router;
