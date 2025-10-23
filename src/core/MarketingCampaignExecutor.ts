import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toSnakeCase, toCamelCaseArray } from '../infrastructure/mapper';
import { QuestionnaireService } from './QuestionnaireService';
import questionnaireRuntimeService from './QuestionnaireRuntimeService';
import PromotionService from './PromotionService';
import { sendProactiveMessage } from '../adapters/whatsapp';

/**
 * Marketing Campaign Executor
 * Processes marketing_campaigns table and:
 * 1. Sends campaign messages to filtered contacts
 * 2. Triggers linked questionnaires
 * 3. Awards promotions upon questionnaire completion
 */
export class MarketingCampaignExecutor {
  private questionnaireService: QuestionnaireService;

  // Track which campaigns triggered questionnaires (for promotion rewards)
  private campaignQuestionnaireMap: Map<string, string> = new Map(); // questionnaireResponseId -> campaignId

  constructor() {
    this.questionnaireService = new QuestionnaireService();
  }

  /**
   * Process scheduled marketing campaigns
   * Called by scheduler or manually triggered
   */
  async processCampaigns(): Promise<{ sent: number; failed: number; questionnairesTriggered: number }> {
    console.log('📧 Processing marketing campaigns...');

    // Get campaigns that are scheduled or ready to send
    const { data: campaigns, error } = await supabase
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
      const campaign = toCamelCase(campaignData);

      try {
        console.log(`📋 Processing campaign: ${campaign.name}`);

        // Get filtered contacts based on campaign criteria
        const { MarketingService } = await import('./MarketingService');
        const marketingService = new MarketingService();
        const contacts = await marketingService.getFilteredContacts(campaign.filterCriteria);

        console.log(`   Found ${contacts.length} target contacts`);

        if (contacts.length === 0) {
          // Mark campaign as completed
          await supabase
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

            // Format message with placeholders and GPT personalization
            const message = await this.formatCampaignMessage(campaign.messageTemplate, contact);

            // Send message
            const success = await sendProactiveMessage(phoneNumber, message, contact.id);

            if (success) {
              totalSent++;
              console.log(`   ✅ Sent to ${contact.name || phoneNumber}`);

              // QUESTIONNAIRE TRIGGER: If campaign has linked questionnaire
              if (campaign.questionnaireId) {
                const triggered = await this.triggerCampaignQuestionnaire(
                  campaign,
                  contact,
                  phoneNumber
                );

                if (triggered) {
                  totalQuestionnairesTriggered++;
                }
              }
            } else {
              totalFailed++;
              console.log(`   ❌ Failed to send to ${contact.name || phoneNumber}`);
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error: any) {
            totalFailed++;
            console.error(`   ❌ Error processing contact ${contact.id}:`, error.message);
          }
        }

        // Update campaign status
        await supabase
          .from('marketing_campaigns')
          .update({
            status: 'completed',
            sent_at: new Date().toISOString(),
            actual_recipients: totalSent,
          })
          .eq('id', campaign.id);

        console.log(`   ✅ Campaign "${campaign.name}" completed`);
      } catch (error: any) {
        console.error(`❌ Error processing campaign ${campaign.name}:`, error.message);

        // Mark campaign as failed
        await supabase
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
  private async triggerCampaignQuestionnaire(
    campaign: any,
    contact: any,
    phoneNumber: string
  ): Promise<boolean> {
    try {
      // Get questionnaire details
      const questionnaire = await this.questionnaireService.getQuestionnaireById(campaign.questionnaireId);

      if (!questionnaire) {
        console.log(`   ⚠️ Questionnaire ${campaign.questionnaireId} not found`);
        return false;
      }

      // Check if contact already completed this questionnaire
      const alreadyCompleted = await this.questionnaireService.hasContactCompletedQuestionnaire(
        contact.id,
        questionnaire.id
      );

      if (alreadyCompleted) {
        console.log(`   ℹ️ Contact already completed questionnaire "${questionnaire.name}"`);
        return false;
      }

      // Get or create conversation for this contact
      const conversationService = (await import('./ConversationService')).default;
      const { conversation } = await conversationService.getOrCreateConversation(phoneNumber);

      // Start questionnaire
      questionnaireRuntimeService.startQuestionnaire(
        conversation.id,
        contact.id,
        questionnaire
      );

      // Track campaign -> questionnaire mapping for promotion rewards
      if (campaign.promotionAfterCompletion && campaign.promotionId) {
        // Store in database for persistence (in case server restarts)
        await supabase
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
      const firstQuestion = questionnaireRuntimeService.formatCurrentQuestion(conversation.id);
      if (firstQuestion) {
        await sendProactiveMessage(phoneNumber, firstQuestion, contact.id);
        console.log(`   📋 Triggered questionnaire "${questionnaire.name}"`);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error(`   ❌ Error triggering questionnaire:`, error.message);
      return false;
    }
  }

  /**
   * Award promotion upon questionnaire completion
   * Called from QuestionnaireRuntimeService when questionnaire completes
   */
  async handleQuestionnaireCompletion(
    questionnaireResponseId: string,
    contactId: string,
    questionnaireId: string
  ): Promise<void> {
    try {
      // Check if this questionnaire was part of a campaign with promotion
      const { data: response } = await supabase
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
      await supabase
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
      const { data: promotion } = await supabase
        .from('promotions')
        .select('*, services(name)')
        .eq('id', promotionId)
        .single();

      if (promotion) {
        // Send confirmation message via WhatsApp
        const { data: contact } = await supabase
          .from('contacts')
          .select('phone_number, name')
          .eq('id', contactId)
          .single();

        if (contact?.phone_number) {
          const message = `🎁 Thank you for completing the questionnaire!\n\nYou've earned a special reward: ${promotion.name}\n\n${promotion.description || ''}\n\nThis promotion will be automatically applied to your next booking. Enjoy!`;
          await sendProactiveMessage(contact.phone_number, message, contactId);
        }
      }

      console.log(`✅ Promotion awarded successfully`);
    } catch (error: any) {
      console.error(`❌ Error awarding promotion:`, error.message);
    }
  }

  /**
   * Format campaign message with dynamic placeholders and GPT personalization
   * Uses conversation history to adapt message to customer context and preferred language
   */
  private async formatCampaignMessage(template: string, contact: any): Promise<string> {
    // Basic placeholder replacement
    let message = template
      .replace(/\{\{name\}\}/g, contact.name || 'valued customer')
      .replace(/\{\{phone\}\}/g, contact.phoneNumber || contact.phone_number || '')
      .replace(/\{\{email\}\}/g, contact.email || '');

    // Try GPT personalization if contact has conversation history
    try {
      const getOpenAI = (await import('../infrastructure/openai')).default;
      const openai = await getOpenAI();

      // Get conversation history for context
      const { data: messages } = await supabase
        .from('messages')
        .select('content, direction, timestamp')
        .eq('conversation_id', contact.conversationId || contact.conversation_id)
        .order('timestamp', { ascending: false })
        .limit(10);

      // Get booking history for service context
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, services(name)')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (messages && messages.length > 0) {
        const serviceHistory = bookings?.map((b: any) => b.services?.name).filter(Boolean).join(', ') || 'none';
        const conversationContext = messages.slice(0, 5).map((m: any) => 
          `${m.direction === 'inbound' ? 'Customer' : 'Bot'}: ${m.content}`
        ).join('\n');

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
    } catch (error: any) {
      console.warn(`   ⚠️ GPT personalization failed, using template: ${error.message}`);
    }

    // Fallback to basic template
    return message;
  }

  /**
   * Manually trigger a campaign (for testing or admin-triggered campaigns)
   */
  async triggerCampaign(campaignId: string): Promise<{ sent: number; failed: number }> {
    await supabase
      .from('marketing_campaigns')
      .update({ status: 'ready', scheduled_at: new Date().toISOString() })
      .eq('id', campaignId);

    const result = await this.processCampaigns();
    return { sent: result.sent, failed: result.failed };
  }
}

export default new MarketingCampaignExecutor();
