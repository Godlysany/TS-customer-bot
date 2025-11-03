import { supabase } from '../infrastructure/supabase';
import { toCamelCase } from '../infrastructure/mapper';

export interface NurturingSetting {
  settingKey: string;
  settingValue: string;
  description: string;
}

export interface NurturingActivity {
  id: string;
  contactId: string;
  activityType: 'birthday_wish' | 'review_request' | 'new_contact_outreach' | 'post_appointment_followup' | 'reactivation' | 'questionnaire_trigger';
  status: 'pending' | 'sent' | 'failed' | 'completed' | 'cancelled';
  messageContent?: string;
  sentAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
  errorMessage?: string;
  createdAt: Date;
}

export interface ContactNurturingProfile {
  contactId: string;
  name?: string;
  birthdate?: string;
  optOutMarketing: boolean;
  optOutBirthdayWishes: boolean;
  optOutReviews: boolean;
  nurturingFrequency: 'high' | 'normal' | 'low' | 'paused';
  botEnabled: boolean;
  lastReviewRequestAt?: Date;
  lastBirthdayMessageAt?: Date;
  googleReviewSubmitted: boolean;
  recentActivities: NurturingActivity[];
  totalSent: number;
  totalCompleted: number;
  totalFailed: number;
}

export class NurturingService {
  /**
   * Get all nurturing settings
   */
  async getSettings(): Promise<NurturingSetting[]> {
    try {
      const { data, error } = await supabase
        .from('nurturing_settings')
        .select('*')
        .order('setting_key');

      if (error) throw error;
      return (data || []).map(toCamelCase) as NurturingSetting[];
    } catch (error: any) {
      console.error('❌ Error fetching nurturing settings:', error);
      return [];
    }
  }

