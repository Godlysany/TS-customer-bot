-- WhatsApp CRM Bot - Supabase Database Schema
-- Production deployment: October 13, 2025

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'support' CHECK (role IN ('master', 'support')),
    is_active BOOLEAN DEFAULT true,
    reset_token TEXT,
    reset_token_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'escalated')),
    assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'voice', 'image', 'file')),
    direction VARCHAR(50) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Prompts table (for GPT configuration)
CREATE TABLE IF NOT EXISTS prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    system_prompt TEXT NOT NULL,
    business_context TEXT,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    model VARCHAR(100) DEFAULT 'gpt-4o',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    calendar_event_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    buffer_time_before INTEGER DEFAULT 0,
    buffer_time_after INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    penalty_fee DECIMAL(10,2) DEFAULT 0,
    penalty_applied BOOLEAN DEFAULT false,
    discount_code VARCHAR(100),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    promo_voucher VARCHAR(100),
    email_sent BOOLEAN DEFAULT false,
    reminder_sent BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Automations table (for marketing and triggers)
CREATE TABLE IF NOT EXISTS automations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(100) NOT NULL,
    trigger_config JSONB,
    action_type VARCHAR(100) NOT NULL,
    action_config JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Escalations table
CREATE TABLE IF NOT EXISTS escalations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings table for CRM configuration
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    category VARCHAR(100),
    description TEXT,
    is_secret BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer analytics table for enhanced profiles
CREATE TABLE IF NOT EXISTS customer_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    sentiment_score DECIMAL(3,2), -- -1 to 1 scale
    upsell_potential VARCHAR(50) CHECK (upsell_potential IN ('low', 'medium', 'high')),
    keywords JSONB, -- Array of keywords with frequency
    total_appointments INTEGER DEFAULT 0,
    last_appointment_at TIMESTAMP WITH TIME ZONE,
    total_messages INTEGER DEFAULT 0,
    avg_response_time INTEGER, -- in seconds
    customer_lifetime_value DECIMAL(10,2),
    risk_level VARCHAR(50) CHECK (risk_level IN ('low', 'medium', 'high')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(contact_id)
);

-- Conversation takeover tracking
CREATE TABLE IF NOT EXISTS conversation_takeovers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    takeover_type VARCHAR(50) CHECK (takeover_type IN ('pause_bot', 'write_between', 'full_control')),
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Marketing campaigns
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    message_template TEXT NOT NULL,
    filter_criteria JSONB NOT NULL, -- JSON filter for targeting
    scheduled_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'cancelled')),
    total_recipients INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    created_by UUID REFERENCES agents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Waitlist table for appointment queue management
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    preferred_dates JSONB, -- Array of preferred date ranges
    service_type VARCHAR(255),
    priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'matched', 'expired', 'cancelled')),
    matched_booking_id UUID REFERENCES bookings(id),
    notified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questionnaires table for anamnesis/profiling
CREATE TABLE IF NOT EXISTS questionnaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    questions JSONB NOT NULL, -- Array of question objects with type, options, required
    is_active BOOLEAN DEFAULT true,
    trigger_type VARCHAR(100), -- 'new_contact', 'first_booking', 'manual'
    created_by UUID REFERENCES agents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questionnaire responses
CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id),
    responses JSONB NOT NULL, -- Question ID mapped to answer
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews and feedback
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    review_link VARCHAR(500), -- Google/external review link
    review_submitted BOOLEAN DEFAULT false,
    reminder_sent_at TIMESTAMP WITH TIME ZONE,
    collected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email logs
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id),
    email_type VARCHAR(100) NOT NULL, -- 'booking_confirmation', 'cancellation', 'reminder', 'daily_summary'
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    body TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    sendgrid_message_id VARCHAR(255),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reminder logs
CREATE TABLE IF NOT EXISTS reminder_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    reminder_type VARCHAR(100) NOT NULL, -- 'appointment', 'upsell', 'review'
    message_content TEXT,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cancellation policies
