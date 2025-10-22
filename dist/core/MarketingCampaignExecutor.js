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
     * Process scheduled marketing campaigns
     * Called by scheduler or manually triggered
     */
    async processCampaigns() {
        console.log('📧 Processing marketing campaigns...');
        // Get campaigns that are scheduled or ready to send
        const { data: campaigns, error } = await supabase_1.supabase
            .from('marketing_campaigns')
            .select('*')
            .in('status', ['scheduled', 'ready'])
            .lte('scheduled_at', new Date().toISOString());
        if (error) {
            console.error('Error fetching campaigns:', error);
            return { sent: 0, failed: 0, questionnairesTriggered: 0 };
        }
        let totalSent = 0;
        let totalFailed = 0;
        let totalQuestionnairesTriggered = 0;
        for (const campaignData of campaigns || []) {
            const campaign = (0, mapper_1.toCamelCase)(campaignData);
            try {
                console.log(`📋 Processing campaign: ${campaign.name}`);
                // Get filtered contacts based on campaign criteria
                const { MarketingService } = await Promise.resolve().then(() => __importStar(require('./MarketingService')));
                const marketingService = new MarketingService();
                const contacts = await marketingService.getFilteredContacts(campaign.filterCriteria);
                console.log(`   Found ${contacts.length} target contacts`);
                if (contacts.length === 0) {
                    // Mark campaign as completed
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
                // Send messages to each contact
                for (const contact of contacts) {
                    try {
                        const phoneNumber = contact.phoneNumber || contact.phone_number;
                        if (!phoneNumber) {
                            console.log(`   ⚠️ Skipping contact ${contact.id} - no phone number`);
                            totalFailed++;
                            continue;
                        }
                        // Format message with placeholders
                        const message = this.formatCampaignMessage(campaign.messageTemplate, contact);
                        // Send message
                        const success = await (0, whatsapp_1.sendProactiveMessage)(phoneNumber, message, contact.id);
                        if (success) {
                            totalSent++;
                            console.log(`   ✅ Sent to ${contact.name || phoneNumber}`);
                            // QUESTIONNAIRE TRIGGER: If campaign has linked questionnaire
                            if (campaign.questionnaireId) {
                                const triggered = await this.triggerCampaignQuestionnaire(campaign, contact, phoneNumber);
                                if (triggered) {
                                    totalQuestionnairesTriggered++;
                                }
                            }
                        }
                        else {
                            totalFailed++;
                            console.log(`   ❌ Failed to send to ${contact.name || phoneNumber}`);
                        }
                        // Rate limiting
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    catch (error) {
                        totalFailed++;
                        console.error(`   ❌ Error processing contact ${contact.id}:`, error.message);
                    }
                }
                // Update campaign status
                await supabase_1.supabase
                    .from('marketing_campaigns')
                    .update({
                    status: 'completed',
                    sent_at: new Date().toISOString(),
                    actual_recipients: totalSent,
                })
                    .eq('id', campaign.id);
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
     * Format campaign message with dynamic placeholders
     */
    formatCampaignMessage(template, contact) {
        return template
            .replace(/\{\{name\}\}/g, contact.name || 'valued customer')
            .replace(/\{\{phone\}\}/g, contact.phoneNumber || contact.phone_number || '')
            .replace(/\{\{email\}\}/g, contact.email || '');
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
}
exports.MarketingCampaignExecutor = MarketingCampaignExecutor;
exports.default = new MarketingCampaignExecutor();
