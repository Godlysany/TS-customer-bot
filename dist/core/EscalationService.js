"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscalationService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
class EscalationService {
    /**
     * Get all escalations with optional filtering
     */
    async getEscalations(filters) {
        try {
            // Try with sentiment columns first (post-migration)
            try {
                let query = supabase_1.supabase
                    .from('escalations')
                    .select(`
            *,
            conversation:conversations!inner(
              id,
              last_message_at,
              sentiment_score,
              frustration_level,
              confusion_level,
              sentiment_trend,
              contact:contacts!inner(
                id,
                name,
                phone_number
              )
            ),
            agent:agents(
              id,
              name,
              email
            )
          `)
                    .order('created_at', { ascending: false });
                if (filters?.status) {
                    query = query.eq('status', filters.status);
                }
                if (filters?.agentId) {
                    query = query.eq('agent_id', filters.agentId);
                }
                const { data, error } = await query;
                if (error && !error.message.includes('column') && !error.code?.startsWith('42')) {
                    throw error;
                }
                if (data) {
                    return (0, mapper_1.toCamelCaseArray)(data);
                }
            }
            catch (err) {
                console.log('ℹ️ Sentiment columns not available, falling back to basic query');
            }
            // Fallback query without sentiment columns (pre-migration)
            let fallbackQuery = supabase_1.supabase
                .from('escalations')
                .select(`
          *,
          conversation:conversations!inner(
            id,
            last_message_at,
            contact:contacts!inner(
              id,
              name,
              phone_number
            )
          ),
          agent:agents(
            id,
            name,
            email
          )
        `)
                .order('created_at', { ascending: false });
            if (filters?.status) {
                fallbackQuery = fallbackQuery.eq('status', filters.status);
            }
            if (filters?.agentId) {
                fallbackQuery = fallbackQuery.eq('agent_id', filters.agentId);
            }
            const { data, error } = await fallbackQuery;
            if (error)
                throw error;
            return (0, mapper_1.toCamelCaseArray)(data || []);
        }
        catch (error) {
            console.error('Error fetching escalations:', error);
            throw error;
        }
    }
    /**
     * Get a single escalation by ID
     */
    async getEscalationById(id) {
        try {
            const { data, error } = await supabase_1.supabase
                .from('escalations')
                .select(`
          *,
          conversation:conversations!inner(
            id,
            last_message_at,
            contact:contacts!inner(
              id,
              name,
              phone_number
            )
          ),
          agent:agents(
            id,
            name,
            email
          )
        `)
                .eq('id', id)
                .single();
            if (error)
                throw error;
            return (0, mapper_1.toCamelCase)(data);
        }
        catch (error) {
            console.error(`Error fetching escalation ${id}:`, error);
            return null;
        }
    }
    /**
     * Create a new escalation
     */
    async createEscalation(conversationId, reason) {
        try {
            // Check if escalation already exists for this conversation
            const { data: existing, error: checkError } = await supabase_1.supabase
                .from('escalations')
                .select('id, status')
                .eq('conversation_id', conversationId)
                .in('status', ['pending', 'in_progress'])
                .limit(1)
                .single();
            // If we found an existing escalation, return it
            if (existing && !checkError) {
                console.log(`Escalation already exists for conversation ${conversationId}`);
                return (0, mapper_1.toCamelCase)(existing);
            }
            // Only throw if error is NOT "no rows found" (PGRST116)
            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }
            // No existing escalation found, create new one
            const { data, error } = await supabase_1.supabase
                .from('escalations')
                .insert({
                conversation_id: conversationId,
                reason,
                status: 'pending',
            })
                .select()
                .single();
            if (error)
                throw error;
            console.log(`✅ Escalation created for conversation ${conversationId}`);
            return (0, mapper_1.toCamelCase)(data);
        }
        catch (error) {
            console.error('Error creating escalation:', error);
            throw error;
        }
    }
    /**
     * Assign an escalation to an agent
     */
    async assignEscalation(escalationId, agentId) {
        try {
            const { data, error } = await supabase_1.supabase
                .from('escalations')
                .update({
                agent_id: agentId,
                status: 'in_progress',
                updated_at: new Date().toISOString(),
            })
                .eq('id', escalationId)
                .select()
                .single();
            if (error)
                throw error;
            console.log(`✅ Escalation ${escalationId} assigned to agent ${agentId}`);
            return (0, mapper_1.toCamelCase)(data);
        }
        catch (error) {
            console.error('Error assigning escalation:', error);
            throw error;
        }
    }
    /**
     * Update escalation status
     */
    async updateEscalationStatus(escalationId, status) {
        try {
            const { data, error } = await supabase_1.supabase
                .from('escalations')
                .update({
                status,
                updated_at: new Date().toISOString(),
            })
                .eq('id', escalationId)
                .select()
                .single();
            if (error)
                throw error;
            console.log(`✅ Escalation ${escalationId} status updated to ${status}`);
            return (0, mapper_1.toCamelCase)(data);
        }
        catch (error) {
            console.error('Error updating escalation status:', error);
            throw error;
        }
    }
    /**
     * Resolve an escalation
     */
    async resolveEscalation(escalationId) {
        return this.updateEscalationStatus(escalationId, 'resolved');
    }
    /**
     * Get escalation counts by status
     */
    async getEscalationCounts() {
        try {
            const { data, error } = await supabase_1.supabase
                .from('escalations')
                .select('status');
            if (error)
                throw error;
            const counts = {
                pending: 0,
                in_progress: 0,
                resolved: 0,
                total: data?.length || 0,
            };
            data?.forEach((escalation) => {
                if (escalation.status === 'pending')
                    counts.pending++;
                else if (escalation.status === 'in_progress')
                    counts.in_progress++;
                else if (escalation.status === 'resolved')
                    counts.resolved++;
            });
            return counts;
        }
        catch (error) {
            console.error('Error getting escalation counts:', error);
            return { pending: 0, in_progress: 0, resolved: 0, total: 0 };
        }
    }
}
exports.EscalationService = EscalationService;
exports.default = new EscalationService();
