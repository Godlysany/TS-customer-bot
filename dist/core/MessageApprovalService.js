"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageApprovalService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
class MessageApprovalService {
    async getPendingMessages() {
        const { data, error } = await supabase_1.supabase
            .from('messages')
            .select(`
        *,
        conversation:conversations!inner(
          id,
          contact:contacts!inner(
            id,
            phone_number,
            name
          )
        )
      `)
            .eq('approval_status', 'pending_approval')
            .eq('direction', 'outbound')
            .order('timestamp', { ascending: false });
        if (error)
            throw error;
        return (0, mapper_1.toCamelCaseArray)(data || []);
    }
    async markAsSending(messageId) {
        // Atomic update: only succeeds if message is still pending_approval
        const { data, error } = await supabase_1.supabase
            .from('messages')
            .update({
            approval_status: 'sending',
        })
            .eq('id', messageId)
            .eq('approval_status', 'pending_approval')
            .select()
            .single();
        if (error)
            return false;
        return !!data;
    }
    async approveMessage(messageId, agentId) {
        const { data, error } = await supabase_1.supabase
            .from('messages')
            .update({
            approval_status: 'approved',
            approved_by: agentId,
            approved_at: new Date().toISOString(),
        })
            .eq('id', messageId)
            .select()
            .single();
        if (error)
            throw error;
        return (0, mapper_1.toCamelCase)(data);
    }
    async rollbackToPending(messageId) {
        await supabase_1.supabase
            .from('messages')
            .update({
            approval_status: 'pending_approval',
        })
            .eq('id', messageId);
    }
    async rejectMessage(messageId, agentId) {
        const { data, error } = await supabase_1.supabase
            .from('messages')
            .update({
            approval_status: 'rejected',
            approved_by: agentId,
            approved_at: new Date().toISOString(),
        })
            .eq('id', messageId)
            .select()
            .single();
        if (error)
            throw error;
        return (0, mapper_1.toCamelCase)(data);
    }
    async getMessageById(messageId) {
        const { data, error } = await supabase_1.supabase
            .from('messages')
            .select('*')
            .eq('id', messageId)
            .single();
        if (error)
            return null;
        return (0, mapper_1.toCamelCase)(data);
    }
}
exports.MessageApprovalService = MessageApprovalService;
exports.default = new MessageApprovalService();
