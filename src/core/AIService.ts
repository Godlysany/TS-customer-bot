import getOpenAIClient from '../infrastructure/openai';
import { supabase } from '../infrastructure/supabase';
import { Message } from '../types';

export class AIService {
  async generateReply(conversationId: string, messageHistory: Message[], currentMessage: string): Promise<string> {
    try {
      const openai = await getOpenAIClient();
      
      const { data: activePrompt } = await supabase
        .from('prompts')
        .select('*')
        .eq('is_active', true)
        .single();

      if (!activePrompt) {
        console.error('❌ No active prompt configuration found');
        throw new Error('No active prompt configuration found');
      }

      const messages = [
        {
          role: 'system' as const,
          content: `${activePrompt.system_prompt}\n\nBusiness Context:\n${activePrompt.business_context}`,
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
      
      const response = await openai.chat.completions.create({
        model: activePrompt.model || 'gpt-4o',
        messages,
        temperature: activePrompt.temperature || 0.7,
        max_tokens: 500,
      });

      const reply = response.choices[0]?.message?.content || 'I apologize, I could not generate a response.';
      console.log(`✅ GPT reply generated (${reply.length} chars)`);
      
      return reply;
    } catch (error: any) {
      console.error('❌ GPT Error:', error.message);
      console.error('Stack:', error.stack);
      throw error;
    }
  }

  async detectIntent(message: string): Promise<{ intent: string; confidence: number; entities?: Record<string, any> }> {
    const openai = await getOpenAIClient();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an intent classifier. Analyze the user message and determine their intent.
Possible intents: greeting, booking_request, booking_modify, booking_cancel, question, complaint, other.
Respond with JSON: { "intent": "intent_name", "confidence": 0-1, "entities": {} }`,
        },
        { role: 'user', content: message },
      ],
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0]?.message?.content || '{"intent":"other","confidence":0}');
  }
}

export default new AIService();
