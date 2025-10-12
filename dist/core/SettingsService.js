"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const supabase_1 = require("../infrastructure/supabase");
const mapper_1 = require("../infrastructure/mapper");
class SettingsService {
    async getSetting(key) {
        const { data, error } = await supabase_1.supabase
            .from('settings')
            .select('value')
            .eq('key', key)
            .single();
        if (error || !data)
            return null;
        return data.value;
    }
    async getAllSettings(category) {
        let query = supabase_1.supabase.from('settings').select('*');
        if (category) {
            query = query.eq('category', category);
        }
        const { data, error } = await query;
        if (error)
            throw error;
        return (0, mapper_1.toCamelCaseArray)(data || []);
    }
    async updateSetting(key, value, category, description) {
        const { error } = await supabase_1.supabase
            .from('settings')
            .upsert({
            key,
            value,
            category: category || 'general',
            description: description || '',
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        if (error)
            throw error;
    }
    async getBotEnabled() {
        const value = await this.getSetting('bot_enabled');
        return value === 'true';
    }
    async setBotEnabled(enabled) {
        await this.updateSetting('bot_enabled', enabled.toString());
    }
    async getOpenAIKey() {
        return this.getSetting('openai_api_key');
    }
    async getDeepgramKey() {
        return this.getSetting('deepgram_api_key');
    }
    async getCalendarConfig() {
        const [provider, icalUrl] = await Promise.all([
            this.getSetting('calendar_provider'),
            this.getSetting('calendar_ical_url')
        ]);
        return {
            provider: provider || 'google',
            icalUrl: icalUrl || ''
        };
    }
    async isWhatsAppConnected() {
        const value = await this.getSetting('whatsapp_connected');
        return value === 'true';
    }
    async setWhatsAppConnected(connected) {
        await this.updateSetting('whatsapp_connected', connected.toString());
    }
}
exports.SettingsService = SettingsService;
exports.default = new SettingsService();
