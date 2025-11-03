import getOpenAIClient from '../infrastructure/openai';
import { supabase } from '../infrastructure/supabase';
import { Message } from '../types';
import botConfigService from './BotConfigService';
import { ExtractedConversationData } from '../types/crm';

export class AIService {
  async generateReply(conversationId: string, messageHistory: Message[], currentMessage: string, intent?: string, contactId?: string): Promise<string> {
    try {
      const openai = await getOpenAIClient();
      const config = await botConfigService.getConfig();

      // Check if auto-response is enabled
      if (!config.enable_auto_response) {
        console.log('🚫 Auto-response disabled in configuration');
        return config.fallback_message;
      }

      // Fetch contact's preferred language if contactId provided
      let contactLanguage: string | null = null;
      if (contactId) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('preferred_language')
          .eq('id', contactId)
          .single();
        
        contactLanguage = contact?.preferred_language || null;
        console.log(`🌍 Contact language: ${contactLanguage || 'not set (using default)'}`);
      }

      // Build dynamic system prompt with business details, fine-tuning, language context, AND customer analytics
      const systemPrompt = await botConfigService.buildSystemPrompt(contactLanguage, contactId);

      const messages = [
        {
          role: 'system' as const,
          content: systemPrompt,
        },
        ...messageHistory.slice(-10).map(msg => ({
          role: msg.direction === 'inbound' ? 'user' as const : 'assistant' as const,
          content: msg.content,
        })),
        {
          role: 'user' as const,
          content: currentMessage,
        },
      ];

      console.log(`🤖 Generating GPT reply for conversation ${conversationId}`);
      console.log(`📝 Message history: ${messageHistory.length} messages`);
      console.log(`⚙️  Tone: ${config.tone_of_voice}, Style: ${config.response_style}`);
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.7,
        max_tokens: config.max_response_length,
      });

      const reply = response.choices[0]?.message?.content || config.fallback_message;
      
      // Check confidence and escalate if needed (pass intent for context-aware confidence)
      const confidence = this.estimateConfidence(reply, intent);
      if (config.require_approval_low_confidence && confidence < config.confidence_threshold) {
        console.log(`⚠️  Low confidence reply (${confidence}), may require approval`);
        // TODO: Implement approval workflow
      }

      console.log(`✅ GPT reply generated (${reply.length} chars)`);
      
      return reply;
    } catch (error: any) {
      console.error('❌ GPT Error:', error.message);
      console.error('Stack:', error.stack);
      
      const config = await botConfigService.getConfig();
      return config.fallback_message;
    }
  }

  async detectIntent(message: string): Promise<{ intent: string; confidence: number; entities?: Record<string, any> }> {
    try {
      const openai = await getOpenAIClient();
      const config = await botConfigService.getConfig();

      // Check for service-specific trigger words first
      const detectedService = this.detectServiceFromTriggerWords(message, config.service_trigger_words);
      if (detectedService) {
        console.log(`🎯 Service detected via trigger words: ${detectedService}`);
        return {
          intent: 'booking_request',
          confidence: 0.9,
          entities: { service: detectedService },
        };
      }

      // Fall back to AI intent detection
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an intent classifier for ${config.business_name}. Analyze the user message and determine their intent.

Available services: ${Object.keys(config.service_trigger_words).join(', ')}

Possible intents:
- greeting: Simple hello/hi messages
- booking_request: Customer wants to book an appointment
- booking_modify: Customer wants to change existing booking
- booking_cancel: Customer wants to cancel booking
- question: Customer has a question
- complaint: Customer is unhappy or complaining
- other: Anything else

Respond with JSON: { "intent": "intent_name", "confidence": 0-1, "entities": {} }

If you detect a service request, include it in entities: { "service": "service_name" }`,
          },
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"intent":"other","confidence":0}');
      
      // Check if this should escalate due to complaint keywords
      if (this.shouldEscalate(message, result.intent, config)) {
        console.log(`🚨 Message should escalate based on configuration`);
        result.intent = 'escalation_required';
      }

      return result;
    } catch (error) {
      console.error('❌ Intent detection error:', error);
      return { intent: 'other', confidence: 0 };
    }
  }

  private detectServiceFromTriggerWords(message: string, triggerWords: Record<string, string[]>): string | null {
    const lowerMessage = message.toLowerCase();
    
    for (const [serviceName, keywords] of Object.entries(triggerWords)) {
      for (const keyword of keywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          return serviceName;
        }
      }
    }
    
    return null;
  }

  private shouldEscalate(message: string, intent: string, config: any): boolean {
    const escalationConfig = config.escalation_config;
    
    if (!escalationConfig.enabled) {
      return false;
    }

    const lowerMessage = message.toLowerCase();
    
    // Check for trigger keywords
    const hasKeyword = escalationConfig.triggers.keywords.some((keyword: string) => 
      lowerMessage.includes(keyword.toLowerCase())
    );

    // Check for complaint intent (simplified sentiment check)
    const hasNegativeSentiment = intent === 'complaint';

    // Apply escalation mode logic
    switch (escalationConfig.mode) {
      case 'keyword_only':
        return hasKeyword;
      
      case 'sentiment_only':
        return hasNegativeSentiment;
      
      case 'sentiment_and_keyword':
        return hasKeyword || hasNegativeSentiment;
      
      case 'sentiment_then_keyword':
        return hasKeyword && hasNegativeSentiment;
      
      case 'manual_only':
        return false;
      
      default:
        return hasKeyword || hasNegativeSentiment;
    }
  }

  private estimateConfidence(reply: string, intent?: string): number {
    // Confidence based on reply complexity and intent, NOT length
    // Length is a bot configuration setting (concise vs detailed), not a confidence indicator
    
    // HIGH CONFIDENCE: Clear uncertainty indicators mean we should flag it
    if (reply.includes('I\'m not sure') || reply.includes('I don\'t know') || 
        reply.includes('uncertain') || reply.includes('nicht sicher') ||
        reply.includes('weiss nicht')) {
      return 0.3; // Low confidence - bot is explicitly uncertain
    }
    
    // BYPASS CONFIDENCE CHECK: Simple intents that don't need approval
    // Greetings, confirmations, and standard booking flows are always high confidence
    const safeIntents = ['greeting', 'booking_confirm', 'booking_cancel', 'booking_modify'];
    if (intent && safeIntents.includes(intent)) {
      return 1.0; // High confidence - these are simple, safe interactions
    }
    
    // COMPLEX SITUATIONS: Check for indicators of uncertainty in complex situations
    const hasHedging = reply.match(/might|maybe|perhaps|possibly|vielleicht|möglicherweise/i);
    const hasQuestions = (reply.match(/\?/g) || []).length > 1; // Multiple questions = uncertainty
    const hasApology = reply.match(/sorry|entschuldigung|leider/i);
    
    if (hasHedging && hasQuestions) {
      return 0.4; // Medium-low confidence - hedging + questions indicates uncertainty
    }
    
    if (hasApology && hasQuestions) {
      return 0.5; // Medium confidence - apologetic + questions
    }
    
    // DEFAULT: Most replies are confident unless they show uncertainty markers
    return 0.8;
  }

  /**
   * Detect if customer is explicitly requesting a language change
   * Returns language code if detected, null otherwise
   */
  async detectLanguageChangeRequest(message: string): Promise<{ languageRequested: string | null; confidence: number }> {
    try {
      const openai = await getOpenAIClient();
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a language preference detector. Analyze if the customer is EXPLICITLY requesting to change the conversation language.

ONLY detect explicit language change requests like:
- "Can you speak English?" / "Können Sie Englisch sprechen?" / "Parlez-vous anglais?"
- "Please switch to German" / "Bitte auf Deutsch" / "En allemand s'il vous plaît"
- "I prefer French" / "Je préfère français" / "Prefiero francés"
- "Talk to me in Italian" / "Parlami in italiano"

DO NOT detect:
- Customers simply writing in a different language (e.g., switching from German to English mid-conversation)
- Greetings in different languages ("Hello", "Bonjour")
- Questions about business language capabilities

Available languages:
- de (German/Deutsch)
- en (English)
- fr (French/Français)
- it (Italian/Italiano)
- es (Spanish/Español)
- pt (Portuguese/Português)

Respond with JSON: { "language_requested": "de"|"en"|"fr"|"it"|"es"|"pt"|null, "confidence": 0-1 }

If NO explicit language change is requested, return: { "language_requested": null, "confidence": 0 }`,
          },
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"language_requested":null,"confidence":0}');
      
      return {
        languageRequested: result.language_requested,
        confidence: result.confidence || 0,
      };
    } catch (error) {
      console.error('❌ Language detection error:', error);
      return { languageRequested: null, confidence: 0 };
    }
  }

  /**
   * Update contact's preferred language in database
   */
  async updateContactLanguage(contactId: string, languageCode: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ preferred_language: languageCode })
        .eq('id', contactId);

      if (error) throw error;

      console.log(`✅ Updated contact ${contactId} preferred language to: ${languageCode}`);
    } catch (error) {
      console.error('❌ Failed to update contact language:', error);
      throw error;
    }
  }

  /**
   * Extract customer insights from conversation history
   * Analyzes messages to find preferences, fears, allergies, special needs, etc.
   */
  async extractCustomerData(conversationId: string, messageHistory: Message[]): Promise<ExtractedConversationData> {
    try {
      const config = await botConfigService.getConfig();

      // Check if CRM extraction is enabled
      if (!config.enable_crm_extraction) {
        console.log('🚫 CRM data extraction disabled in configuration');
        return { confidence: 0 };
      }

      const openai = await getOpenAIClient();

      // Build conversation context for analysis
      const conversationText = messageHistory
        .map(msg => `${msg.direction === 'inbound' ? 'Customer' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      if (!conversationText || conversationText.trim() === '') {
        return { confidence: 0 };
      }

      const extractionPrompt = `You are a CRM data analyst for ${config.business_name}. Analyze this conversation and extract ANY relevant customer information.

CONVERSATION:
${conversationText}

Extract the following information if mentioned (explicitly or implicitly):

1. **Email**: Customer's email address if provided
2. **Birthday**: Customer's birthdate if mentioned (convert to YYYY-MM-DD format)
3. **Preferred Times**: When customer prefers appointments (mornings, afternoons, specific days/times)
4. **Preferred Staff**: Any staff member they mention positively or request
5. **Preferred Services**: Services they're interested in or frequently book
6. **Fears/Anxieties**: Dental anxiety, needle phobia, claustrophobia, nervousness, etc.
7. **Allergies**: Latex, medications, materials, foods, etc.
8. **Physical Limitations**: Wheelchair access, hearing issues, vision problems, mobility concerns
9. **Special Requests**: Quiet environment, bring companion, child-friendly, cultural/religious needs
10. **Behavioral Notes**: Punctuality patterns, communication style, personality traits

IMPORTANT:
- Only extract information that is clearly stated or strongly implied
- For birthday, convert any date format to ISO format YYYY-MM-DD (e.g., "March 13, 1990" → "1990-03-13", "13.03.1990" → "1990-03-13")
- For email, extract the full email address (e.g., "user@example.com")
- Be conversational and natural in your extraction
- If nothing is found in a category, leave it null
- Combine similar information into coherent notes

Respond with JSON only:
{
  "newInsights": {
    "email": "string or null",
    "birthdate": "YYYY-MM-DD or null",
    "preferredTimes": "string or null",
    "preferredStaff": "string or null",
    "preferredServices": "string or null",
    "fearsAnxieties": "string or null",
    "allergies": "string or null",
    "physicalLimitations": "string or null",
    "specialRequests": "string or null",
    "behavioralNotes": "string or null",
    "other": "any other relevant insights"
  },
  "confidence": 0-1 (how confident you are in the extraction)
}`;

      console.log(`🔍 Extracting CRM data from conversation ${conversationId} (${messageHistory.length} messages)`);

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: extractionPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for more factual extraction
      });

      const extracted: ExtractedConversationData = JSON.parse(
        response.choices[0]?.message?.content || '{"newInsights":{},"confidence":0}'
      );

      extracted.conversationId = conversationId;
      extracted.extractedAt = new Date();

      // Log what was extracted
      const insightCount = Object.values(extracted.newInsights || {}).filter(v => v && v !== 'null').length;
      if (insightCount > 0) {
        console.log(`✅ Extracted ${insightCount} customer insights (confidence: ${extracted.confidence})`);
        console.log(`   Insights: ${JSON.stringify(extracted.newInsights, null, 2)}`);
      } else {
        console.log(`ℹ️  No new customer insights extracted from conversation`);
      }

      return extracted;
    } catch (error: any) {
      console.error('❌ CRM data extraction error:', error.message);
      return {
        confidence: 0,
        conversationId,
        extractedAt: new Date(),
      };
    }
  }

  /**
   * Update contact profile with extracted CRM data
   * Intelligently merges new insights with existing data
   */
  async updateContactWithInsights(contactId: string, extractedData: ExtractedConversationData): Promise<void> {
    try {
      if (!extractedData.newInsights || (extractedData.confidence || 0) < 0.3) {
        console.log(`⏭️  Skipping contact update - low confidence or no insights`);
        return;
      }

      const { newInsights } = extractedData;
      
      // Fetch existing contact data
      const { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (!contact) {
        console.error(`❌ Contact ${contactId} not found`);
        return;
      }

      // Prepare update data - only update fields with new information
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Helper function to merge text fields (append new info, don't overwrite)
      const mergeField = (existingValue: string | null, newValue: string | null | undefined, fieldName: string): string | null => {
        if (!newValue || newValue === 'null') return existingValue;
        
        if (!existingValue || existingValue.trim() === '') {
          console.log(`   ✨ Adding ${fieldName}: ${newValue}`);
          return newValue;
        }

        // Check if new info is already mentioned
        if (existingValue.toLowerCase().includes(newValue.toLowerCase())) {
          return existingValue; // No change needed
        }

        // Append new information
        console.log(`   📝 Updating ${fieldName}: adding "${newValue}"`);
        return `${existingValue}\n• ${newValue}`;
      };

      // Direct field updates (don't merge, replace if not set)
      if (newInsights.email && !contact.email) {
        updateData.email = newInsights.email;
        console.log(`   ✨ Adding email: ${newInsights.email}`);
      }

      if (newInsights.birthdate && !contact.birthdate) {
        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateRegex.test(newInsights.birthdate)) {
          updateData.birthdate = newInsights.birthdate;
          console.log(`   ✨ Adding birthdate: ${newInsights.birthdate}`);
        } else {
          console.log(`   ⚠️  Invalid birthdate format: ${newInsights.birthdate}, expected YYYY-MM-DD`);
        }
      }

      if (newInsights.preferredTimes) {
        updateData.preferred_times = mergeField(contact.preferred_times, newInsights.preferredTimes, 'preferred times');
      }

      if (newInsights.preferredStaff) {
        updateData.preferred_staff = mergeField(contact.preferred_staff, newInsights.preferredStaff, 'preferred staff');
      }

      if (newInsights.preferredServices) {
        updateData.preferred_services = mergeField(contact.preferred_services, newInsights.preferredServices, 'preferred services');
      }

      if (newInsights.fearsAnxieties) {
        updateData.fears_anxieties = mergeField(contact.fears_anxieties, newInsights.fearsAnxieties, 'fears/anxieties');
      }

      if (newInsights.allergies) {
        updateData.allergies = mergeField(contact.allergies, newInsights.allergies, 'allergies');
      }

      if (newInsights.physicalLimitations) {
        updateData.physical_limitations = mergeField(contact.physical_limitations, newInsights.physicalLimitations, 'physical limitations');
      }

      if (newInsights.specialRequests) {
        updateData.special_requests = mergeField(contact.special_requests, newInsights.specialRequests, 'special requests');
      }

      if (newInsights.behavioralNotes) {
        updateData.behavioral_notes = mergeField(contact.behavioral_notes, newInsights.behavioralNotes, 'behavioral notes');
      }

      if (newInsights.other) {
        updateData.customer_insights = mergeField(contact.customer_insights, newInsights.other, 'customer insights');
      }

      // Only update if we have new data
      const hasUpdates = Object.keys(updateData).length > 1; // More than just updated_at
      if (!hasUpdates) {
        console.log(`ℹ️  No new CRM data to save for contact ${contactId}`);
        return;
      }

      // Update contact in database
      const { error } = await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', contactId);

      if (error) {
        console.error(`❌ Failed to update contact CRM data:`, error);
        throw error;
      }

      console.log(`✅ Updated contact ${contactId} with CRM insights (${Object.keys(updateData).length - 1} fields)`);
    } catch (error: any) {
      console.error('❌ Error updating contact with insights:', error.message);
    }
  }

  /**
   * Personalize a template message through GPT with proper language and context
   * This ensures ALL outbound messages (email prompts, confirmations, nurturing, etc.) 
   * are natural, language-appropriate, and conversation-aware
   */
  async personalizeMessage(params: {
    templateMessage: string;
    contactId?: string;
    contactName?: string;
    conversationContext?: string;
    messageType?: 'email_request' | 'booking_confirmation' | 'birthday_wish' | 'review_request' | 'general';
  }): Promise<string> {
    try {
      const openai = await getOpenAIClient();
      const config = await botConfigService.getConfig();

      // Get contact's preferred language
      let contactLanguage: string | null = null;
      if (params.contactId) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('preferred_language')
          .eq('id', params.contactId)
          .single();
        
        contactLanguage = contact?.preferred_language || null;
      }

      const activeLanguage = contactLanguage || config.default_bot_language || 'de';
      const languageMap: Record<string, string> = {
        'de': 'German',
        'en': 'English',
        'fr': 'French',
        'it': 'Italian',
        'es': 'Spanish',
        'pt': 'Portuguese'
      };
      const languageName = languageMap[activeLanguage] || 'German';

      const personalizationPrompt = `You are personalizing a message for ${config.business_name}.

**Task**: Rewrite the following template message to be natural, friendly, and contextually appropriate.

**CRITICAL**: You MUST respond in ${languageName} language.

**Template Message**: ${params.templateMessage}

**Customer Name**: ${params.contactName || 'the customer'}
**Message Type**: ${params.messageType || 'general'}
${params.conversationContext ? `**Conversation Context**: ${params.conversationContext}` : ''}

**Instructions**:
1. Keep the same intent and purpose as the template
2. Make it sound natural and conversational
3. Use the customer's name if appropriate
4. Match the ${languageName} language and cultural tone
5. Keep it concise but friendly
6. For booking/email requests, explain WHY (e.g., "for appointment confirmations")
7. Maintain ${config.tone_of_voice} tone

**CRITICAL**: Output ONLY the personalized message text in ${languageName}, nothing else.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: personalizationPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      });

      const personalizedMessage = response.choices[0]?.message?.content?.trim() || params.templateMessage;
      console.log(`✨ Personalized ${params.messageType} message (${activeLanguage}): ${personalizedMessage.substring(0, 80)}...`);
      
      return personalizedMessage;
    } catch (error: any) {
      console.error('❌ Message personalization error:', error.message);
      // Fallback to template if personalization fails
      return params.templateMessage;
    }
  }
}

export default new AIService();
