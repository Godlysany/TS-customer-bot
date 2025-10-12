import { supabase } from '../infrastructure/supabase';
import { toCamelCase, toCamelCaseArray } from '../infrastructure/mapper';

export class SettingsService {
  async getSetting(key: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error || !data) return null;
    return data.value;
  }

  async getAllSettings(category?: string): Promise<any[]> {
    let query = supabase.from('settings').select('*');
    
    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return toCamelCaseArray(data || []);
  }

  async updateSetting(key: string, value: string, category?: string, description?: string): Promise<void> {
    const { error } = await supabase
      .from('settings')
      .upsert(
        { 
          key, 
          value, 
          category: category || 'general',
          description: description || '',
          updated_at: new Date().toISOString() 
        },
        { onConflict: 'key' }
      );

    if (error) throw error;
  }

  async getBotEnabled(): Promise<boolean> {
    const value = await this.getSetting('bot_enabled');
    return value === 'true';
  }

  async setBotEnabled(enabled: boolean): Promise<void> {
    await this.updateSetting('bot_enabled', enabled.toString());
  }

  async getOpenAIKey(): Promise<string | null> {
    return this.getSetting('openai_api_key');
  }

  async getDeepgramKey(): Promise<string | null> {
    return this.getSetting('deepgram_api_key');
  }

  async getCalendarConfig(): Promise<{ provider: string; icalUrl: string }> {
    const [provider, icalUrl] = await Promise.all([
      this.getSetting('calendar_provider'),
      this.getSetting('calendar_ical_url')
    ]);

    return {
      provider: provider || 'google',
      icalUrl: icalUrl || ''
    };
  }

  async isWhatsAppConnected(): Promise<boolean> {
    const value = await this.getSetting('whatsapp_connected');
    return value === 'true';
  }

  async setWhatsAppConnected(connected: boolean): Promise<void> {
    await this.updateSetting('whatsapp_connected', connected.toString());
  }
}

export default new SettingsService();
