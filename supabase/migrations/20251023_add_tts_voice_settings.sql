-- Add TTS (Text-to-Speech) and voice handling settings
-- Created: October 23, 2025
-- Purpose: Enable voice message interpretation and TTS replies with per-customer overrides

-- Add TTS settings to bot_config table
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS tts_reply_mode VARCHAR(20) DEFAULT 'text_only' 
  CHECK (tts_reply_mode IN ('text_only', 'voice_only', 'voice_on_voice'));
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS tts_provider VARCHAR(50) DEFAULT 'elevenlabs';
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS tts_voice_id VARCHAR(255);
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS tts_enabled BOOLEAN DEFAULT false;

-- Add per-customer TTS override to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tts_preference VARCHAR(20) 
  CHECK (tts_preference IN ('text_only', 'voice_only', 'voice_on_voice', 'default'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tts_preference_set_at TIMESTAMP WITH TIME ZONE;

-- Add voice message tracking
ALTER TABLE messages ADD COLUMN IF NOT EXISTS voice_transcription TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS voice_duration_seconds INTEGER;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tts_audio_url TEXT;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contacts_tts_preference ON contacts(tts_preference) 
  WHERE tts_preference IS NOT NULL AND tts_preference != 'default';
CREATE INDEX IF NOT EXISTS idx_messages_voice ON messages(message_type) 
  WHERE message_type = 'voice';

-- Comment documentation
COMMENT ON COLUMN bot_config.tts_reply_mode IS 'Bot TTS behavior: text_only (never voice), voice_only (always voice), voice_on_voice (voice reply to voice messages)';
COMMENT ON COLUMN contacts.tts_preference IS 'Customer-specific TTS override: text_only, voice_only, voice_on_voice, or default (use bot setting)';
COMMENT ON COLUMN messages.voice_transcription IS 'Deepgram transcription of voice messages';
COMMENT ON COLUMN messages.tts_audio_url IS 'ElevenLabs TTS audio URL for voice replies';
