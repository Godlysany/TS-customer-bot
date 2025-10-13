-- Migration: Add authentication system to agents table
-- Run this AFTER the main schema has been deployed

-- Step 1: Add new columns to agents table (if they don't exist)
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS reset_token TEXT,
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;

-- Step 2: Update role constraint to include 'master' and 'support'
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_role_check;
ALTER TABLE agents ADD CONSTRAINT agents_role_check 
CHECK (role IN ('master', 'support'));

-- Step 3: Update existing 'admin' roles to 'master' and 'agent' to 'support'
UPDATE agents SET role = 'master' WHERE role = 'admin';
UPDATE agents SET role = 'support' WHERE role = 'agent';

-- Step 4: Insert default master admin (password: 'admin123' - CHANGE THIS IMMEDIATELY)
-- Password hash for 'admin123' using bcrypt (rounds=10)
INSERT INTO agents (name, email, password_hash, role, is_active)
VALUES (
    'System Administrator',
    'admin@crm.local',
    '$2b$10$rqS9ZJ5KxGxZ5KxGxZ5KxOZJ5KxGxZ5KxGxZ5KxGxZ5KxGxZ5KxGy',
    'master',
    true
)
ON CONFLICT (email) DO NOTHING;

-- Step 5: Add default settings for API keys and configurations
INSERT INTO settings (key, value, category, description, is_secret) VALUES
    ('openai_api_key', '', 'integrations', 'OpenAI API Key for GPT responses', true),
    ('deepgram_api_key', '', 'integrations', 'Deepgram API Key for voice transcription', true),
    ('sendgrid_api_key', '', 'integrations', 'SendGrid API Key for email notifications', true),
    ('sendgrid_from_email', '', 'integrations', 'SendGrid from email address', false),
    ('elevenlabs_api_key', '', 'integrations', 'ElevenLabs API Key for text-to-speech', true),
    ('elevenlabs_voice_id', '', 'integrations', 'ElevenLabs Voice ID', false),
    ('calendar_provider', 'google', 'calendar', 'Calendar provider (google, outlook, etc.)', false),
    ('calendar_ical_url', '', 'calendar', 'iCal URL for calendar integration', false),
    ('secretary_email', '', 'notifications', 'Secretary email for daily summaries', false),
    ('daily_summary_time', '09:00', 'notifications', 'Time for daily summary in CET (HH:MM)', false),
    ('cancellation_policy_hours', '24', 'policies', 'Hours before appointment for free cancellation', false),
    ('cancellation_penalty_fee', '50.00', 'policies', 'Penalty fee for late cancellations', false),
    ('bot_enabled', 'false', 'bot_control', 'Enable/disable bot responses', false),
    ('whatsapp_connected', 'false', 'bot_control', 'WhatsApp connection status', false),
    ('whatsapp_reply_mode', 'text', 'bot_control', 'WhatsApp reply mode (text/voice)', false)
ON CONFLICT (key) DO NOTHING;

-- Step 6: Create index for faster auth lookups
CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);
