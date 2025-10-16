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
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/conversations/:id/messages', auth_1.authMiddleware, async (req, res) => {
    try {
        const messages = await MessageService_1.default.getConversationMessages(req.params.id);
        res.json(messages);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/conversations/:id/messages', auth_1.authMiddleware, async (req, res) => {
    try {
        const { content } = req.body;
        const { data: conversation } = await supabase_1.supabase
            .from('conversations')
            .select('contact_id, contact:contacts(phone_number)')
            .eq('id', req.params.id)
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
        await ConversationService_1.default.updateConversationStatus(req.params.id, 'escalated');
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/conversations/:id/resolve', async (req, res) => {
    try {
        await ConversationService_1.default.updateConversationStatus(req.params.id, 'resolved');
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
        await supabase_1.supabase.from('prompts').update({ is_active: false }).neq('id', req.params.id);
        const { data, error } = await supabase_1.supabase
            .from('prompts')
            .update({ is_active: true })
            .eq('id', req.params.id)
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
router.post('/api/bookings/:id/cancel', async (req, res) => {
    try {
        await BookingService_1.default.cancelBooking(req.params.id);
        res.json({ success: true });
    }
    catch (error) {
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
router.put('/api/settings/:key', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const { value } = req.body;
        await SettingsService_1.default.updateSetting(req.params.key, value);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/settings/bot/toggle', async (req, res) => {
    try {
        const { enabled } = req.body;
        await SettingsService_1.default.setBotEnabled(enabled);
        res.json({ success: true, enabled });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/settings/whatsapp/status', async (req, res) => {
    try {
        // Check actual socket connection, not just database setting
        const whatsappModule = await Promise.resolve().then(() => __importStar(require('../adapters/whatsapp')));
        const sock = whatsappModule.default;
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
        const { agentId, type, notes } = req.body;
        await ConversationTakeoverService_1.default.startTakeover(req.params.id, agentId, type, notes);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/api/conversations/:id/takeover/end', async (req, res) => {
    try {
        await ConversationTakeoverService_1.default.endTakeover(req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/conversations/:id/takeover/status', async (req, res) => {
    try {
        const takeover = await ConversationTakeoverService_1.default.getActiveTakeover(req.params.id);
        res.json({ takeover });
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
router.post('/api/marketing/campaigns', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
    try {
        const { name, messageTemplate, filterCriteria, scheduledAt, createdBy } = req.body;
        const campaign = await MarketingService_1.default.createCampaign(name, messageTemplate, filterCriteria, scheduledAt ? new Date(scheduledAt) : undefined, createdBy);
        res.json(campaign);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/marketing/campaigns', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
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
        const whatsappModule = await Promise.resolve().then(() => __importStar(require('../adapters/whatsapp')));
        const sock = whatsappModule.default;
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
router.post('/api/whatsapp/reset', auth_1.authMiddleware, (0, auth_1.requireRole)('master'), async (req, res) => {
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
        const bookingStats = await BookingService_1.default.getBookingStats(startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
        res.json(bookingStats);
    }
    catch (error) {
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
        const { WaitlistService } = await Promise.resolve().then(() => __importStar(require('../core/WaitlistService')));
        const waitlistService = new WaitlistService();
        await waitlistService.cancelWaitlistEntry(req.params.id);
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
        const { QuestionnaireService } = await Promise.resolve().then(() => __importStar(require('../core/QuestionnaireService')));
        const questionnaireService = new QuestionnaireService();
        const responses = await questionnaireService.getContactResponses(req.params.id);
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
        const { ReviewService } = await Promise.resolve().then(() => __importStar(require('../core/ReviewService')));
        const reviewService = new ReviewService();
        await reviewService.recordReviewFeedback({
            bookingId: req.params.bookingId,
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
        const { data, error } = await supabase_1.supabase
            .from('cancellation_policies')
            .update(req.body)
            .eq('id', req.params.id)
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
exports.default = router;
