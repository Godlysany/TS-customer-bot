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

  async markAsSending(messageId: string): Promise<boolean> {
    // Atomic update: only succeeds if message is still pending_approval
    const { data, error } = await supabase
      .from('messages')
      .update({
        approval_status: 'sending',
      })
      .eq('id', messageId)
      .eq('approval_status', 'pending_approval')
      .select()
      .single();

    if (error) return false;
    return !!data;
  }

  async approveMessage(messageId: string, agentId: string): Promise<Message> {
    const { data, error} = await supabase
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

  async rollbackToPending(messageId: string): Promise<void> {
    await supabase
      .from('messages')
      .update({
        approval_status: 'pending_approval',
      })
      .eq('id', messageId);
  }

  async markAsDelivered(messageId: string, whatsappMessageId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({
        whatsapp_message_id: whatsappMessageId,
      })
      .eq('id', messageId);

    if (error) {
      throw new Error(`Failed to persist WhatsApp message ID: ${error.message}`);
    }
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
