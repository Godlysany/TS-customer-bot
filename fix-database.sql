-- FIX: Add missing columns to agents table and create admin account
-- Run this in Supabase Dashboard → SQL Editor

-- Step 1: Add missing columns to agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS reset_token TEXT,
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;

-- Step 2: Add missing indexes
CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

-- Step 3: Insert admin account (password: admin123)
INSERT INTO agents (name, email, password_hash, role, is_active)
VALUES (
    'System Administrator',
    'admin@crm.local',
    '$2b$10$3s1ejZQdGXJojmapsMFrPuuAkC8GFt2slzOTOZ9o/alXMcvLi/Ip6',
    'master',
    true
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- Step 4: Insert essential settings (if missing)
INSERT INTO settings (key, value, category, description, is_secret) VALUES
    ('bot_enabled', 'false', 'bot_control', 'Enable/disable bot', false),
    ('openai_api_key', '', 'integrations', 'OpenAI API Key', true),
    ('deepgram_api_key', '', 'integrations', 'Deepgram API Key', true),
    ('sendgrid_api_key', '', 'integrations', 'SendGrid API Key', true),
    ('sendgrid_from_email', '', 'integrations', 'SendGrid From Email', false),
    ('elevenlabs_api_key', '', 'integrations', 'ElevenLabs API Key', true),
    ('elevenlabs_voice_id', '', 'integrations', 'ElevenLabs Voice ID', false),
    ('calendar_provider', 'google', 'calendar', 'Calendar provider', false),
    ('calendar_ical_url', '', 'calendar', 'iCal URL', false),
    ('secretary_email', '', 'notifications', 'Secretary email', false),
    ('daily_summary_time', '09:00', 'notifications', 'Daily summary time', false),
    ('cancellation_policy_hours', '24', 'policies', 'Cancellation hours', false),
    ('cancellation_penalty_fee', '50.00', 'policies', 'Penalty fee', false),
    ('whatsapp_connected', 'false', 'bot_control', 'WhatsApp status', false),
    ('whatsapp_reply_mode', 'text', 'bot_control', 'Reply mode', false)
ON CONFLICT (key) DO NOTHING;

-- Verification queries
SELECT 'Admin account:' as status, email, role, is_active FROM agents WHERE email = 'admin@crm.local';
SELECT 'Settings count:' as status, COUNT(*) as count FROM settings;