CREATE TABLE IF NOT EXISTS cancellation_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    hours_before_appointment INTEGER NOT NULL, -- Minimum hours for free cancellation
    penalty_type VARCHAR(50) CHECK (penalty_type IN ('fixed', 'percentage')),
    penalty_amount DECIMAL(10,2),
    penalty_percentage INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_conversations_contact_id ON conversations(contact_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_assigned_agent_id ON conversations(assigned_agent_id);
CREATE INDEX idx_bookings_contact_id ON bookings(contact_id);
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_contacts_phone_number ON contacts(phone_number);
CREATE INDEX idx_waitlist_contact_id ON waitlist(contact_id);
CREATE INDEX idx_waitlist_status ON waitlist(status);
CREATE INDEX idx_questionnaire_responses_contact_id ON questionnaire_responses(contact_id);
CREATE INDEX idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX idx_reviews_contact_id ON reviews(contact_id);
CREATE INDEX idx_email_logs_contact_id ON email_logs(contact_id);
CREATE INDEX idx_email_logs_booking_id ON email_logs(booking_id);
CREATE INDEX idx_reminder_logs_booking_id ON reminder_logs(booking_id);
CREATE INDEX idx_reminder_logs_scheduled_for ON reminder_logs(scheduled_for);
CREATE INDEX idx_agents_email ON agents(email);
CREATE INDEX idx_agents_role ON agents(role);
CREATE INDEX idx_settings_key ON settings(key);
CREATE INDEX idx_settings_category ON settings(category);

-- Insert default admin agent with password: admin123 (CHANGE IMMEDIATELY AFTER FIRST LOGIN!)
INSERT INTO agents (name, email, password_hash, role, is_active) 
VALUES (
    'System Administrator', 
    'admin@crm.local',
    '$2b$10$3s1ejZQdGXJojmapsMFrPuuAkC8GFt2slzOTOZ9o/alXMcvLi/Ip6',
    'master',
    true
)
ON CONFLICT (email) DO NOTHING;

-- Insert default active prompt
INSERT INTO prompts (name, system_prompt, business_context, temperature, model, is_active)
VALUES (
    'Default Customer Service Bot',
    'You are a helpful customer service assistant. Be professional, friendly, and concise in your responses. Always aim to resolve customer issues efficiently.',
    'This is a general purpose customer service bot. Customize this prompt with your business-specific information, products, services, and policies.',
    0.7,
    'gpt-4o',
    true
)
ON CONFLICT DO NOTHING;

-- Insert default settings
INSERT INTO settings (key, value, category, description, is_secret) VALUES
    ('bot_enabled', 'false', 'bot_control', 'Enable/disable the WhatsApp bot globally', false),
    ('openai_api_key', '', 'integrations', 'OpenAI API key for GPT responses (configure in CRM)', true),
    ('calendar_provider', 'google', 'integrations', 'Calendar provider type (google, outlook, caldav)', false),
    ('calendar_ical_url', '', 'integrations', 'Google Calendar iCal URL or API endpoint', false),
    ('whatsapp_connected', 'false', 'bot_control', 'WhatsApp connection status', false),
    ('whatsapp_reply_mode', 'text', 'bot_control', 'WhatsApp reply mode (text/voice)', false),
    ('deepgram_api_key', '', 'integrations', 'Deepgram API key for voice transcription', true),
    ('sendgrid_api_key', '', 'integrations', 'SendGrid API key for email notifications', true),
    ('sendgrid_from_email', '', 'integrations', 'Default sender email address for SendGrid', false),
    ('elevenlabs_api_key', '', 'integrations', 'ElevenLabs API key for text-to-speech', true),
    ('elevenlabs_voice_id', '', 'integrations', 'ElevenLabs Voice ID', false),
    ('secretary_email', '', 'notifications', 'Secretary email for booking notifications', false),
    ('daily_summary_enabled', 'true', 'notifications', 'Enable daily summary emails to secretary', false),
    ('daily_summary_time', '09:00', 'notifications', 'Time to send daily summary (24h format in CET)', false),
    ('timezone', 'Europe/Berlin', 'general', 'Business timezone (CET/CEST)', false),
    ('cancellation_policy_hours', '24', 'policies', 'Hours before appointment for free cancellation', false),
    ('cancellation_penalty_fee', '50.00', 'policies', 'Penalty fee for late cancellations', false),
    ('review_request_delay_hours', '24', 'reviews', 'Hours after appointment to request review', false),
    ('reminder_hours_before', '24', 'reminders', 'Hours before appointment to send reminder', false)
ON CONFLICT (key) DO NOTHING;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating updated_at
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automations_updated_at BEFORE UPDATE ON automations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_escalations_updated_at BEFORE UPDATE ON escalations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_analytics_updated_at BEFORE UPDATE ON customer_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_marketing_campaigns_updated_at BEFORE UPDATE ON marketing_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_waitlist_updated_at BEFORE UPDATE ON waitlist FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_questionnaires_updated_at BEFORE UPDATE ON questionnaires FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cancellation_policies_updated_at BEFORE UPDATE ON cancellation_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Services table (master configuration for all bookable services)
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL, -- How long the service takes
    cost DECIMAL(10,2) DEFAULT 0, -- Base price
    buffer_time_before INTEGER DEFAULT 0, -- Minutes needed before appointment
    buffer_time_after INTEGER DEFAULT 0, -- Minutes needed after appointment
    color VARCHAR(50) DEFAULT '#3B82F6', -- UI color code
    is_active BOOLEAN DEFAULT true,
    requires_payment BOOLEAN DEFAULT false, -- Require payment upfront
    deposit_amount DECIMAL(10,2) DEFAULT 0, -- Deposit required
    max_advance_booking_days INTEGER DEFAULT 90, -- How far ahead can book
    cancellation_policy_hours INTEGER DEFAULT 24, -- Override default policy
    cancellation_penalty_amount DECIMAL(10,2), -- Override default penalty
    cancellation_penalty_type VARCHAR(20) DEFAULT 'fixed' CHECK (cancellation_penalty_type IN ('fixed', 'percentage')),
    metadata JSONB, -- Extra configuration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Service documents (documents associated with services)
CREATE TABLE IF NOT EXISTS service_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file_url TEXT, -- Link to document storage
    document_type VARCHAR(50) DEFAULT 'pdf' CHECK (document_type IN ('pdf', 'image', 'link', 'text')),
    send_timing VARCHAR(50) NOT NULL CHECK (send_timing IN ('pre_booking', 'post_booking', 'pre_appointment', 'post_appointment')),
    is_required BOOLEAN DEFAULT false, -- Must customer acknowledge/sign?
    order_position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Service follow-up rules (automatic booking sequences)
CREATE TABLE IF NOT EXISTS service_follow_up_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    follow_up_service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    sequence_number INTEGER NOT NULL, -- Order in the sequence
    days_after INTEGER NOT NULL, -- Days after previous appointment
    is_required BOOLEAN DEFAULT false, -- Must be booked or optional
    auto_book BOOLEAN DEFAULT false, -- Automatically book or suggest
    reminder_message TEXT, -- Custom message for reminder
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer routines (recurring patterns per customer)
CREATE TABLE IF NOT EXISTS customer_routines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    routine_name VARCHAR(255) NOT NULL, -- e.g., "Monthly Checkup", "Quarterly Cleaning"
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    frequency_type VARCHAR(50) NOT NULL CHECK (frequency_type IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom')),
    frequency_value INTEGER DEFAULT 1, -- e.g., every 2 weeks
    preferred_day_of_week INTEGER, -- 0=Sunday, 6=Saturday
    preferred_time_of_day VARCHAR(5), -- HH:MM format
    last_booking_date TIMESTAMP WITH TIME ZONE,
    next_suggested_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    auto_book BOOLEAN DEFAULT false, -- Auto-book or just remind
    created_by VARCHAR(50) DEFAULT 'bot' CHECK (created_by IN ('bot', 'agent', 'customer')),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recurring appointments (actual scheduled recurring series)
CREATE TABLE IF NOT EXISTS recurring_appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    routine_id UUID REFERENCES customer_routines(id) ON DELETE SET NULL,
    recurrence_pattern VARCHAR(50) NOT NULL CHECK (recurrence_pattern IN ('daily', 'weekly', 'biweekly', 'monthly', 'custom')),
    recurrence_interval INTEGER DEFAULT 1,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE, -- NULL = indefinite
    occurrences_count INTEGER, -- Total number of occurrences
    occurrences_completed INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment transactions (Stripe integration)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'EUR',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled')),
    payment_type VARCHAR(50) DEFAULT 'booking' CHECK (payment_type IN ('booking', 'deposit', 'penalty', 'full_payment')),
    payment_method VARCHAR(50), -- card, bank_transfer, etc.
    failure_reason TEXT,
    refund_amount DECIMAL(10,2) DEFAULT 0,
    metadata JSONB,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reminder logs (track all reminders sent)
CREATE TABLE IF NOT EXISTS reminder_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50) NOT NULL CHECK (reminder_type IN ('email', 'whatsapp', 'sms')),
    timing VARCHAR(50) NOT NULL, -- '24h_before', '2h_before', 'custom'
    message_content TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proactive engagement campaigns (reactivation, check-ins)
CREATE TABLE IF NOT EXISTS proactive_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(50) NOT NULL CHECK (campaign_type IN ('reactivation', 'routine_reminder', 'birthday', 'follow_up', 'custom')),
    target_criteria JSONB, -- Who to target (days since last booking, service type, etc.)
    message_template TEXT NOT NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    trigger_days INTEGER, -- Days after last interaction
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    total_sent INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update bookings table to link to services
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurring_appointment_id UUID REFERENCES recurring_appointments(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'not_required' CHECK (payment_status IN ('not_required', 'pending', 'paid', 'refunded'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL;

-- Feature 6: Smart Buffer Time columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_end_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS buffer_time_before INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS buffer_time_after INTEGER DEFAULT 0;

-- Backfill buffer columns for legacy bookings
UPDATE bookings 
SET buffer_time_before = 0 
WHERE buffer_time_before IS NULL;

UPDATE bookings 
SET buffer_time_after = 0 
WHERE buffer_time_after IS NULL;

-- Triggers for new tables
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_documents_updated_at BEFORE UPDATE ON service_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_follow_up_rules_updated_at BEFORE UPDATE ON service_follow_up_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_routines_updated_at BEFORE UPDATE ON customer_routines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recurring_appointments_updated_at BEFORE UPDATE ON recurring_appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_proactive_campaigns_updated_at BEFORE UPDATE ON proactive_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default services for demonstration
INSERT INTO services (name, description, duration_minutes, cost, buffer_time_after, is_active)
VALUES 
    ('General Consultation', 'Standard consultation appointment', 30, 50.00, 15, true),
    ('Deep Cleaning', 'Professional deep cleaning session', 60, 120.00, 20, true),
    ('Follow-up Visit', 'Follow-up check after treatment', 20, 30.00, 10, true)
ON CONFLICT DO NOTHING;

-- Insert default settings for new features
INSERT INTO settings (key, value, category, description, is_secret)
VALUES 
    ('stripe_api_key', '', 'payments', 'Stripe API Secret Key', true),
    ('stripe_publishable_key', '', 'payments', 'Stripe Publishable Key', false),
    ('payments_enabled', 'false', 'payments', 'Enable payment collection', false),
    ('whatsapp_reminders_enabled', 'true', 'reminders', 'Send WhatsApp reminders', false),
    ('whatsapp_reminder_timing', '24,2', 'reminders', 'Hours before appointment to send WhatsApp reminders (comma-separated)', false),
    ('email_reminder_timing', '48,24', 'reminders', 'Hours before appointment to send email reminders (comma-separated)', false),
    ('proactive_engagement_enabled', 'true', 'engagement', 'Enable proactive customer engagement', false),
    ('reactivation_days', '90', 'engagement', 'Days of inactivity before reactivation message', false)
ON CONFLICT (key) DO NOTHING;

-- Insert default cancellation policy
INSERT INTO cancellation_policies (name, hours_before_appointment, penalty_type, penalty_amount, is_active)
VALUES ('Default 24h Policy', 24, 'fixed', 50.00, true)
ON CONFLICT DO NOTHING;
