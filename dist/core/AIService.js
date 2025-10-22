"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const openai_1 = __importDefault(require("../infrastructure/openai"));
const supabase_1 = require("../infrastructure/supabase");
const BotConfigService_1 = __importDefault(require("./BotConfigService"));
class AIService {
    async generateReply(conversationId, messageHistory, currentMessage) {
        try {
            const openai = await (0, openai_1.default)();
            const config = await BotConfigService_1.default.getConfig();
            // Check if auto-response is enabled
            if (!config.enable_auto_response) {
                console.log('🚫 Auto-response disabled in configuration');
                return config.fallback_message;
            }
            // Build dynamic system prompt with business details and fine-tuning
            const systemPrompt = await BotConfigService_1.default.buildSystemPrompt();
            const messages = [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                ...messageHistory.slice(-10).map(msg => ({
                    role: msg.direction === 'inbound' ? 'user' : 'assistant',
                    content: msg.content,
                })),
                {
                    role: 'user',
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
            // Check confidence and escalate if needed
            const confidence = this.estimateConfidence(reply);
            if (config.require_approval_low_confidence && confidence < config.confidence_threshold) {
                console.log(`⚠️  Low confidence reply (${confidence}), may require approval`);
                // TODO: Implement approval workflow
            }
            console.log(`✅ GPT reply generated (${reply.length} chars)`);
            return reply;
        }
        catch (error) {
            console.error('❌ GPT Error:', error.message);
            console.error('Stack:', error.stack);
            const config = await BotConfigService_1.default.getConfig();
            return config.fallback_message;
        }
    }
    async detectIntent(message) {
        try {
            const openai = await (0, openai_1.default)();
            const config = await BotConfigService_1.default.getConfig();
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
        }
        catch (error) {
            console.error('❌ Intent detection error:', error);
            return { intent: 'other', confidence: 0 };
        }
    }
    detectServiceFromTriggerWords(message, triggerWords) {
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
    shouldEscalate(message, intent, config) {
        const escalationConfig = config.escalation_config;
        if (!escalationConfig.enabled) {
            return false;
        }
        const lowerMessage = message.toLowerCase();
        // Check for trigger keywords
        const hasKeyword = escalationConfig.triggers.keywords.some((keyword) => lowerMessage.includes(keyword.toLowerCase()));
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
    estimateConfidence(reply) {
        // Simple heuristic: longer, well-structured replies are likely more confident
        // In production, you'd use OpenAI's logprobs or a separate confidence model
        if (reply.includes('I\'m not sure') || reply.includes('I don\'t know')) {
            return 0.3;
        }
        if (reply.length < 50) {
            return 0.5;
        }
        if (reply.length > 200) {
            return 0.9;
        }
        return 0.7;
    }
    /**
     * Extract customer insights from conversation history
     * Analyzes messages to find preferences, fears, allergies, special needs, etc.
     */
    async extractCustomerData(conversationId, messageHistory) {
        try {
            const config = await BotConfigService_1.default.getConfig();
            // Check if CRM extraction is enabled
            if (!config.enable_crm_extraction) {
                console.log('🚫 CRM data extraction disabled in configuration');
                return { confidence: 0 };
            }
            const openai = await (0, openai_1.default)();
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

1. **Preferred Times**: When customer prefers appointments (mornings, afternoons, specific days/times)
2. **Preferred Staff**: Any staff member they mention positively or request
3. **Preferred Services**: Services they're interested in or frequently book
4. **Fears/Anxieties**: Dental anxiety, needle phobia, claustrophobia, nervousness, etc.
5. **Allergies**: Latex, medications, materials, foods, etc.
6. **Physical Limitations**: Wheelchair access, hearing issues, vision problems, mobility concerns
7. **Special Requests**: Quiet environment, bring companion, child-friendly, cultural/religious needs
8. **Behavioral Notes**: Punctuality patterns, communication style, personality traits

IMPORTANT:
- Only extract information that is clearly stated or strongly implied
- Be conversational and natural in your extraction
- If nothing is found in a category, leave it null
- Combine similar information into coherent notes

Respond with JSON only:
{
  "newInsights": {
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
            const extracted = JSON.parse(response.choices[0]?.message?.content || '{"newInsights":{},"confidence":0}');
            extracted.conversationId = conversationId;
            extracted.extractedAt = new Date();
            // Log what was extracted
            const insightCount = Object.values(extracted.newInsights || {}).filter(v => v && v !== 'null').length;
            if (insightCount > 0) {
                console.log(`✅ Extracted ${insightCount} customer insights (confidence: ${extracted.confidence})`);
                console.log(`   Insights: ${JSON.stringify(extracted.newInsights, null, 2)}`);
            }
            else {
                console.log(`ℹ️  No new customer insights extracted from conversation`);
            }
            return extracted;
        }
        catch (error) {
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
    async updateContactWithInsights(contactId, extractedData) {
        try {
            if (!extractedData.newInsights || (extractedData.confidence || 0) < 0.3) {
                console.log(`⏭️  Skipping contact update - low confidence or no insights`);
                return;
            }
            const { newInsights } = extractedData;
            // Fetch existing contact data
            const { data: contact } = await supabase_1.supabase
                .from('contacts')
                .select('*')
                .eq('id', contactId)
                .single();
            if (!contact) {
                console.error(`❌ Contact ${contactId} not found`);
                return;
            }
            // Prepare update data - only update fields with new information
            const updateData = {
                updated_at: new Date().toISOString(),
            };
            // Helper function to merge text fields (append new info, don't overwrite)
            const mergeField = (existingValue, newValue, fieldName) => {
                if (!newValue || newValue === 'null')
                    return existingValue;
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
            const { error } = await supabase_1.supabase
                .from('contacts')
                .update(updateData)
                .eq('id', contactId);
            if (error) {
                console.error(`❌ Failed to update contact CRM data:`, error);
                throw error;
            }
            console.log(`✅ Updated contact ${contactId} with CRM insights (${Object.keys(updateData).length - 1} fields)`);
        }
        catch (error) {
            console.error('❌ Error updating contact with insights:', error.message);
        }
    }
}
exports.AIService = AIService;
exports.default = new AIService();
