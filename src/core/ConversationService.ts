import { supabase } from '../infrastructure/supabase';
import { Conversation, Contact } from '../types';
import { toSnakeCase, toCamelCase } from '../infrastructure/mapper';

export class ConversationService {
  async getOrCreateConversation(phoneNumber: string, whatsappName?: string | null): Promise<{ conversation: Conversation; contact: Contact }> {
    let { data: contactData } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    let contact: Contact;
    if (!contactData) {
      const { data: newContact, error } = await supabase
        .from('contacts')
        .insert({ 
          phone_number: phoneNumber, 
          name: whatsappName || null,
          created_at: new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        })
        .select()
        .single();
      
      if (error) throw error;
      contact = toCamelCase(newContact) as Contact;
    } else {
      contact = toCamelCase(contactData) as Contact;
      
      // Update contact name if WhatsApp name is provided and contact name is empty
      if (whatsappName && !contact.name) {
        const { data: updatedContact } = await supabase
          .from('contacts')
          .update({ name: whatsappName, updated_at: new Date().toISOString() })
          .eq('id', contact.id)
          .select()
          .single();
        
        if (updatedContact) {
          contact = toCamelCase(updatedContact) as Contact;
        }
      }
    }

    let { data: conversationData } = await supabase
      .from('conversations')
      .select('*')
      .eq('contact_id', contact.id)
      .eq('status', 'active')
      .single();

    let conversation: Conversation;
    if (!conversationData) {
      const { data: newConversation, error } = await supabase
        .from('conversations')
        .insert({
          contact_id: contact.id,
          status: 'active',
          last_message_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      conversation = toCamelCase(newConversation) as Conversation;
    } else {
      conversation = toCamelCase(conversationData) as Conversation;
    }

    return { conversation, contact };
  }

  async updateConversationStatus(conversationId: string, status: 'active' | 'resolved' | 'escalated'): Promise<void> {
    const { error } = await supabase
      .from('conversations')
      .update({ status })
      .eq('id', conversationId);

    if (error) throw error;
  }

  async assignAgent(conversationId: string, agentId: string): Promise<void> {
    const { error } = await supabase
      .from('conversations')
      .update({ assigned_agent_id: agentId })
      .eq('id', conversationId);

    if (error) throw error;
  }
}

export default new ConversationService();
