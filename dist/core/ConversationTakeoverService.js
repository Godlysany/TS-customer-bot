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
        // Check for manual takeover first
        const takeover = await this.getActiveTakeover(conversationId);
        if (takeover) {
            // write_between allows bot to reply alongside agent
            if (takeover.takeoverType === 'write_between')
                return true;
            // pause_bot and full_control block bot replies
            return false;
        }
        // Check for active escalations with pause_bot enabled
        try {
            const { data: escalation, error } = await supabase_1.supabase
                .from('escalations')
                .select('id, status')
                .eq('conversation_id', conversationId)
                .in('status', ['pending', 'in_progress'])
                .limit(1)
                .single();
            if (escalation && !error) {
                // Get bot config to check if pause_bot is enabled for escalations
                const { data: settings } = await supabase_1.supabase
                    .from('settings')
                    .select('value')
                    .eq('category', 'bot_config')
                    .eq('key', 'escalation_config')
                    .single();
                if (settings?.value) {
                    const config = typeof settings.value === 'string'
                        ? JSON.parse(settings.value)
                        : settings.value;
                    if (config.behavior?.pause_bot) {
                        console.log(`⏸️  Bot paused for conversation ${conversationId} due to active escalation with pause_bot enabled`);
                        return false; // Block bot replies when escalation is active and pause_bot is true
                    }
                }
            }
        }
        catch (escalationError) {
            // If escalation check fails, allow bot to reply (fail open)
            console.error('Error checking escalation status:', escalationError.message);
        }
        return true; // No takeover or escalation blocking - bot can reply
    }
}
exports.ConversationTakeoverService = ConversationTakeoverService;
exports.default = new ConversationTakeoverService();
