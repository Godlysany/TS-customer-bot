import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toCamelCaseArray } from '../infrastructure/mapper';

interface Escalation {
  id: string;
  conversationId: string;
  agentId?: string;
  reason?: string;
  status: 'pending' | 'in_progress' | 'resolved';
  createdAt: Date;
  updatedAt: Date;
}

interface EscalationWithDetails extends Escalation {
  conversation: {
    id: string;
    contact: {
      id: string;
      name: string;
      phoneNumber: string;
    };
    lastMessage: string;
    lastMessageAt: Date;
  };
  agent?: {
    id: string;
    username: string;
    fullName: string;
  };
}

export class EscalationService {
  /**
   * Get all escalations with optional filtering
   */
  async getEscalations(filters?: {
    status?: 'pending' | 'in_progress' | 'resolved';
    agentId?: string;
  }): Promise<EscalationWithDetails[]> {
    try {
      let query = supabase
        .from('escalations')
        .select(`
          *,
          conversation:conversations!inner(
            id,
            last_message,
            last_message_at,
            contact:contacts!inner(
              id,
              name,
              phone_number
            )
          ),
          agent:agents(
            id,
            username,
            full_name
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

      if (error) throw error;

      return toCamelCaseArray(data || []) as EscalationWithDetails[];
    } catch (error: any) {
      console.error('Error fetching escalations:', error);
      throw error;
    }
  }

  /**
   * Get a single escalation by ID
   */
  async getEscalationById(id: string): Promise<EscalationWithDetails | null> {
    try {
      const { data, error } = await supabase
        .from('escalations')
        .select(`
          *,
          conversation:conversations!inner(
            id,
            last_message,
            last_message_at,
            contact:contacts!inner(
              id,
              name,
              phone_number
            )
          ),
          agent:agents(
            id,
            username,
            full_name
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return toCamelCase(data) as EscalationWithDetails;
    } catch (error: any) {
      console.error(`Error fetching escalation ${id}:`, error);
      return null;
    }
  }

  /**
   * Create a new escalation
   */
  async createEscalation(conversationId: string, reason?: string): Promise<Escalation> {
    try {
      // Check if escalation already exists for this conversation
      const { data: existing, error: checkError } = await supabase
        .from('escalations')
        .select('id, status')
        .eq('conversation_id', conversationId)
        .in('status', ['pending', 'in_progress'])
        .limit(1)
        .single();

      // If we found an existing escalation, return it
      if (existing && !checkError) {
        console.log(`Escalation already exists for conversation ${conversationId}`);
        return toCamelCase(existing) as Escalation;
      }

      // Only throw if error is NOT "no rows found" (PGRST116)
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      // No existing escalation found, create new one
      const { data, error } = await supabase
        .from('escalations')
        .insert({
          conversation_id: conversationId,
          reason,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Escalation created for conversation ${conversationId}`);
      return toCamelCase(data) as Escalation;
    } catch (error: any) {
      console.error('Error creating escalation:', error);
      throw error;
    }
  }

  /**
   * Assign an escalation to an agent
   */
  async assignEscalation(escalationId: string, agentId: string): Promise<Escalation> {
    try {
      const { data, error } = await supabase
        .from('escalations')
        .update({
          agent_id: agentId,
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', escalationId)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Escalation ${escalationId} assigned to agent ${agentId}`);
      return toCamelCase(data) as Escalation;
    } catch (error: any) {
      console.error('Error assigning escalation:', error);
      throw error;
    }
  }

  /**
   * Update escalation status
   */
  async updateEscalationStatus(
    escalationId: string,
    status: 'pending' | 'in_progress' | 'resolved'
  ): Promise<Escalation> {
    try {
      const { data, error } = await supabase
        .from('escalations')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', escalationId)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Escalation ${escalationId} status updated to ${status}`);
      return toCamelCase(data) as Escalation;
    } catch (error: any) {
      console.error('Error updating escalation status:', error);
      throw error;
    }
  }

  /**
   * Resolve an escalation
   */
  async resolveEscalation(escalationId: string): Promise<Escalation> {
    return this.updateEscalationStatus(escalationId, 'resolved');
  }

  /**
   * Get escalation counts by status
   */
  async getEscalationCounts(): Promise<{
    pending: number;
    in_progress: number;
    resolved: number;
    total: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('escalations')
        .select('status');

      if (error) throw error;

      const counts = {
        pending: 0,
        in_progress: 0,
        resolved: 0,
        total: data?.length || 0,
      };

      data?.forEach((escalation: any) => {
        if (escalation.status === 'pending') counts.pending++;
        else if (escalation.status === 'in_progress') counts.in_progress++;
        else if (escalation.status === 'resolved') counts.resolved++;
      });

      return counts;
    } catch (error: any) {
      console.error('Error getting escalation counts:', error);
      return { pending: 0, in_progress: 0, resolved: 0, total: 0 };
    }
  }
}

export default new EscalationService();
