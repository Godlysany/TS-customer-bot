"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationTakeoverService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
class ConversationTakeoverService {
    async startTakeover(conversationId, agentId, type, notes) {
        await this.endActiveTakeover(conversationId);
        const { error } = await supabase_1.supabase
            .from('conversation_takeovers')
            .insert({
            conversation_id: conversationId,
            agent_id: agentId,
            takeover_type: type,
            is_active: true,
            started_at: new Date().toISOString(),
            notes
        });
        if (error)
            throw error;
    }
    async endTakeover(conversationId) {
        await this.endActiveTakeover(conversationId);
    }
    async endActiveTakeover(conversationId) {
        const { error } = await supabase_1.supabase
            .from('conversation_takeovers')
            .update({
            is_active: false,
            ended_at: new Date().toISOString()
        })
            .eq('conversation_id', conversationId)
            .eq('is_active', true);
        if (error)
            throw error;
    }
    async getActiveTakeover(conversationId) {
        const { data, error } = await supabase_1.supabase
            .from('conversation_takeovers')
            .select('*')
            .eq('conversation_id', conversationId)
            .eq('is_active', true)
            .single();
        if (error)
            return null;
        return (0, mapper_1.toCamelCase)(data);
    }
    async isConversationPaused(conversationId) {
        const takeover = await this.getActiveTakeover(conversationId);
        return takeover !== null && (takeover.takeoverType === 'pause_bot' || takeover.takeoverType === 'full_control');
    }
    async canBotReply(conversationId) {
        const takeover = await this.getActiveTakeover(conversationId);
        if (!takeover)
            return true;
        if (takeover.takeoverType === 'write_between')
            return true;
        return false;
    }
}
exports.ConversationTakeoverService = ConversationTakeoverService;
exports.default = new ConversationTakeoverService();
