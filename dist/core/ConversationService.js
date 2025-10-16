"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
class ConversationService {
    async getOrCreateConversation(phoneNumber, whatsappName) {
        const resolvedName = whatsappName?.trim() || phoneNumber;
        let { data: contactData } = await supabase_1.supabase
            .from('contacts')
            .select('*')
            .eq('phone_number', phoneNumber)
            .single();
        let contact;
        if (!contactData) {
            const { data: newContact, error } = await supabase_1.supabase
                .from('contacts')
                .insert({
                phone_number: phoneNumber,
                name: resolvedName,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
                .select()
                .single();
            if (error)
                throw error;
            contact = (0, mapper_1.toCamelCase)(newContact);
        }
        else {
            contact = (0, mapper_1.toCamelCase)(contactData);
            // Update contact name if WhatsApp name is provided and contact name is phone number or empty
            if (whatsappName && (!contact.name || contact.name === phoneNumber)) {
                const { data: updatedContact } = await supabase_1.supabase
                    .from('contacts')
                    .update({ name: resolvedName, updated_at: new Date().toISOString() })
                    .eq('id', contact.id)
                    .select()
                    .single();
                if (updatedContact) {
                    contact = (0, mapper_1.toCamelCase)(updatedContact);
                }
            }
        }
        let { data: conversationData } = await supabase_1.supabase
            .from('conversations')
            .select('*')
            .eq('contact_id', contact.id)
            .eq('status', 'active')
            .single();
        let conversation;
        if (!conversationData) {
            const { data: newConversation, error } = await supabase_1.supabase
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
            if (error)
                throw error;
            conversation = (0, mapper_1.toCamelCase)(newConversation);
        }
        else {
            conversation = (0, mapper_1.toCamelCase)(conversationData);
        }
        return { conversation, contact };
    }
    async updateConversationStatus(conversationId, status) {
        const { error } = await supabase_1.supabase
            .from('conversations')
            .update({ status })
            .eq('id', conversationId);
        if (error)
            throw error;
    }
    async assignAgent(conversationId, agentId) {
        const { error } = await supabase_1.supabase
            .from('conversations')
            .update({ assigned_agent_id: agentId })
            .eq('id', conversationId);
        if (error)
            throw error;
    }
}
exports.ConversationService = ConversationService;
exports.default = new ConversationService();
