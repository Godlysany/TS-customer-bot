import { supabase } from '../infrastructure/supabase';
import { config } from '../infrastructure/config';
import axios from 'axios';
import fs from 'fs';
import { execSync } from 'child_process';

export type TTSReplyMode = 'text_only' | 'voice_only' | 'voice_on_voice';

interface TTSSettings {
  ttsReplyMode: TTSReplyMode;
  ttsProvider: string;
  ttsVoiceId: string | null;
  ttsEnabled: boolean;
}

class TTSService {
  async getTTSSettings(): Promise<TTSSettings> {
    try {
      const { data, error } = await supabase
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
    } catch (error: any) {
      console.error('Error fetching TTS settings:', error.message);
      return {
        ttsReplyMode: 'text_only',
        ttsProvider: 'elevenlabs',
        ttsVoiceId: null,
        ttsEnabled: false,
      };
    }
  }

  async getCustomerTTSPreference(contactId: string): Promise<TTSReplyMode | 'default'> {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('tts_preference')
        .eq('id', contactId)
        .single();

      if (error || !data || !data.tts_preference) {
        return 'default';
      }

      return data.tts_preference as TTSReplyMode | 'default';
    } catch (error: any) {
      console.error('Error fetching customer TTS preference:', error.message);
      return 'default';
    }
  }

  async setCustomerTTSPreference(
    contactId: string,
    preference: TTSReplyMode | 'default'
  ): Promise<void> {
    try {
      await supabase
        .from('contacts')
        .update({
          tts_preference: preference,
          tts_preference_set_at: new Date().toISOString(),
        })
        .eq('id', contactId);
    } catch (error: any) {
      console.error('Error setting customer TTS preference:', error.message);
    }
  }

  async shouldReplyWithVoice(
    contactId: string,
    wasIncomingVoice: boolean
  ): Promise<boolean> {
    const settings = await this.getTTSSettings();

    if (!settings.ttsEnabled || !config.elevenlabs.apiKey) {
      return false; // TTS disabled or no API key
    }

    // Check for customer-specific override
    const customerPref = await this.getCustomerTTSPreference(contactId);

    let effectiveMode: TTSReplyMode;

    if (customerPref === 'default') {
      effectiveMode = settings.ttsReplyMode;
    } else {
      effectiveMode = customerPref as TTSReplyMode;
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

  async textToSpeech(text: string): Promise<string | null> {
    const settings = await this.getTTSSettings();
    const voiceId = settings.ttsVoiceId || config.elevenlabs.voiceId || 'default-voice-id';
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    try {
      const response = await axios.post(
        url,
        {
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.3,
            similarity_boost: 0.7,
          },
        },
        {
          headers: {
            'xi-api-key': config.elevenlabs.apiKey,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        }
      );

      const tempRawPath = `./raw-${Date.now()}.mp3`;
      const finalOggPath = `./voice-${Date.now()}.ogg`;

      fs.writeFileSync(tempRawPath, response.data);
      execSync(`ffmpeg -y -i "${tempRawPath}" -ar 16000 -ac 1 -c:a libopus "${finalOggPath}"`);
      fs.unlinkSync(tempRawPath);

      return finalOggPath;
    } catch (err: any) {
      console.warn('⚠️ ElevenLabs TTS failed:', err.message);
      return null;
    }
  }

  async transcribeVoice(filePath: string): Promise<{ transcript: string; duration?: number }> {
    try {
      // Get audio duration using ffprobe
      let duration: number | undefined;
      try {
        const durationOutput = execSync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
        ).toString().trim();
        duration = Math.round(parseFloat(durationOutput));
      } catch (e) {
        console.warn('⚠️ Could not get audio duration');
      }

      const response = await axios.post(
        'https://api.deepgram.com/v1/listen?detect_language=true&punctuate=true&smart_format=true',
        fs.createReadStream(filePath),
        {
          headers: {
            Authorization: `Token ${config.deepgram.apiKey}`,
            'Content-Type': 'audio/ogg',
          },
        }
      );

      const transcript = response.data.results.channels[0].alternatives[0].transcript;
      console.log(`🧠 Transcription:`, transcript);

      return { transcript, duration };
    } catch (err: any) {
      console.error('❌ Transcription failed:', err.message);
      return { transcript: '[transcription failed]' };
    }
  }

  async updateMessageWithVoiceData(
    messageId: string,
    transcription?: string,
    duration?: number,
    ttsAudioUrl?: string
  ): Promise<void> {
    try {
      const updates: any = {};

      if (transcription) {
        updates.voice_transcription = transcription;
      }
      if (duration !== undefined) {
        updates.voice_duration_seconds = duration;
      }
      if (ttsAudioUrl) {
        updates.tts_audio_url = ttsAudioUrl;
      }

      await supabase
        .from('messages')
        .update(updates)
        .eq('id', messageId);
    } catch (error: any) {
      console.error('Error updating message with voice data:', error.message);
    }
  }
}

export default new TTSService();