  /**
   * Get a specific nurturing setting
   */
  async getSetting(key: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('nurturing_settings')
        .select('setting_value')
        .eq('setting_key', key)
        .single();

      if (error || !data) return null;
      return data.setting_value;
    } catch (error: any) {
      console.error(`❌ Error fetching setting ${key}:`, error);
      return null;
    }
  }

  /**
   * Update a nurturing setting (creates if doesn't exist)
   */
  async updateSetting(key: string, value: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('nurturing_settings')
        .upsert({ 
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;
      console.log(`✅ Updated nurturing setting: ${key} = ${value}`);
    } catch (error: any) {
      console.error(`❌ Error updating setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Log a nurturing activity
   */
  async logActivity(data: {
    contactId: string;
    activityType: NurturingActivity['activityType'];
    status: NurturingActivity['status'];
    messageContent?: string;
    metadata?: Record<string, any>;
    errorMessage?: string;
  }): Promise<string> {
    try {
      const { data: activity, error } = await supabase
        .from('nurturing_activity_log')
        .insert({
          contact_id: data.contactId,
          activity_type: data.activityType,
          status: data.status,
          message_content: data.messageContent,
          metadata: data.metadata || {},
          error_message: data.errorMessage,
          sent_at: data.status === 'sent' ? new Date().toISOString() : null,
          completed_at: data.status === 'completed' ? new Date().toISOString() : null,
        })
        .select('id')
        .single();

      if (error) throw error;
      return activity.id;
    } catch (error: any) {
      console.error('❌ Error logging nurturing activity:', error);
      throw error;
    }
  }

  /**
   * Update a nurturing activity status
   */
  async updateActivityStatus(activityId: string, status: NurturingActivity['status'], errorMessage?: string): Promise<void> {
    try {
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'sent') {
        updates.sent_at = new Date().toISOString();
      } else if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      } else if (status === 'failed' && errorMessage) {
        updates.error_message = errorMessage;
      }

      const { error } = await supabase
        .from('nurturing_activity_log')
        .update(updates)
        .eq('id', activityId);

      if (error) throw error;
    } catch (error: any) {
      console.error('❌ Error updating activity status:', error);
      throw error;
    }
  }

  /**
   * Get nurturing activities for a contact
   */
  async getContactActivities(contactId: string, limit: number = 50): Promise<NurturingActivity[]> {
    try {
      const { data, error } = await supabase
        .from('nurturing_activity_log')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(toCamelCase) as NurturingActivity[];
    } catch (error: any) {
      console.error('❌ Error fetching contact activities:', error);
      return [];
    }
  }

  /**
   * Get comprehensive nurturing profile for a contact
   */
  async getContactNurturingProfile(contactId: string): Promise<ContactNurturingProfile | null> {
    try {
      // Get contact info
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('name, birthdate, opt_out_marketing, opt_out_birthday_wishes, opt_out_reviews, nurturing_frequency, bot_enabled, last_review_request_at, last_birthday_message_at, google_review_submitted')
        .eq('id', contactId)
        .single();

      if (contactError || !contact) return null;

      // Get activities
      const activities = await this.getContactActivities(contactId, 50);

      // Calculate stats
      const totalSent = activities.filter(a => a.status === 'sent' || a.status === 'completed').length;
      const totalCompleted = activities.filter(a => a.status === 'completed').length;
      const totalFailed = activities.filter(a => a.status === 'failed').length;

      return {
        contactId,
        name: contact.name,
        birthdate: contact.birthdate,
        optOutMarketing: contact.opt_out_marketing || false,
        optOutBirthdayWishes: contact.opt_out_birthday_wishes || false,
        optOutReviews: contact.opt_out_reviews || false,
        nurturingFrequency: contact.nurturing_frequency || 'normal',
        botEnabled: contact.bot_enabled !== false, // Default to true if not set
        lastReviewRequestAt: contact.last_review_request_at ? new Date(contact.last_review_request_at) : undefined,
        lastBirthdayMessageAt: contact.last_birthday_message_at ? new Date(contact.last_birthday_message_at) : undefined,
        googleReviewSubmitted: contact.google_review_submitted || false,
        recentActivities: activities.slice(0, 10),
        totalSent,
        totalCompleted,
        totalFailed,
      };
    } catch (error: any) {
      console.error('❌ Error fetching contact nurturing profile:', error);
      return null;
    }
  }

  /**
   * Get contacts eligible for birthday wishes today
   */
  async getBirthdayContactsToday(): Promise<any[]> {
    try {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .not('birthdate', 'is', null)
        .eq('opt_out_birthday_wishes', false);

      if (error) throw error;

      // Filter by matching month and day, and exclude already messaged this year
      const thisYear = today.getFullYear();
      return (data || []).filter(contact => {
        // Check if birthdate matches today's month and day
        const birthdate = new Date(contact.birthdate);
        if (birthdate.getMonth() + 1 !== month || birthdate.getDate() !== day) {
          return false;
        }
        
        // Exclude if already messaged this year
        if (!contact.last_birthday_message_at) return true;
        const lastMessageYear = new Date(contact.last_birthday_message_at).getFullYear();
        return lastMessageYear < thisYear;
      });
    } catch (error: any) {
      console.error('❌ Error fetching birthday contacts:', error);
      return [];
    }
  }

  /**
   * Get contacts eligible for review requests
   */
  async getReviewEligibleContacts(): Promise<any[]> {
    try {
      const reviewDelayHours = parseInt(await this.getSetting('review_request_delay_hours') || '24');
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - reviewDelayHours);

      // Get recent completed bookings
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('contact_id, scheduled_time, contacts!inner(id, name, email, opt_out_reviews, google_review_submitted, last_review_request_at)')
        .eq('status', 'completed')
        .lte('scheduled_time', cutoffDate.toISOString())
        .eq('contacts.opt_out_reviews', false)
        .eq('contacts.google_review_submitted', false);

      if (error) throw error;

      // Filter out contacts who received a review request recently (within 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return (bookings || [])
        .filter((b: any) => {
          if (!b.contacts.last_review_request_at) return true;
          return new Date(b.contacts.last_review_request_at) < thirtyDaysAgo;
        })
        .map((b: any) => b.contacts)
        .filter((contact: any, index: number, self: any[]) => 
          // Remove duplicates
          index === self.findIndex((c) => c.id === contact.id)
        );
    } catch (error: any) {
      console.error('❌ Error fetching review-eligible contacts:', error);
      return [];
    }
  }

  /**
   * Get nurturing activity statistics
   */
  async getActivityStats(startDate?: Date, endDate?: Date): Promise<{
    totalSent: number;
    totalCompleted: number;
    totalFailed: number;
    byType: Record<string, number>;
  }> {
    try {
      let query = supabase
        .from('nurturing_activity_log')
        .select('activity_type, status');

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const totalSent = (data || []).filter(a => a.status === 'sent' || a.status === 'completed').length;
      const totalCompleted = (data || []).filter(a => a.status === 'completed').length;
      const totalFailed = (data || []).filter(a => a.status === 'failed').length;

      const byType: Record<string, number> = {};
      (data || []).forEach(activity => {
        byType[activity.activity_type] = (byType[activity.activity_type] || 0) + 1;
      });

      return {
        totalSent,
        totalCompleted,
        totalFailed,
        byType,
      };
    } catch (error: any) {
      console.error('❌ Error fetching activity stats:', error);
      return {
        totalSent: 0,
        totalCompleted: 0,
        totalFailed: 0,
        byType: {},
      };
    }
  }

  /**
   * Mark contact's birthdate updated
   */
  async updateContactBirthdate(contactId: string, birthdate: string | null): Promise<void> {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ birthdate })
        .eq('id', contactId);

      if (error) throw error;
    } catch (error: any) {
      console.error('❌ Error updating contact birthdate:', error);
      throw error;
    }
  }

  /**
   * Update contact nurturing preferences
   */
  async updateContactNurturingPreferences(contactId: string, preferences: {
    optOutMarketing?: boolean;
    optOutBirthdayWishes?: boolean;
    optOutReviews?: boolean;
    nurturingFrequency?: 'high' | 'normal' | 'low' | 'paused';
    botEnabled?: boolean;
    birthdate?: string | null;
    email?: string | null;
    preferredLanguage?: string | null;
    preferred_language?: string | null;
    bot_enabled?: boolean;
  }): Promise<void> {
    try {
      const updates: any = {};
      if (preferences.optOutMarketing !== undefined) updates.opt_out_marketing = preferences.optOutMarketing;
      if (preferences.optOutBirthdayWishes !== undefined) updates.opt_out_birthday_wishes = preferences.optOutBirthdayWishes;
      if (preferences.optOutReviews !== undefined) updates.opt_out_reviews = preferences.optOutReviews;
      if (preferences.nurturingFrequency !== undefined) updates.nurturing_frequency = preferences.nurturingFrequency;
      if (preferences.botEnabled !== undefined) updates.bot_enabled = preferences.botEnabled;
      if (preferences.bot_enabled !== undefined) updates.bot_enabled = preferences.bot_enabled;
      if (preferences.birthdate !== undefined) updates.birthdate = preferences.birthdate;
      if (preferences.email !== undefined) updates.email = preferences.email;
      if (preferences.preferredLanguage !== undefined) updates.preferred_language = preferences.preferredLanguage;
      if (preferences.preferred_language !== undefined) updates.preferred_language = preferences.preferred_language;

      const { error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', contactId);

      if (error) throw error;
      console.log(`✅ Updated contact preferences for ${contactId}:`, updates);
    } catch (error: any) {
      console.error('❌ Error updating contact nurturing preferences:', error);
      throw error;
    }
  }
}

export default new NurturingService();
