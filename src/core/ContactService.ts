import { supabase } from '../infrastructure/supabase';
import { randomUUID } from 'crypto';

export interface Contact {
  id?: string;
  phone_number: string;
  name?: string;
  email?: string;
  preferred_language?: string;
  source?: 'whatsapp' | 'manual' | 'csv_import';
  import_batch_id?: string;
  notes?: string;
  tags?: string[];
}

export interface CSVImportRow {
  phone_number: string;
  name?: string;
  email?: string;
  preferred_language?: string;
  notes?: string;
  tags?: string;
}

export interface CSVImportResult {
  batch_id: string;
  total_rows: number;
  successful_imports: number;
  failed_imports: number;
  errors: Array<{ row: number; error: string; data: any }>;
}

class ContactService {
  /**
   * Create a new contact manually
   */
  async createContact(contact: Contact, createdBy?: string): Promise<{ id: string }> {
    try {
      // Validate phone number format (basic validation)
      if (!contact.phone_number || contact.phone_number.trim().length === 0) {
        throw new Error('Phone number is required');
      }

      // Check if phone number already exists
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone_number', contact.phone_number)
        .single();

      if (existing) {
        throw new Error('Contact with this phone number already exists');
      }

      // Set source
      const contactData = {
        ...contact,
        source: contact.source || 'manual',
        preferred_language: contact.preferred_language || 'de',
      };

      const { data, error } = await supabase
        .from('contacts')
        .insert(contactData)
        .select('id')
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  /**
   * Update an existing contact
   */
  async updateContact(id: string, updates: Partial<Contact>): Promise<void> {
    try {
      // If updating phone number, check for duplicates
      if (updates.phone_number) {
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('phone_number', updates.phone_number)
          .neq('id', id)
          .single();

        if (existing) {
          throw new Error('Another contact with this phone number already exists');
        }
      }

      const { error } = await supabase
        .from('contacts')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating contact:', error);
      throw error;
    }
  }

  /**
   * Get contact by ID
   */
  async getContact(id: string): Promise<Contact | null> {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return null;
      return data;
    } catch (error: any) {
      console.error('Error fetching contact:', error);
      return null;
    }
  }

  /**
   * Get all contacts with optional filters
   */
  async getAllContacts(filters?: {
    source?: string;
    hasConversation?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Contact[]> {
    try {
      let query = supabase.from('contacts').select('*');

      if (filters?.source) {
        query = query.eq('source', filters.source);
      }

      if (filters?.hasConversation !== undefined) {
        if (filters.hasConversation) {
          // Only contacts with conversations
          query = query.not('conversations', 'is', null);
        } else {
          // Only contacts without conversations
          const { data: contactsWithConversations } = await supabase
            .from('conversations')
            .select('contact_id');
          
          const conversationContactIds = (contactsWithConversations || []).map(c => c.contact_id);
          if (conversationContactIds.length > 0) {
            query = query.not('id', 'in', `(${conversationContactIds.join(',')})`);
          }
        }
      }

      if (filters?.tags && filters.tags.length > 0) {
        query = query.contains('tags', filters.tags);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching all contacts:', error);
      return [];
    }
  }

  /**
   * Delete a contact
   */
  async deleteContact(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  }

  /**
   * Process CSV import and create contacts in bulk
   */
  async importContactsFromCSV(
    rows: CSVImportRow[],
    uploadedBy: string
  ): Promise<CSVImportResult> {
    const batchId = randomUUID();
    const errors: Array<{ row: number; error: string; data: any }> = [];
    let successfulImports = 0;
    let failedImports = 0;

    try {
      // Create import batch record
      await supabase.from('csv_import_batches').insert({
        id: batchId,
        filename: `import_${new Date().toISOString()}.csv`,
        uploaded_by: uploadedBy,
        total_rows: rows.length,
        status: 'processing',
      });

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          // Validate required fields
          if (!row.phone_number || row.phone_number.trim().length === 0) {
            throw new Error('Phone number is required');
          }

          // Normalize phone number
          const phoneNumber = row.phone_number.trim();

          // Check if contact already exists
          const { data: existing } = await supabase
            .from('contacts')
            .select('id')
            .eq('phone_number', phoneNumber)
            .single();

          if (existing) {
            // Skip duplicate
            errors.push({
              row: i + 1,
              error: 'Contact already exists',
              data: row,
            });
            failedImports++;
            continue;
          }

          // Parse tags if provided as comma-separated string
          let tags: string[] | undefined;
          if (row.tags && typeof row.tags === 'string') {
            tags = row.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
          }

          // Create contact
          const contactData = {
            phone_number: phoneNumber,
            name: row.name?.trim() || null,
            email: row.email?.trim() || null,
            preferred_language: row.preferred_language || 'de',
            notes: row.notes?.trim() || null,
            tags: tags || [],
            source: 'csv_import' as const,
            import_batch_id: batchId,
          };

          await supabase.from('contacts').insert(contactData);
          successfulImports++;
        } catch (error: any) {
          errors.push({
            row: i + 1,
            error: error.message,
            data: row,
          });
          failedImports++;
        }
      }

      // Update batch record
      await supabase
        .from('csv_import_batches')
        .update({
          successful_imports: successfulImports,
          failed_imports: failedImports,
          errors: errors,
          status: failedImports > 0 ? 'completed' : 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', batchId);

      return {
        batch_id: batchId,
        total_rows: rows.length,
        successful_imports: successfulImports,
        failed_imports: failedImports,
        errors,
      };
    } catch (error: any) {
      console.error('Error importing contacts from CSV:', error);
      
      // Mark batch as failed
      await supabase
        .from('csv_import_batches')
        .update({
          status: 'failed',
          errors: [{ error: error.message }],
          completed_at: new Date().toISOString(),
        })
        .eq('id', batchId);

      throw error;
    }
  }

  /**
   * Get import batch history
   */
  async getImportBatches(uploadedBy?: string): Promise<any[]> {
    try {
      let query = supabase
        .from('csv_import_batches')
        .select('*');

      if (uploadedBy) {
        query = query.eq('uploaded_by', uploadedBy);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching import batches:', error);
      return [];
    }
  }

  /**
   * Get contacts by import batch
   */
  async getContactsByBatch(batchId: string): Promise<Contact[]> {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('import_batch_id', batchId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching contacts by batch:', error);
      return [];
    }
  }

  /**
   * Search contacts by name or phone
   */
  async searchContacts(query: string, limit: number = 50): Promise<Contact[]> {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .or(`name.ilike.%${query}%,phone_number.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error searching contacts:', error);
      return [];
    }
  }

  /**
   * Get contact statistics
   */
  async getContactStats(): Promise<{
    total: number;
    whatsapp: number;
    manual: number;
    csv_import: number;
    with_conversations: number;
    without_conversations: number;
  }> {
    try {
      const { count: total } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });

      const { count: whatsapp } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'whatsapp');

      const { count: manual } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'manual');

      const { count: csv_import } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'csv_import');

      const { data: conversationContacts } = await supabase
        .from('conversations')
        .select('contact_id', { count: 'exact' });

      const with_conversations = new Set(conversationContacts?.map(c => c.contact_id) || []).size;
      const without_conversations = (total || 0) - with_conversations;

      return {
        total: total || 0,
        whatsapp: whatsapp || 0,
        manual: manual || 0,
        csv_import: csv_import || 0,
        with_conversations,
        without_conversations,
      };
    } catch (error: any) {
      console.error('Error fetching contact stats:', error);
      return {
        total: 0,
        whatsapp: 0,
        manual: 0,
        csv_import: 0,
        with_conversations: 0,
        without_conversations: 0,
      };
    }
  }
}

export default new ContactService();
