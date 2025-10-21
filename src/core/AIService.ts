import getOpenAIClient from '../infrastructure/openai';
import { supabase } from '../infrastructure/supabase';
import { Message } from '../types';
import botConfigService from './BotConfigService';

export class AIService {
  async generateReply(conversationId: string, messageHistory: Message[], currentMessage: string): Promise<string> {
    try {
      const openai = await getOpenAIClient();
      const config = await botConfigService.getConfig();

      // Check if auto-response is enabled
      if (!config.enable_auto_response) {
        console.log('🚫 Auto-response disabled in configuration');
        return config.fallback_message;
      }

      // Build dynamic system prompt with business details and fine-tuning
      const systemPrompt = await botConfigService.buildSystemPrompt();

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
      
      // Check confidence and escalate if needed
      const confidence = this.estimateConfidence(reply);
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

  private estimateConfidence(reply: string): number {
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
}

export default new AIService();
