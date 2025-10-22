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
    // Check for manual takeover first
    const takeover = await this.getActiveTakeover(conversationId);
    
    if (takeover) {
      // write_between allows bot to reply alongside agent
      if (takeover.takeoverType === 'write_between') return true;
      // pause_bot and full_control block bot replies
      return false;
    }
    
    // Check for active escalations with pause_bot enabled
    try {
      const { data: escalation, error } = await supabase
        .from('escalations')
        .select('id, status')
        .eq('conversation_id', conversationId)
        .in('status', ['pending', 'in_progress'])
        .limit(1)
        .single();
      
      if (escalation && !error) {
        // Get bot config to check if pause_bot is enabled for escalations
        const { data: settings } = await supabase
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
    } catch (escalationError: any) {
      // If escalation check fails, allow bot to reply (fail open)
      console.error('Error checking escalation status:', escalationError.message);
    }
    
    return true; // No takeover or escalation blocking - bot can reply
  }
}

export default new ConversationTakeoverService();
