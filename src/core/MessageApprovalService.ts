import { supabase } from '../infrastructure/supabase';
import { Message } from '../types';
import { toCamelCase, toCamelCaseArray } from '../infrastructure/mapper';

export class MessageApprovalService {
  async getPendingMessages(): Promise<Message[]> {
    const { data, error } = await supabase
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

    if (error) throw error;
    return toCamelCaseArray(data || []) as Message[];
  }

  async approveMessage(messageId: string, agentId: string): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .update({
        approval_status: 'approved',
        approved_by: agentId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;
    return toCamelCase(data) as Message;
  }

  async rejectMessage(messageId: string, agentId: string): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .update({
        approval_status: 'rejected',
        approved_by: agentId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;
    return toCamelCase(data) as Message;
  }

  async getMessageById(messageId: string): Promise<Message | null> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (error) return null;
    return toCamelCase(data) as Message;
  }
}

export default new MessageApprovalService();
