import { supabase } from '../infrastructure/supabase';
import getOpenAIClient from '../infrastructure/openai';

interface DocumentTriggerMatch {
  serviceId: string;
  serviceName: string;
  documentUrl: string;
  documentName: string;
  documentDescription: string | null;
  matchedKeywords: string[];
}

export class DocumentMessageService {
  /**
   * Normalize text for better keyword matching (remove punctuation, extra spaces)
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }

  /**
   * Detect if customer message contains document trigger keywords
   * Only checks services with timing='as_info' and active documents
   * Uses normalized matching with word boundaries for better accuracy
   */
  async detectDocumentTriggers(message: string): Promise<DocumentTriggerMatch[]> {
    const { data: services } = await supabase
      .from('services')
      .select('id, name, document_url, document_name, document_description, document_keywords')
      .eq('document_timing', 'as_info')
      .not('document_url', 'is', null)
      .eq('is_active', true);

    if (!services || services.length === 0) {
      return [];
    }

    const normalizedMessage = this.normalizeText(message);
    const messageWords = new Set(normalizedMessage.split(' '));
    const matches: DocumentTriggerMatch[] = [];

    for (const service of services) {
      // Validate and sanitize keyword array (defensive against malformed JSON)
      let keywords: string[] = [];
      if (Array.isArray(service.document_keywords)) {
        keywords = service.document_keywords.filter(k => typeof k === 'string' && k.length > 0);
      }
      
      if (keywords.length === 0) {
        continue; // Skip services with no valid keywords
      }

      const matchedKeywords: string[] = [];

      for (const keyword of keywords) {
        const normalizedKeyword = this.normalizeText(keyword);
        
        // Check if keyword is a phrase (multiple words) or single word
        if (normalizedKeyword.includes(' ')) {
          // Multi-word phrase: check if entire phrase exists in message
          if (normalizedMessage.includes(normalizedKeyword)) {
            matchedKeywords.push(keyword);
          }
        } else {
          // Single word: check if word exists (exact match or as part of word for stemming)
          const keywordRoot = normalizedKeyword.substring(0, Math.max(4, normalizedKeyword.length - 2)); // Simple stemming
          const found = Array.from(messageWords).some(word => 
            word === normalizedKeyword || // Exact match
            word.startsWith(keywordRoot) || // Stemming (e.g., "prepare" matches "preparation")
            normalizedKeyword.startsWith(word.substring(0, Math.max(4, word.length - 2))) // Reverse stemming
          );
          
          if (found) {
            matchedKeywords.push(keyword);
          }
        }
      }

      if (matchedKeywords.length > 0) {
        matches.push({
          serviceId: service.id,
          serviceName: service.name,
          documentUrl: service.document_url!,
          documentName: service.document_name!,
          documentDescription: service.document_description,
          matchedKeywords,
        });
      }
    }

    return matches;
  }

  /**
   * Personalize document message using GPT based on customer context
   * Matches marketing campaign personalization pattern with proper system/user roles
   */
  async personalizeDocumentMessage(
    template: string | null,
    contact: any,
    conversationId: string,
    serviceName: string
  ): Promise<string> {
    // Basic placeholder replacement helper
    const applyPlaceholders = (msg: string) => {
      return msg
        .replace(/\{\{name\}\}/g, contact.name || 'valued customer')
        .replace(/\{\{service\}\}/g, serviceName);
    };

    // Default message if no template provided
    const defaultMessage = `Here is the ${serviceName} document you requested.`;
    const baseTemplate = template && template.trim().length > 0 ? template : defaultMessage;

    // Try GPT personalization (matches marketing campaign pattern)
    try {
      const openai = await getOpenAIClient();

      // Get conversation history for context
      const { data: messages } = await supabase
        .from('messages')
        .select('content, direction, timestamp')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: false })
        .limit(10);

      // Get booking history for service context
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, services(name)')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Only use GPT if we have conversation history
      if (messages && messages.length > 0) {
        const serviceHistory = bookings?.map((b: any) => b.services?.name).filter(Boolean).join(', ') || 'none';
        const conversationContext = messages.slice(0, 5).map((m: any) => 
          `${m.direction === 'inbound' ? 'Customer' : 'Bot'}: ${m.content}`
        ).join('\n');

        const systemPrompt = `You are personalizing a document delivery message for a customer based on their history and preferences.

Customer Name: ${contact.name || 'Customer'}
Language Preference: ${contact.preferred_language || contact.preferredLanguage || 'de'}
Service: ${serviceName}
Past Services: ${serviceHistory}
Recent Conversation:
${conversationContext}

Instructions:
1. Adapt the message to match the customer's preferred language (${contact.preferred_language || contact.preferredLanguage || 'de'})
2. Reference their conversation context naturally if relevant
3. Keep the core message intent but personalize the tone and context
4. Keep it concise and professional
5. Natural mention that you're sharing the requested document

Template to personalize:
"${baseTemplate}"`;

        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Please personalize this document message for the customer.' }
          ],
          temperature: 0.7,
          max_tokens: 200,
        });

        const personalizedMessage = response.choices[0]?.message?.content?.trim();
        if (personalizedMessage && personalizedMessage.length > 10) { // Sanity check
          console.log(`✨ GPT personalized document message for ${serviceName}`);
          return personalizedMessage;
        }
      }
    } catch (error) {
      console.error('❌ GPT personalization failed, using template with placeholders:', error);
    }

    // Fallback: apply basic placeholder replacement to template
    return applyPlaceholders(baseTemplate);
  }

  /**
   * Record that a document was sent to avoid duplicates
   */
  async recordDocumentSent(
    contactId: string,
    conversationId: string,
    serviceId: string,
    documentUrl: string
  ): Promise<void> {
    await supabase
      .from('document_deliveries')
      .insert({
        contact_id: contactId,
        conversation_id: conversationId,
        service_id: serviceId,
        document_url: documentUrl,
        delivery_method: 'whatsapp',
        delivery_trigger: 'keyword',
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
  }

  /**
   * Check if document was already sent to avoid spam
   */
  async wasDocumentAlreadySent(
    contactId: string,
    serviceId: string
  ): Promise<boolean> {
    const { data } = await supabase
      .from('document_deliveries')
      .select('id')
      .eq('contact_id', contactId)
      .eq('service_id', serviceId)
      .eq('delivery_trigger', 'keyword')
      .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .limit(1);

    return (data && data.length > 0) || false;
  }
}

export default new DocumentMessageService();
