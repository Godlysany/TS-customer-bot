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
exports.AIService = void 0;
const openai_1 = __importDefault(require("../infrastructure/openai"));
const supabase_1 = require("../infrastructure/supabase");
const BotConfigService_1 = __importDefault(require("./BotConfigService"));
class AIService {
    /**
     * Testable service detection helper
     * Extracted for unit testing to prevent regression in hallucination prevention
     */
    detectServiceFromMessage(message, services, intentEntities) {
        const stopwords = ['service', 'clinic', 'therapy', 'appointment', 'booking', 'treatment', 'care', 'center', 'studio'];
        let detectionMethod = 'none';
        // PRECISION ENHANCEMENT: Use intent entities if available (highest priority)
        if (intentEntities?.service) {
            const service = services.find(s => s.name.toLowerCase() === intentEntities.service.toLowerCase());
            if (service) {
                return { service, method: 'intent_entity' };
            }
        }
        // Fallback to message-based detection
        const lowerMessage = message.toLowerCase();
        const service = services.find(s => {
            const serviceName = s.name.toLowerCase();
            // Exact match (preferred)
            if (lowerMessage.includes(serviceName)) {
                detectionMethod = 'exact_match';
                return true;
            }
            // Multi-word match: require at least 2 meaningful words from service name
            const serviceWords = serviceName.split(' ')
                .filter((word) => word.length > 3 && !stopwords.includes(word));
            if (serviceWords.length >= 2) {
                const matchCount = serviceWords.filter((word) => lowerMessage.includes(word)).length;
                if (matchCount >= 2) {
                    detectionMethod = 'multi_word_match';
                    return true;
                }
            }
            // Single unique word match (only if service has one distinctive word)
            if (serviceWords.length === 1) {
                if (lowerMessage.includes(serviceWords[0])) {
                    detectionMethod = 'single_word_match';
                    return true;
                }
            }
            return false;
        });
        return { service: service || null, method: detectionMethod };
    }
    async generateReply(conversationId, messageHistory, currentMessage, intent, contactId, intentEntities) {
        try {
            const openai = await (0, openai_1.default)();
            const config = await BotConfigService_1.default.getConfig();
            // Check if auto-response is enabled
            if (!config.enable_auto_response) {
                console.log('🚫 Auto-response disabled in configuration');
                return config.fallback_message;
            }
            // Fetch contact's preferred language if contactId provided
            let contactLanguage = null;
            if (contactId) {
                const { data: contact } = await supabase_1.supabase
                    .from('contacts')
                    .select('preferred_language')
                    .eq('id', contactId)
                    .single();
                contactLanguage = contact?.preferred_language || null;
                console.log(`🌍 Contact language: ${contactLanguage || 'not set (using default)'}`);
            }
            // HALLUCINATION PREVENTION: Get REAL team member availability for booking requests
            let availabilityContext = '';
            if (intent === 'booking_request' && contactId) {
                const detectionStartTime = Date.now();
                let detectionMethod = 'none';
                let detectionSuccess = false;
                try {
                    const { BookingChatHandler } = await Promise.resolve().then(() => __importStar(require('./BookingChatHandler')));
                    const bookingHandler = new BookingChatHandler();
                    // Detect service from message or intent entities
                    const { data: services } = await supabase_1.supabase
                        .from('services')
                        .select('id, name')
                        .eq('is_active', true);
                    // Use extracted testable detection method
                    const detection = this.detectServiceFromMessage(currentMessage, services || [], intentEntities);
                    const serviceMentioned = detection.service;
                    detectionMethod = detection.method;
                    if (serviceMentioned && detectionMethod === 'intent_entity') {
                        console.log(`🎯 Service detected via intent entity: ${serviceMentioned.name}`);
                    }
                    const detectionTime = Date.now() - detectionStartTime;
                    if (serviceMentioned) {
                        detectionSuccess = true;
                        const availability = await bookingHandler.getServiceAvailability(serviceMentioned.id);
                        // PRODUCTION LOGGING: Track detection success
                        console.log(`📊 SERVICE DETECTION METRICS:`, {
                            contactId,
                            serviceName: serviceMentioned.name,
                            detectionMethod,
                            detectionTimeMs: detectionTime,
                            hasTeamMembers: availability.hasTeamMembers,
                            teamMemberCount: availability.teamMembers.length,
                            message: currentMessage.substring(0, 100), // First 100 chars for debugging
                        });
                        if (availability.hasTeamMembers) {
                            availabilityContext = `\n\n**FACTUAL TEAM MEMBER DATA (DO NOT INVENT NAMES):**\nAvailable team members for ${availability.serviceName}: ${availability.teamMembers.map(tm => `${tm.name} (${tm.role})`).join(', ')}.\n**CRITICAL:** Only mention these EXACT team member names. Do NOT make up or invent any other names.`;
                        }
                        else {
                            availabilityContext = `\n\n**IMPORTANT:** No team members are currently assigned to ${availability.serviceName}. Apologize and ask customer to contact us directly.`;
                        }
                    }
                    else {
                        // PRODUCTION LOGGING: Track detection failure
                        console.log(`⚠️ SERVICE DETECTION FAILED:`, {
                            contactId,
                            intent,
                            detectionTimeMs: detectionTime,
                            message: currentMessage.substring(0, 100),
                            availableServices: services?.map(s => s.name).join(', '),
                        });
                        // Fallback: General anti-hallucination instruction when service not detected
                        availabilityContext = `\n\n**CRITICAL RULE:** NEVER invent or make up team member names. Only mention team members if you have been explicitly provided with their names in this context.`;
                    }
                }
                catch (error) {
                    console.error('⚠️ Failed to fetch team member availability:', error);
                    // PRODUCTION LOGGING: Track errors
                    console.log(`❌ SERVICE DETECTION ERROR:`, {
                        contactId,
                        intent,
                        error: error instanceof Error ? error.message : String(error),
                        detectionMethod,
                        detectionSuccess,
                    });
                    // Fallback instruction even on error
                    availabilityContext = `\n\n**CRITICAL RULE:** NEVER invent or make up team member names. Only mention team members if you have been explicitly provided with their names in this context.`;
                }
            }
            // SOPHISTICATED SENTIMENT ANALYSIS: Analyze full conversation for escalation detection
            const sentiment = await this.analyzeConversationSentiment(conversationId, messageHistory, currentMessage);
            // Build dynamic system prompt with business details, fine-tuning, language context, AND customer analytics
            let systemPrompt = await BotConfigService_1.default.buildSystemPrompt(contactLanguage, contactId);
            // STRICT LANGUAGE ENFORCEMENT: Add explicit language directive based on customer preference
            const activeLanguage = contactLanguage || config.default_bot_language || 'de';
            const languageMap = {
                'de': 'German (Deutsch)',
                'en': 'English',
                'fr': 'French (Français)',
                'it': 'Italian (Italiano)',
                'es': 'Spanish (Español)',
                'pt': 'Portuguese (Português)'
            };
            const languageName = languageMap[activeLanguage] || 'German (Deutsch)';
            systemPrompt += `\n\n🌍 **CRITICAL LANGUAGE RULE - HIGHEST PRIORITY:**
You MUST respond EXCLUSIVELY in ${languageName} language.
- Customer language preference: ${languageName}
- Even if customer writes in another language, you MUST reply in ${languageName}
- If customer says "I don't understand English", respond IN ${languageName} that you will help them
- NEVER mix languages in your response
- This is a STRICT requirement - violations are unacceptable
`;
            // Append availability context to prevent hallucinations
            if (availabilityContext) {
                systemPrompt += availabilityContext;
            }
            // ENHANCED CONTEXT: Add sentiment and conversation quality insights
            if (sentiment.escalationRecommended || sentiment.frustrationLevel > 0.6 || sentiment.confusionLevel > 0.7) {
                systemPrompt += `\n\n⚠️ **CONVERSATION CONTEXT - ATTENTION REQUIRED:**
Current Sentiment: ${sentiment.overallSentiment} (score: ${sentiment.sentimentScore})
Frustration Level: ${(sentiment.frustrationLevel * 100).toFixed(0)}%
Confusion Level: ${(sentiment.confusionLevel * 100).toFixed(0)}%
Trend: ${sentiment.sentimentTrend}
${sentiment.keyIssues.length > 0 ? `Key Issues: ${sentiment.keyIssues.join(', ')}` : ''}
${sentiment.repeatedConcerns.length > 0 ? `Repeated Concerns: ${sentiment.repeatedConcerns.join(', ')}` : ''}

**ACTION REQUIRED:** Customer needs extra care. Be empathetic, address their concerns directly, and consider offering human assistance.`;
            }
            // EXPANDED CONTEXT WINDOW: 30 messages instead of 10 for better understanding
            const messages = [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                ...messageHistory.slice(-30).map(msg => ({
                    role: msg.direction === 'inbound' ? 'user' : 'assistant',
                    content: msg.content,
                })),
                {
                    role: 'user',
                    content: currentMessage,
                },
            ];
            console.log(`🤖 Generating GPT reply for conversation ${conversationId}`);
            console.log(`📝 Message history: ${messageHistory.length} messages (using last 30 for context)`);
            console.log(`⚙️  Tone: ${config.tone_of_voice}, Style: ${config.response_style}`);
            console.log(`🌍 Language: ${languageName} (STRICT enforcement enabled)`);
            console.log(`📊 Sentiment: ${sentiment.overallSentiment} (frustration: ${sentiment.frustrationLevel}, confusion: ${sentiment.confusionLevel})`);
            // CHECK FOR ESCALATION: Use sophisticated sentiment analysis instead of simple confidence
            if (sentiment.escalationRecommended) {
                console.log(`🚨 ESCALATION RECOMMENDED:`, sentiment.escalationReasons);
                // Mark conversation as requiring human attention
                try {
                    await supabase_1.supabase
                        .from('conversations')
                        .update({
                        escalation_status: 'pending',
                        escalation_reason: sentiment.escalationReasons.join('; '),
                        sentiment_score: sentiment.sentimentScore,
                        frustration_level: sentiment.frustrationLevel,
                        confusion_level: sentiment.confusionLevel,
                    })
                        .eq('id', conversationId);
                }
                catch (dbError) {
                    // Graceful degradation if sentiment columns don't exist yet
                    console.log('ℹ️ Could not save escalation status (columns may not exist yet):', dbError.message);
                }
            }
            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages,
                temperature: 0.7,
                max_tokens: config.max_response_length,
            });
            const reply = response.choices[0]?.message?.content || config.fallback_message;
            // LEGACY CONFIDENCE CHECK: Keep for backward compatibility but sentiment analysis is primary
            const confidence = this.estimateConfidence(reply, intent);
            if (config.require_approval_low_confidence && confidence < config.confidence_threshold) {
                console.log(`⚠️  Low confidence reply (${confidence}), may require approval`);
            }
            console.log(`✅ GPT reply generated (${reply.length} chars) - Language: ${languageName}`);
            // Save sentiment to database for persistence (graceful degradation if columns don't exist)
            try {
                await supabase_1.supabase
                    .from('conversations')
                    .update({
                    sentiment_score: sentiment.sentimentScore,
                    frustration_level: sentiment.frustrationLevel,
                    confusion_level: sentiment.confusionLevel,
                    last_sentiment_analysis: new Date(),
                })
                    .eq('id', conversationId);
            }
            catch (dbError) {
                // Graceful degradation if sentiment columns don't exist yet
                console.log('ℹ️ Could not save sentiment data (columns may not exist yet):', dbError.message);
            }
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
    estimateConfidence(reply, intent) {
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
    async detectLanguageChangeRequest(message) {
        try {
            const openai = await (0, openai_1.default)();
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
        }
        catch (error) {
            console.error('❌ Language detection error:', error);
            return { languageRequested: null, confidence: 0 };
        }
    }
    /**
     * Update contact's preferred language in database
     * @param contactId - Contact ID
     * @param languageCode - Language code (de, en, fr, it, etc.)
     * @param confirmed - Whether customer has explicitly confirmed this change
     */
    async updateContactLanguage(contactId, languageCode, confirmed = false) {
        try {
            const updateData = {
                preferred_language: languageCode,
                pending_language_change: null, // Clear pending state
            };
            if (confirmed) {
                updateData.language_confirmed = true;
                updateData.language_confirmation_date = new Date();
            }
            const { error } = await supabase_1.supabase
                .from('contacts')
                .update(updateData)
                .eq('id', contactId);
            if (error)
                throw error;
            console.log(`✅ Updated contact ${contactId} preferred language to: ${languageCode} (confirmed: ${confirmed})`);
        }
        catch (error) {
            console.error('❌ Failed to update contact language:', error);
            throw error;
        }
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
                }
                else {
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
    /**
     * Sophisticated sentiment analysis using full conversation history
     * Detects frustration, confusion, satisfaction trends, and recommends escalation
     */
    async analyzeConversationSentiment(conversationId, messageHistory, currentMessage) {
        try {
            const openai = await (0, openai_1.default)();
            // Build full conversation text for analysis
            const conversationMessages = messageHistory.slice(-20).map((msg, idx) => `[${msg.direction === 'inbound' ? 'CUSTOMER' : 'BOT'}]: ${msg.content}`).join('\n');
            const fullContext = currentMessage
                ? `${conversationMessages}\n[CUSTOMER]: ${currentMessage}`
                : conversationMessages;
            const sentimentPrompt = `You are an expert sentiment analyst for customer service conversations. Analyze this conversation comprehensively.

**CONVERSATION HISTORY** (last 20 messages):
${fullContext}

**ANALYSIS REQUIREMENTS**:

1. **Overall Sentiment**: Classify as positive, neutral, negative, frustrated, or confused
2. **Sentiment Score**: Rate from -1 (very negative) to +1 (very positive)
3. **Frustration Level**: 0-1 (detect anger, impatience, repeated complaints, escalating tone)
4. **Confusion Level**: 0-1 (detect misunderstandings, repeated questions, unclear responses, language barriers)
5. **Satisfaction Level**: 0-1 (detect happiness, gratitude, problem resolution)
6. **Sentiment Trend**: Is sentiment improving, stable, or declining over the conversation?
7. **Escalation Recommended**: Should this conversation be escalated to a human?
8. **Escalation Reasons**: Why should it be escalated? (e.g., "Customer frustrated after 3 booking attempts", "Language barrier causing confusion")
9. **Key Issues**: What are the main problems or concerns? (e.g., ["Booking confusion", "Payment issue"])
10. **Repeated Concerns**: What issues keep coming up? (e.g., ["Wants Monday 9am but not available", "Asking about Dr. Weber repeatedly"])
11. **Conversation Quality**: excellent, good, fair, or poor

**ESCALATION TRIGGERS** (recommend escalation if ANY apply):
- Customer explicitly frustrated or angry (strong language, capitalization, complaints)
- Same question/issue repeated 3+ times without resolution
- Booking process failing repeatedly (2+ failed attempts)
- Language barrier causing significant confusion
- Customer requesting human assistance
- Payment or billing disputes
- Medical/sensitive information mishandled
- Bot giving contradictory information

**RESPOND WITH JSON ONLY**:
{
  "overall_sentiment": "positive|neutral|negative|frustrated|confused",
  "sentiment_score": -1 to 1,
  "frustration_level": 0 to 1,
  "confusion_level": 0 to 1,
  "satisfaction_level": 0 to 1,
  "sentiment_trend": "improving|stable|declining",
  "escalation_recommended": boolean,
  "escalation_reasons": ["reason 1", "reason 2"],
  "key_issues": ["issue 1", "issue 2"],
  "repeated_concerns": ["concern 1"],
  "conversation_quality": "excellent|good|fair|poor"
}`;
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: sentimentPrompt,
                    },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.3, // Lower temperature for more consistent analysis
            });
            const analysis = JSON.parse(response.choices[0]?.message?.content || '{}');
            console.log(`📊 SENTIMENT ANALYSIS for conversation ${conversationId}:`, {
                sentiment: analysis.overall_sentiment,
                score: analysis.sentiment_score,
                frustration: analysis.frustration_level,
                confusion: analysis.confusion_level,
                trend: analysis.sentiment_trend,
                shouldEscalate: analysis.escalation_recommended,
                reasons: analysis.escalation_reasons
            });
            return {
                overallSentiment: analysis.overall_sentiment || 'neutral',
                sentimentScore: analysis.sentiment_score || 0,
                frustrationLevel: analysis.frustration_level || 0,
                confusionLevel: analysis.confusion_level || 0,
                satisfactionLevel: analysis.satisfaction_level || 0.5,
                sentimentTrend: analysis.sentiment_trend || 'stable',
                escalationRecommended: analysis.escalation_recommended || false,
                escalationReasons: analysis.escalation_reasons || [],
                keyIssues: analysis.key_issues || [],
                repeatedConcerns: analysis.repeated_concerns || [],
                conversationQuality: analysis.conversation_quality || 'good',
            };
        }
        catch (error) {
            console.error('❌ Sentiment analysis error:', error.message);
            // Return safe defaults on error
            return {
                overallSentiment: 'neutral',
                sentimentScore: 0,
                frustrationLevel: 0,
                confusionLevel: 0,
                satisfactionLevel: 0.5,
                sentimentTrend: 'stable',
                escalationRecommended: false,
                escalationReasons: [],
                keyIssues: [],
                repeatedConcerns: [],
                conversationQuality: 'fair',
            };
        }
    }
    /**
     * Personalize a template message through GPT with proper language and context
     * This ensures ALL outbound messages (email prompts, confirmations, nurturing, etc.)
     * are natural, language-appropriate, and conversation-aware
     */
    async personalizeMessage(params) {
        try {
            const openai = await (0, openai_1.default)();
            const config = await BotConfigService_1.default.getConfig();
            // Get contact's preferred language
            let contactLanguage = null;
            if (params.contactId) {
                const { data: contact } = await supabase_1.supabase
                    .from('contacts')
                    .select('preferred_language')
                    .eq('id', params.contactId)
                    .single();
                contactLanguage = contact?.preferred_language || null;
            }
            const activeLanguage = contactLanguage || config.default_bot_language || 'de';
            const languageMap = {
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
        }
        catch (error) {
            console.error('❌ Message personalization error:', error.message);
            // Fallback to template if personalization fails
            return params.templateMessage;
        }
    }
}
exports.AIService = AIService;
exports.default = new AIService();
