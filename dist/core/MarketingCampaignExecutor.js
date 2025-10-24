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
exports.MarketingCampaignExecutor = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
const QuestionnaireService_1 = require("./QuestionnaireService");
const QuestionnaireRuntimeService_1 = __importDefault(require("./QuestionnaireRuntimeService"));
const whatsapp_1 = require("../adapters/whatsapp");
const logger_1 = require("../infrastructure/logger");
const crypto_1 = __importDefault(require("crypto"));
/**
 * Marketing Campaign Executor
 * Processes marketing_campaigns table and:
 * 1. Sends campaign messages to filtered contacts
 * 2. Triggers linked questionnaires
 * 3. Awards promotions upon questionnaire completion
 */
class MarketingCampaignExecutor {
    questionnaireService;
    // Track which campaigns triggered questionnaires (for promotion rewards)
    campaignQuestionnaireMap = new Map(); // questionnaireResponseId -> campaignId
    constructor() {
        this.questionnaireService = new QuestionnaireService_1.QuestionnaireService();
    }
    /**
     * H2: Process scheduled marketing campaigns with delivery tracking
     * Called by scheduler or manually triggered
     */
    async processCampaigns() {
        (0, logger_1.logInfo)('📧 Processing marketing campaigns...');
        // Get campaigns that are scheduled or ready to send
        const { data: campaigns, error } = await supabase_1.supabase
            .from('marketing_campaigns')
            .select('*')
            .in('status', ['scheduled', 'ready'])
            .lte('scheduled_at', new Date().toISOString());
        if (error) {
            (0, logger_1.logError)('Error fetching campaigns:', error);
            return { sent: 0, failed: 0, questionnairesTriggered: 0 };
        }
        let totalSent = 0;
        let totalFailed = 0;
        let totalQuestionnairesTriggered = 0;
        for (const campaignData of campaigns || []) {
            const campaign = (0, mapper_1.toCamelCase)(campaignData);
            // H2 FIX: Reset per-campaign counters
            let campaignSent = 0;
            let campaignFailed = 0;
            let campaignQuestionnaires = 0;
            try {
                (0, logger_1.logInfo)(`📋 Processing campaign: ${campaign.name} (ID: ${campaign.id})`);
                // H2: Check for existing delivery records or create new ones
                await this.ensureDeliveryRecords(campaign);
                // H2: Get pending deliveries for this campaign
                const { data: pendingDeliveries, error: deliveryError } = await supabase_1.supabase
                    .from('campaign_deliveries')
                    .select('*, contacts(name, phone_number, preferred_language)')
                    .eq('campaign_id', campaign.id)
                    .eq('delivery_status', 'pending')
                    .order('scheduled_at', { ascending: true });
                if (deliveryError) {
                    (0, logger_1.logError)(`Error fetching deliveries for campaign ${campaign.id}:`, deliveryError);
                    continue;
                }
                const deliveries = pendingDeliveries || [];
                (0, logger_1.logInfo)(`   Found ${deliveries.length} pending deliveries`);
                if (deliveries.length === 0) {
                    // Mark campaign as completed if no pending deliveries
                    await supabase_1.supabase
                        .from('marketing_campaigns')
                        .update({
                        status: 'completed',
                        sent_at: new Date().toISOString(),
                        actual_recipients: 0,
                    })
                        .eq('id', campaign.id);
                    continue;
                }
                // H2: Process each delivery with idempotency
                for (const delivery of deliveries) {
                    try {
                        const contact = delivery.contacts;
                        const phoneNumber = contact?.phone_number;
                        if (!phoneNumber) {
                            await this.markDeliveryFailed(delivery.id, 'No phone number');
                            totalFailed++;
                            continue;
                        }
                        // Use pre-personalized message or generate if missing
                        const message = delivery.message_content ||
                            await this.formatCampaignMessage(campaign.messageTemplate, (0, mapper_1.toCamelCase)(contact));
                        // H2: Send with idempotency key
                        const success = await (0, whatsapp_1.sendProactiveMessage)(phoneNumber, message, delivery.contact_id);
                        if (success) {
                            await this.markDeliverySuccess(delivery.id);
                            campaignSent++;
                            totalSent++;
                            (0, logger_1.logInfo)(`   ✅ Sent to ${contact.name || phoneNumber}`);
                            // QUESTIONNAIRE TRIGGER: If campaign has linked questionnaire
                            if (campaign.questionnaireId) {
                                const triggered = await this.triggerCampaignQuestionnaire(campaign, (0, mapper_1.toCamelCase)(contact), phoneNumber);
                                if (triggered) {
                                    campaignQuestionnaires++;
                                    totalQuestionnairesTriggered++;
                                }
                            }
                        }
                        else {
                            await this.markDeliveryFailed(delivery.id, 'Send failed');
                            campaignFailed++;
                            totalFailed++;
                            (0, logger_1.logWarn)(`   ❌ Failed to send to ${contact.name || phoneNumber}`);
                        }
                        // Rate limiting
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    catch (error) {
                        await this.markDeliveryFailed(delivery.id, error.message);
                        campaignFailed++;
                        totalFailed++;
                        (0, logger_1.logError)(`   ❌ Error processing delivery ${delivery.id}:`, error);
                    }
                }
                // Update campaign status if all deliveries processed
                const { count: remainingCount } = await supabase_1.supabase
                    .from('campaign_deliveries')
                    .select('id', { count: 'exact', head: true })
                    .eq('campaign_id', campaign.id)
                    .eq('delivery_status', 'pending');
                if (remainingCount === 0) {
                    await supabase_1.supabase
                        .from('marketing_campaigns')
                        .update({
                        status: 'completed',
                        sent_at: new Date().toISOString(),
                        actual_recipients: campaignSent, // H2 FIX: Use per-campaign counter
                    })
                        .eq('id', campaign.id);
                }
                (0, logger_1.logInfo)(`   Campaign ${campaign.name}: ${campaignSent} sent, ${campaignFailed} failed, ${campaignQuestionnaires} questionnaires`);
                console.log(`   ✅ Campaign "${campaign.name}" completed`);
            }
            catch (error) {
                console.error(`❌ Error processing campaign ${campaign.name}:`, error.message);
                // Mark campaign as failed
                await supabase_1.supabase
                    .from('marketing_campaigns')
                    .update({
                    status: 'failed',
                    error_message: error.message,
                })
                    .eq('id', campaign.id);
            }
        }
        console.log(`📧 Campaign processing complete: ${totalSent} sent, ${totalFailed} failed, ${totalQuestionnairesTriggered} questionnaires triggered`);
        return {
            sent: totalSent,
            failed: totalFailed,
            questionnairesTriggered: totalQuestionnairesTriggered,
        };
    }
    /**
     * Trigger questionnaire for a campaign recipient
     */
    async triggerCampaignQuestionnaire(campaign, contact, phoneNumber) {
        try {
            // Get questionnaire details
            const questionnaire = await this.questionnaireService.getQuestionnaireById(campaign.questionnaireId);
            if (!questionnaire) {
                console.log(`   ⚠️ Questionnaire ${campaign.questionnaireId} not found`);
                return false;
            }
            // Check if contact already completed this questionnaire
            const alreadyCompleted = await this.questionnaireService.hasContactCompletedQuestionnaire(contact.id, questionnaire.id);
            if (alreadyCompleted) {
                console.log(`   ℹ️ Contact already completed questionnaire "${questionnaire.name}"`);
                return false;
            }
            // Get or create conversation for this contact
            const conversationService = (await Promise.resolve().then(() => __importStar(require('./ConversationService')))).default;
            const { conversation } = await conversationService.getOrCreateConversation(phoneNumber);
            // Start questionnaire
            QuestionnaireRuntimeService_1.default.startQuestionnaire(conversation.id, contact.id, questionnaire);
            // Track campaign -> questionnaire mapping for promotion rewards
            if (campaign.promotionAfterCompletion && campaign.promotionId) {
                // Store in database for persistence (in case server restarts)
                await supabase_1.supabase
                    .from('questionnaire_responses')
                    .update({
                    metadata: {
                        campaign_id: campaign.id,
                        promotion_id: campaign.promotionId,
                        promotion_after_completion: true,
                    },
                })
                    .eq('contact_id', contact.id)
                    .eq('questionnaire_id', questionnaire.id)
                    .is('completed_at', null);
            }
            // Send first question
            const firstQuestion = QuestionnaireRuntimeService_1.default.formatCurrentQuestion(conversation.id);
            if (firstQuestion) {
                await (0, whatsapp_1.sendProactiveMessage)(phoneNumber, firstQuestion, contact.id);
                console.log(`   📋 Triggered questionnaire "${questionnaire.name}"`);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error(`   ❌ Error triggering questionnaire:`, error.message);
            return false;
        }
    }
    /**
     * Award promotion upon questionnaire completion
     * Called from QuestionnaireRuntimeService when questionnaire completes
     */
    async handleQuestionnaireCompletion(questionnaireResponseId, contactId, questionnaireId) {
        try {
            // Check if this questionnaire was part of a campaign with promotion
            const { data: response } = await supabase_1.supabase
                .from('questionnaire_responses')
                .select('metadata')
                .eq('id', questionnaireResponseId)
                .single();
            if (!response?.metadata?.promotion_after_completion) {
                return; // No promotion to award
            }
            const campaignId = response.metadata.campaign_id;
            const promotionId = response.metadata.promotion_id;
            console.log(`🎁 Awarding promotion ${promotionId} to contact ${contactId} for completing questionnaire`);
            // Create promotion usage record
            await supabase_1.supabase
                .from('promotion_usage')
                .insert({
                promotion_id: promotionId,
                contact_id: contactId,
                usage_date: new Date().toISOString(),
                discount_amount: 0, // Will be calculated when used
                booking_id: null,
                questionnaire_response_id: questionnaireResponseId,
                campaign_id: campaignId,
            });
            // Get promotion details to send confirmation message
            const { data: promotion } = await supabase_1.supabase
                .from('promotions')
                .select('*, services(name)')
                .eq('id', promotionId)
                .single();
            if (promotion) {
                // Send confirmation message via WhatsApp
                const { data: contact } = await supabase_1.supabase
                    .from('contacts')
                    .select('phone_number, name')
                    .eq('id', contactId)
                    .single();
                if (contact?.phone_number) {
                    const message = `🎁 Thank you for completing the questionnaire!\n\nYou've earned a special reward: ${promotion.name}\n\n${promotion.description || ''}\n\nThis promotion will be automatically applied to your next booking. Enjoy!`;
                    await (0, whatsapp_1.sendProactiveMessage)(contact.phone_number, message, contactId);
                }
            }
            console.log(`✅ Promotion awarded successfully`);
        }
        catch (error) {
            console.error(`❌ Error awarding promotion:`, error.message);
        }
    }
    /**
     * Format campaign message with dynamic placeholders and GPT personalization
     * Uses conversation history to adapt message to customer context and preferred language
     */
    async formatCampaignMessage(template, contact) {
        // Basic placeholder replacement
        let message = template
            .replace(/\{\{name\}\}/g, contact.name || 'valued customer')
            .replace(/\{\{phone\}\}/g, contact.phoneNumber || contact.phone_number || '')
            .replace(/\{\{email\}\}/g, contact.email || '');
        // Try GPT personalization if contact has conversation history
        try {
            const getOpenAI = (await Promise.resolve().then(() => __importStar(require('../infrastructure/openai')))).default;
            const openai = await getOpenAI();
            // Get conversation history for context
            const { data: messages } = await supabase_1.supabase
                .from('messages')
                .select('content, direction, timestamp')
                .eq('conversation_id', contact.conversationId || contact.conversation_id)
                .order('timestamp', { ascending: false })
                .limit(10);
            // Get booking history for service context
            const { data: bookings } = await supabase_1.supabase
                .from('bookings')
                .select('*, services(name)')
                .eq('contact_id', contact.id)
                .order('created_at', { ascending: false })
                .limit(5);
            if (messages && messages.length > 0) {
                const serviceHistory = bookings?.map((b) => b.services?.name).filter(Boolean).join(', ') || 'none';
                const conversationContext = messages.slice(0, 5).map((m) => `${m.direction === 'inbound' ? 'Customer' : 'Bot'}: ${m.content}`).join('\n');
                const systemPrompt = `You are personalizing a marketing message for a customer based on their history and preferences.

Customer Name: ${contact.name || 'Customer'}
Language Preference: ${contact.preferredLanguage || contact.preferred_language || 'de'}
Past Services: ${serviceHistory}
Recent Conversation:
${conversationContext}

Instructions:
1. Adapt the marketing message to match the customer's preferred language (${contact.preferredLanguage || contact.preferred_language || 'de'})
2. Reference their service history naturally if relevant
3. Keep the core message intent but personalize the tone and context
4. Keep it concise and professional
5. Output ONLY the personalized message, nothing else`;
                const userMessage = `Original marketing message:
${message}

Personalize this for the customer based on their history and language preference.`;
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage },
                    ],
                    temperature: 0.7,
                    max_tokens: 300,
                });
                const personalizedMessage = response.choices[0]?.message?.content;
                if (personalizedMessage) {
                    console.log(`   🎯 GPT personalized message for ${contact.name || contact.id}`);
                    return personalizedMessage.trim();
                }
            }
        }
        catch (error) {
            console.warn(`   ⚠️ GPT personalization failed, using template: ${error.message}`);
        }
        // Fallback to basic template
        return message;
    }
    /**
     * Manually trigger a campaign (for testing or admin-triggered campaigns)
     */
    async triggerCampaign(campaignId) {
        await supabase_1.supabase
            .from('marketing_campaigns')
            .update({ status: 'ready', scheduled_at: new Date().toISOString() })
            .eq('id', campaignId);
        const result = await this.processCampaigns();
        return { sent: result.sent, failed: result.failed };
    }
    /**
     * H2: Ensure delivery records exist for all target contacts
     */
    async ensureDeliveryRecords(campaign) {
        try {
            // Check if deliveries already exist
            const { count } = await supabase_1.supabase
                .from('campaign_deliveries')
                .select('id', { count: 'exact', head: true })
                .eq('campaign_id', campaign.id);
            if (count && count > 0) {
                // Deliveries already created (resuming campaign)
                (0, logger_1.logInfo)(`   Campaign ${campaign.id} has ${count} existing delivery records`);
                return;
            }
            // Get filtered contacts for this campaign
            const { MarketingService } = await Promise.resolve().then(() => __importStar(require('./MarketingService')));
            const marketingService = new MarketingService();
            const contacts = await marketingService.getFilteredContacts(campaign.filterCriteria);
            if (contacts.length === 0) {
                (0, logger_1.logWarn)(`   No contacts match filter criteria for campaign ${campaign.id}`);
                return;
            }
            // Create delivery records with personalized messages
            const deliveries = [];
            for (const contact of contacts) {
                const message = await this.formatCampaignMessage(campaign.messageTemplate, contact);
                const idempotencyKey = crypto_1.default.randomUUID();
                deliveries.push({
                    campaign_id: campaign.id,
                    contact_id: contact.id,
                    delivery_status: 'pending',
                    scheduled_at: campaign.scheduledAt || new Date().toISOString(),
                    message_content: message,
                    idempotency_key: idempotencyKey,
                });
            }
            const { error } = await supabase_1.supabase
                .from('campaign_deliveries')
                .insert(deliveries);
            if (error) {
                (0, logger_1.logError)(`Failed to create delivery records for campaign ${campaign.id}:`, error);
            }
            else {
                (0, logger_1.logInfo)(`   Created ${deliveries.length} delivery records for campaign ${campaign.id}`);
            }
        }
        catch (error) {
            (0, logger_1.logError)(`Error ensuring delivery records:`, error);
        }
    }
    /**
     * H2: Mark delivery as successfully sent
     */
    async markDeliverySuccess(deliveryId) {
        try {
            await supabase_1.supabase
                .from('campaign_deliveries')
                .update({
                delivery_status: 'sent',
                sent_at: new Date().toISOString(),
            })
                .eq('id', deliveryId);
        }
        catch (error) {
            (0, logger_1.logError)(`Failed to mark delivery ${deliveryId} as sent:`, error);
        }
    }
    /**
     * H2: Mark delivery as failed with reason
     */
    async markDeliveryFailed(deliveryId, reason) {
        try {
            const { data: delivery } = await supabase_1.supabase
                .from('campaign_deliveries')
                .select('retry_count')
                .eq('id', deliveryId)
                .single();
            const retryCount = (delivery?.retry_count || 0) + 1;
            await supabase_1.supabase
                .from('campaign_deliveries')
                .update({
                delivery_status: 'failed',
                failed_at: new Date().toISOString(),
                failure_reason: reason,
                retry_count: retryCount,
                last_retry_at: new Date().toISOString(),
            })
                .eq('id', deliveryId);
        }
        catch (error) {
            (0, logger_1.logError)(`Failed to mark delivery ${deliveryId} as failed:`, error);
        }
    }
}
exports.MarketingCampaignExecutor = MarketingCampaignExecutor;
exports.default = new MarketingCampaignExecutor();
