"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const openai_1 = __importDefault(require("../infrastructure/openai"));
const supabase_1 = require("../infrastructure/supabase");
class AIService {
    async generateReply(conversationId, messageHistory, currentMessage) {
        const openai = await (0, openai_1.default)();
        const { data: activePrompt } = await supabase_1.supabase
            .from('prompts')
            .select('*')
            .eq('is_active', true)
            .single();
        if (!activePrompt) {
            throw new Error('No active prompt configuration found');
        }
        const messages = [
            {
                role: 'system',
                content: `${activePrompt.system_prompt}\n\nBusiness Context:\n${activePrompt.business_context}`,
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
        const response = await openai.chat.completions.create({
            model: activePrompt.model || 'gpt-4o',
            messages,
            temperature: activePrompt.temperature || 0.7,
            max_tokens: 500,
        });
        return response.choices[0]?.message?.content || 'I apologize, I could not generate a response.';
    }
    async detectIntent(message) {
        const openai = await (0, openai_1.default)();
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
exports.AIService = AIService;
exports.default = new AIService();
