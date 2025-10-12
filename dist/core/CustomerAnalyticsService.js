"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerAnalyticsService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
const openai_1 = __importDefault(require("../infrastructure/openai"));
class CustomerAnalyticsService {
    async analyzeCustomerSentiment(contactId, recentMessages) {
        const messagesText = recentMessages.join('\n');
        try {
            const openai = await (0, openai_1.default)();
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'Analyze customer sentiment from messages. Return a score from -1 (very negative) to 1 (very positive). Respond with JSON: {"sentiment": 0.5}'
                    },
                    { role: 'user', content: messagesText }
                ],
                response_format: { type: 'json_object' }
            });
            const result = JSON.parse(response.choices[0]?.message?.content || '{"sentiment":0}');
            return result.sentiment;
        }
        catch (error) {
            console.error('Sentiment analysis failed:', error);
            return 0;
        }
    }
    async extractKeywords(messages) {
        const messagesText = messages.join(' ').toLowerCase();
        const words = messagesText.split(/\W+/);
        const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as']);
        const keywords = {};
        words.forEach(word => {
            if (word.length > 3 && !stopWords.has(word)) {
                keywords[word] = (keywords[word] || 0) + 1;
            }
        });
        const sortedKeywords = Object.entries(keywords)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});
        return sortedKeywords;
    }
    async calculateUpsellPotential(contactId) {
        const { data: messages } = await supabase_1.supabase
            .from('messages')
            .select('content')
            .eq('sender', contactId)
            .order('timestamp', { ascending: false })
            .limit(20);
        if (!messages || messages.length < 5)
            return 'low';
        const messageTexts = messages.map(m => m.content).join(' ').toLowerCase();
        const highValueKeywords = ['upgrade', 'premium', 'enterprise', 'more features', 'advanced'];
        const mediumValueKeywords = ['interested', 'pricing', 'plans', 'options', 'comparison'];
        const hasHighValue = highValueKeywords.some(kw => messageTexts.includes(kw));
        const hasMediumValue = mediumValueKeywords.some(kw => messageTexts.includes(kw));
        if (hasHighValue)
            return 'high';
        if (hasMediumValue)
            return 'medium';
        return 'low';
    }
    async updateCustomerAnalytics(contactId) {
        const { data: messages } = await supabase_1.supabase
            .from('messages')
            .select('*')
            .eq('sender', contactId)
            .order('timestamp', { ascending: false })
            .limit(50);
        if (!messages || messages.length === 0)
            return;
        const messageContents = messages.map(m => m.content);
        const sentiment = await this.analyzeCustomerSentiment(contactId, messageContents);
        const keywords = await this.extractKeywords(messageContents);
        const upsellPotential = await this.calculateUpsellPotential(contactId);
        const { data: bookings } = await supabase_1.supabase
            .from('bookings')
            .select('*')
            .eq('contact_id', contactId)
            .order('start_time', { ascending: false });
        const analyticsData = {
            contact_id: contactId,
            sentiment_score: sentiment,
            upsell_potential: upsellPotential,
            keywords: keywords,
            total_appointments: bookings?.length || 0,
            last_appointment_at: bookings?.[0]?.start_time || null,
            total_messages: messages.length,
            updated_at: new Date().toISOString()
        };
        const { error } = await supabase_1.supabase
            .from('customer_analytics')
            .upsert(analyticsData, { onConflict: 'contact_id' });
        if (error)
            throw error;
    }
    async getCustomerAnalytics(contactId) {
        const { data, error } = await supabase_1.supabase
            .from('customer_analytics')
            .select('*')
            .eq('contact_id', contactId)
            .single();
        if (error)
            return null;
        return (0, mapper_1.toCamelCase)(data);
    }
}
exports.CustomerAnalyticsService = CustomerAnalyticsService;
exports.default = new CustomerAnalyticsService();
