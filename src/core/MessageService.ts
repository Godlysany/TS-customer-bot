import { supabase } from '../infrastructure/supabase';
import { Message, Conversation } from '../types';
import { toSnakeCase, toCamelCase, toCamelCaseArray } from '../infrastructure/mapper';

export class MessageService {
  async createMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const payload = toSnakeCase({
      ...message,
      timestamp: new Date().toISOString(),
    });

    const { data, error } = await supabase
      .from('messages')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return toCamelCase(data) as Message;
  }

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    return toCamelCaseArray(data || []) as Message[];
  }

  async updateConversationLastMessage(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (error) throw error;
  }
}

export default new MessageService();
