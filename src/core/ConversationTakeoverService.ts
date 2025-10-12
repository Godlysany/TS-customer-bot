import { supabase } from '../infrastructure/supabase';
import { toCamelCase } from '../infrastructure/mapper';

export type TakeoverType = 'pause_bot' | 'write_between' | 'full_control';

export class ConversationTakeoverService {
  async startTakeover(
    conversationId: string,
    agentId: string,
    type: TakeoverType,
    notes?: string
  ): Promise<void> {
    await this.endActiveTakeover(conversationId);

    const { error } = await supabase
      .from('conversation_takeovers')
      .insert({
        conversation_id: conversationId,
        agent_id: agentId,
        takeover_type: type,
        is_active: true,
        started_at: new Date().toISOString(),
        notes
      });

    if (error) throw error;
  }

  async endTakeover(conversationId: string): Promise<void> {
    await this.endActiveTakeover(conversationId);
  }

  async endActiveTakeover(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('conversation_takeovers')
      .update({
        is_active: false,
        ended_at: new Date().toISOString()
      })
      .eq('conversation_id', conversationId)
      .eq('is_active', true);

    if (error) throw error;
  }

  async getActiveTakeover(conversationId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('conversation_takeovers')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_active', true)
      .single();

    if (error) return null;
    return toCamelCase(data);
  }

  async isConversationPaused(conversationId: string): Promise<boolean> {
    const takeover = await this.getActiveTakeover(conversationId);
    return takeover !== null && (takeover.takeoverType === 'pause_bot' || takeover.takeoverType === 'full_control');
  }

  async canBotReply(conversationId: string): Promise<boolean> {
    const takeover = await this.getActiveTakeover(conversationId);
    
    if (!takeover) return true;
    
    if (takeover.takeoverType === 'write_between') return true;
    
    return false;
  }
}

export default new ConversationTakeoverService();
