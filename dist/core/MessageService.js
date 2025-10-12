"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
class MessageService {
    async createMessage(message) {
        const payload = (0, mapper_1.toSnakeCase)({
            ...message,
            timestamp: new Date().toISOString(),
        });
        const { data, error } = await supabase_1.supabase
            .from('messages')
            .insert(payload)
            .select()
            .single();
        if (error)
            throw error;
        return (0, mapper_1.toCamelCase)(data);
    }
    async getConversationMessages(conversationId) {
        const { data, error } = await supabase_1.supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('timestamp', { ascending: true });
        if (error)
            throw error;
        return (0, mapper_1.toCamelCaseArray)(data || []);
    }
    async updateConversationLastMessage(conversationId) {
        const { error } = await supabase_1.supabase
            .from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversationId);
        if (error)
            throw error;
    }
}
exports.MessageService = MessageService;
exports.default = new MessageService();
