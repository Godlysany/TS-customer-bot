"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("../infrastructure/supabase");
const config_1 = require("../infrastructure/config");
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
class TTSService {
    async getTTSSettings() {
        try {
            const { data, error } = await supabase_1.supabase
                .from('bot_config')
                .select('tts_reply_mode, tts_provider, tts_voice_id, tts_enabled')
                .single();
            if (error) {
                console.warn('⚠️ Failed to fetch TTS settings, using defaults:', error.message);
                return {
                    ttsReplyMode: 'text_only',
                    ttsProvider: 'elevenlabs',
                    ttsVoiceId: null,
                    ttsEnabled: false,
                };
            }
            return {
                ttsReplyMode: data.tts_reply_mode || 'text_only',
                ttsProvider: data.tts_provider || 'elevenlabs',
                ttsVoiceId: data.tts_voice_id,
                ttsEnabled: data.tts_enabled || false,
            };
        }
        catch (error) {
            console.error('Error fetching TTS settings:', error.message);
            return {
                ttsReplyMode: 'text_only',
                ttsProvider: 'elevenlabs',
                ttsVoiceId: null,
                ttsEnabled: false,
            };
        }
    }
    async getCustomerTTSPreference(contactId) {
        try {
            const { data, error } = await supabase_1.supabase
                .from('contacts')
                .select('tts_preference')
                .eq('id', contactId)
                .single();
            if (error || !data || !data.tts_preference) {
                return 'default';
            }
            return data.tts_preference;
        }
        catch (error) {
            console.error('Error fetching customer TTS preference:', error.message);
            return 'default';
        }
    }
    async setCustomerTTSPreference(contactId, preference) {
        try {
            await supabase_1.supabase
                .from('contacts')
                .update({
                tts_preference: preference,
                tts_preference_set_at: new Date().toISOString(),
            })
                .eq('id', contactId);
        }
        catch (error) {
            console.error('Error setting customer TTS preference:', error.message);
        }
    }
    async shouldReplyWithVoice(contactId, wasIncomingVoice) {
        const settings = await this.getTTSSettings();
        if (!settings.ttsEnabled || !config_1.config.elevenlabs.apiKey) {
            return false; // TTS disabled or no API key
        }
        // Check for customer-specific override
        const customerPref = await this.getCustomerTTSPreference(contactId);
        let effectiveMode;
        if (customerPref === 'default') {
            effectiveMode = settings.ttsReplyMode;
        }
        else {
            effectiveMode = customerPref;
        }
        // Apply logic based on effective mode
        switch (effectiveMode) {
            case 'text_only':
                return false;
            case 'voice_only':
                return true;
            case 'voice_on_voice':
                return wasIncomingVoice;
            default:
                return false;
        }
    }
    async textToSpeech(text) {
        const settings = await this.getTTSSettings();
        const voiceId = settings.ttsVoiceId || config_1.config.elevenlabs.voiceId || 'default-voice-id';
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
        try {
            const response = await axios_1.default.post(url, {
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.3,
                    similarity_boost: 0.7,
                },
            }, {
                headers: {
                    'xi-api-key': config_1.config.elevenlabs.apiKey,
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer',
            });
            const tempRawPath = `./raw-${Date.now()}.mp3`;
            const finalOggPath = `./voice-${Date.now()}.ogg`;
            fs_1.default.writeFileSync(tempRawPath, response.data);
            (0, child_process_1.execSync)(`ffmpeg -y -i "${tempRawPath}" -ar 16000 -ac 1 -c:a libopus "${finalOggPath}"`);
            fs_1.default.unlinkSync(tempRawPath);
            return finalOggPath;
        }
        catch (err) {
            console.warn('⚠️ ElevenLabs TTS failed:', err.message);
            return null;
        }
    }
    async transcribeVoice(filePath) {
        try {
            // Get audio duration using ffprobe
            let duration;
            try {
                const durationOutput = (0, child_process_1.execSync)(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`).toString().trim();
                duration = Math.round(parseFloat(durationOutput));
            }
            catch (e) {
                console.warn('⚠️ Could not get audio duration');
            }
            const response = await axios_1.default.post('https://api.deepgram.com/v1/listen?detect_language=true&punctuate=true&smart_format=true', fs_1.default.createReadStream(filePath), {
                headers: {
                    Authorization: `Token ${config_1.config.deepgram.apiKey}`,
                    'Content-Type': 'audio/ogg',
                },
            });
            const transcript = response.data.results.channels[0].alternatives[0].transcript;
            console.log(`🧠 Transcription:`, transcript);
            return { transcript, duration };
        }
        catch (err) {
            console.error('❌ Transcription failed:', err.message);
            return { transcript: '[transcription failed]' };
        }
    }
    async updateMessageWithVoiceData(messageId, transcription, duration, ttsAudioUrl) {
        try {
            const updates = {};
            if (transcription) {
                updates.voice_transcription = transcription;
            }
            if (duration !== undefined) {
                updates.voice_duration_seconds = duration;
            }
            if (ttsAudioUrl) {
                updates.tts_audio_url = ttsAudioUrl;
            }
            await supabase_1.supabase
                .from('messages')
                .update(updates)
                .eq('id', messageId);
        }
        catch (error) {
            console.error('Error updating message with voice data:', error.message);
        }
    }
}
exports.default = new TTSService();
