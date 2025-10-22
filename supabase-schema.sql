-- WhatsApp CRM Bot - Supabase Database Schema  
-- Production deployment: October 22, 2025 (Complete end-to-end payment integration + critical production fixes)
-- Latest update: Route integration fixes - mounted bot-config, escalations, services, customers, message-approval, questionnaire-responses routes
-- All route modules now properly connected to main router (Evening session - Oct 22, 2025)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    preferred_language VARCHAR(10) DEFAULT 'de',
    
    -- Enhanced CRM fields for customer profiling
    preferred_staff_member VARCHAR(255), -- DEPRECATED: Legacy single staff preference
    preferred_team_member_ids UUID[], -- NEW: Array of preferred team member UUIDs (supports multiple)
    preference_metadata JSONB, -- Stores preference context: {"detected_from":"conversation", "last_updated":"2025-03-15", "ranking":[uuid1,uuid2]}
    preferred_appointment_times TEXT, -- e.g. "mornings", "weekends only", "Tuesdays after 3pm"
    special_notes TEXT, -- Fears, anxieties, allergies, special requests, medical considerations
    
    -- Phase 1: AI-Extracted CRM Data (October 21, 2025)
    -- These columns store automatically extracted customer insights from conversations
    preferred_times TEXT, -- When customer prefers appointments (extracted from conversations)
    preferred_staff TEXT, -- Preferred staff members mentioned in conversations
    preferred_services TEXT, -- Services customer is interested in
    fears_anxieties TEXT, -- Dental anxiety, needle phobia, claustrophobia, nervousness
    allergies TEXT, -- Latex, medications, materials allergies
    physical_limitations TEXT, -- Wheelchair access, hearing/vision issues, mobility concerns
    special_requests TEXT, -- Quiet environment, companion, child-friendly, cultural/religious needs
    communication_preferences JSONB DEFAULT '{}'::jsonb, -- How customer prefers to be contacted (structured data)
    behavioral_notes TEXT, -- Punctuality patterns, communication style, personality traits
    customer_insights TEXT, -- General observations and other relevant insights
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agents table (Admin users who manage the CRM)
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

-- Team Members table (Service providers: doctors, instructors, therapists, etc.)
-- NOTE: Current architecture is SINGLE-TENANT (one business per installation)
-- Future enhancement: Add business_id for multi-tenant support
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- FUTURE MULTI-TENANT SUPPORT:
    -- When supporting multiple businesses, uncomment and add migration:
    -- business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    -- Then change UNIQUE constraint from (name) to (business_id, name)
    
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255), -- e.g. "Dentist", "Driving Instructor", "Massage Therapist"
    bio TEXT, -- Public bio shown to customers
    avatar_url TEXT, -- Profile picture URL
    email VARCHAR(255), -- Optional: for internal notifications
    phone VARCHAR(50), -- Optional: for internal contact
    
    -- Calendar Integration (per team member)
    calendar_provider VARCHAR(50) DEFAULT 'ical' CHECK (calendar_provider IN ('ical', 'google', 'caldav', 'outlook')),
    calendar_source_url TEXT, -- iCal URL, Google Calendar ID, etc.
    calendar_secret_ref VARCHAR(255), -- Reference to secret in vault (NOT the actual secret)
    calendar_last_synced TIMESTAMP WITH TIME ZONE, -- Last successful sync
    calendar_sync_status VARCHAR(50) DEFAULT 'pending' CHECK (calendar_sync_status IN ('pending', 'active', 'error', 'disabled')),
    calendar_sync_error TEXT, -- Last error message if sync failed
    
    -- Availability & Priority
    is_active BOOLEAN DEFAULT true, -- Can accept new bookings?
    is_bookable BOOLEAN DEFAULT false, -- Computed: has calendar + linked to services
    default_priority INTEGER DEFAULT 0, -- Higher = preferred when multiple options (0-10)
    working_hours JSONB, -- Optional override: {"monday":"09:00-17:00", ...}
    
    -- Metadata
    metadata JSONB, -- Extra configuration: certifications, specialties, etc.
    display_order INTEGER DEFAULT 0, -- Order in UI lists
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    
    -- UNIQUE constraint will be UNIQUE(business_id, name) once business_id is added
    -- For now: UNIQUE(name) as temporary constraint
    -- TODO: Change to UNIQUE(business_id, name) when business_id column added
);

-- Temporary unique constraint (will be replaced with business-scoped constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_name_temp ON team_members(name);

CREATE INDEX IF NOT EXISTS idx_team_members_active ON team_members(is_active, is_bookable);
CREATE INDEX IF NOT EXISTS idx_team_members_calendar_sync ON team_members(calendar_sync_status);

-- Team Member Services junction table (many-to-many)
CREATE TABLE IF NOT EXISTS team_member_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    
    -- Priority & Configuration
    is_primary BOOLEAN DEFAULT false, -- Is this team member the primary provider for this service?
    priority_order INTEGER DEFAULT 0, -- Order preference when multiple team members offer same service
    custom_duration_minutes INTEGER, -- Override service duration for this team member
    custom_cost_chf DECIMAL(10,2), -- Override service cost for this team member
    notes TEXT, -- Special notes about this team member's approach to this service
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(team_member_id, service_id) -- No duplicate assignments
);

CREATE INDEX IF NOT EXISTS idx_team_member_services_team ON team_member_services(team_member_id);
CREATE INDEX IF NOT EXISTS idx_team_member_services_service ON team_member_services(service_id);
CREATE INDEX IF NOT EXISTS idx_team_member_services_primary ON team_member_services(service_id, is_primary);

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
    approval_status VARCHAR(50) DEFAULT 'approved' CHECK (approval_status IN ('pending_approval', 'sending', 'approved', 'rejected')),
    approved_by UUID REFERENCES agents(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    whatsapp_message_id VARCHAR(255),
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
    
    -- Team Member Assignment (NEW)
    team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL, -- Which team member provides this service
    assigned_strategy VARCHAR(50) DEFAULT 'auto', -- How was team member selected: 'preference', 'availability', 'manual', 'auto'
    preference_snapshot JSONB, -- Snapshot of customer preferences at booking time
    
    calendar_event_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    buffer_time_before INTEGER DEFAULT 0,
    buffer_time_after INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'no_show', 'completed')),
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    penalty_fee DECIMAL(10,2) DEFAULT 0,
    penalty_applied BOOLEAN DEFAULT false,
    discount_code VARCHAR(100),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    promo_voucher VARCHAR(100),
    email_sent BOOLEAN DEFAULT false,
    reminder_sent BOOLEAN DEFAULT false,
    
    -- Multi-session booking tracking
    is_part_of_multi_session BOOLEAN DEFAULT false, -- Is this booking part of a multi-session service?
    session_group_id UUID, -- Links all sessions together (all sessions share same group ID)
    session_number INTEGER DEFAULT 1, -- Which session is this? (1, 2, 3, etc.)
    total_sessions INTEGER DEFAULT 1, -- Total sessions in this group (3, 10, etc.)
    
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
    promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL, -- Optional promotion link for bot
    questionnaire_id UUID REFERENCES questionnaires(id) ON DELETE SET NULL, -- Optional questionnaire link
    promotion_after_completion BOOLEAN DEFAULT FALSE, -- Give promotion after questionnaire completion
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
    type VARCHAR(50) NOT NULL DEFAULT 'anamnesis',
    description TEXT,
    questions JSONB NOT NULL, -- Array of question objects with type, options, required
    is_active BOOLEAN DEFAULT true,
    trigger_type VARCHAR(100), -- 'manual', 'before_booking', 'after_booking', 'first_contact', 'service_specific'
    
    -- Phase 2: Service & Promotion Linking (October 21, 2025)
    linked_services UUID[], -- Service IDs for service-specific questionnaires
    linked_promotions UUID[], -- Promotion IDs for promotion-linked questionnaires
    
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
CREATE INDEX IF NOT EXISTS idx_bookings_team_member ON bookings(team_member_id);
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_strategy ON bookings(assigned_strategy);
CREATE INDEX idx_contacts_phone_number ON contacts(phone_number);
-- Phase 1 CRM indexes for efficient querying (October 21, 2025)
CREATE INDEX IF NOT EXISTS idx_contacts_preferred_staff ON contacts(preferred_staff) WHERE preferred_staff IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_allergies ON contacts(allergies) WHERE allergies IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_physical_limitations ON contacts(physical_limitations) WHERE physical_limitations IS NOT NULL;
CREATE INDEX idx_waitlist_contact_id ON waitlist(contact_id);
CREATE INDEX idx_waitlist_status ON waitlist(status);
CREATE INDEX idx_questionnaire_responses_contact_id ON questionnaire_responses(contact_id);
-- Phase 2 questionnaire indexes (October 21, 2025)
CREATE INDEX IF NOT EXISTS idx_questionnaires_trigger_type ON questionnaires(trigger_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_questionnaires_linked_services ON questionnaires USING GIN(linked_services) WHERE linked_services IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_questionnaires_active ON questionnaires(is_active);
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
    trigger_words JSONB DEFAULT '[]', -- Keywords bot recognizes for this service e.g. ["massage", "therapy", "treatment"]
    booking_time_restrictions JSONB, -- Time restrictions JSON: {"days":["monday","wednesday"],"hours":"09:00-17:00"}
    
    -- Multi-session booking configuration
    requires_multiple_sessions BOOLEAN DEFAULT false, -- Service needs multiple appointments
    total_sessions_required INTEGER DEFAULT 1, -- How many sessions total (e.g. 3 for implant, 10 for driving lessons)
    multi_session_strategy VARCHAR(20) DEFAULT 'flexible' CHECK (multi_session_strategy IN ('immediate', 'sequential', 'flexible')),
    -- immediate = book all sessions upfront; sequential = book one at a time after completion; flexible = customer chooses
    session_buffer_config JSONB, -- Buffer times between sessions e.g. {"default_days": 7, "session_2_to_3_days": 30}
    
    -- Recurring service reminder configuration (for services like yearly dental checkups, quarterly maintenance, etc.)
    recurring_reminder_enabled BOOLEAN DEFAULT false, -- Enable automatic reminders for this service
    recurring_interval_days INTEGER DEFAULT 365, -- Days between recurring appointments (365 = yearly, 90 = quarterly, 30 = monthly)
    recurring_reminder_days_before INTEGER DEFAULT 14, -- Start reminding customer X days before next due date
    recurring_reminder_message TEXT, -- Custom message template for recurring reminders (supports {{name}}, {{service}}, {{last_date}}, {{next_date}})
    
    metadata JSONB, -- Extra configuration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emergency/Blocker Slots (times when bot should NOT book appointments)
CREATE TABLE IF NOT EXISTS emergency_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL, -- e.g. "Emergency Surgery", "Staff Meeting", "Blocked for Maintenance"
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT, -- Optional explanation
    is_recurring BOOLEAN DEFAULT false, -- If true, repeats weekly
    created_by UUID REFERENCES agents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_slots_time ON emergency_slots(start_time, end_time);

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

-- Document deliveries tracking
CREATE TABLE IF NOT EXISTS document_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES service_documents(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    delivery_method VARCHAR(20) CHECK (delivery_method IN ('email', 'whatsapp', 'both')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'acknowledged')),
    sent_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
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
    currency VARCHAR(10) DEFAULT 'CHF',
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

-- Reminder logs already created above (avoiding duplicate)

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
CREATE TRIGGER update_document_deliveries_updated_at BEFORE UPDATE ON document_deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
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

-- No-show tracking table
CREATE TABLE IF NOT EXISTS no_show_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    no_show_date TIMESTAMP WITH TIME ZONE NOT NULL,
    penalty_applied BOOLEAN DEFAULT false,
    penalty_fee DECIMAL(10,2) DEFAULT 0,
    follow_up_sent BOOLEAN DEFAULT false,
    follow_up_sent_at TIMESTAMP WITH TIME ZONE,
    strike_count INTEGER DEFAULT 1,
    suspension_until TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for no_show_tracking
CREATE INDEX IF NOT EXISTS idx_no_show_tracking_contact ON no_show_tracking(contact_id);
CREATE INDEX IF NOT EXISTS idx_no_show_tracking_booking ON no_show_tracking(booking_id);
CREATE INDEX IF NOT EXISTS idx_no_show_tracking_date ON no_show_tracking(no_show_date);
CREATE INDEX IF NOT EXISTS idx_no_show_tracking_suspension ON no_show_tracking(suspension_until) WHERE suspension_until IS NOT NULL;

-- Add trigger for no_show_tracking updated_at
CREATE TRIGGER update_no_show_tracking_updated_at BEFORE UPDATE ON no_show_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings for no-show protection
INSERT INTO settings (key, value, category, description, is_secret)
VALUES 
    ('no_show_detection_hours', '2', 'no_show', 'Hours after appointment start to auto-detect no-show', false),
    ('no_show_penalty_enabled', 'true', 'no_show', 'Enable penalty fees for no-shows', false),
    ('no_show_penalty_type', 'fixed', 'no_show', 'Penalty type: fixed or percentage', false),
    ('no_show_penalty_amount', '75', 'no_show', 'Penalty amount for no-shows', false),
    ('no_show_strike_limit', '3', 'no_show', 'Number of no-shows before suspension', false),
    ('no_show_suspension_days', '30', 'no_show', 'Days to suspend booking privileges after strike limit', false),
    ('no_show_follow_up_enabled', 'true', 'no_show', 'Send follow-up message after no-show', false)
ON CONFLICT (key) DO NOTHING;

-- Insert default cancellation policy (CHF currency)
INSERT INTO cancellation_policies (name, hours_before_appointment, penalty_type, penalty_amount, is_active)
VALUES ('Default 24h Policy', 24, 'fixed', 50.00, true)
ON CONFLICT DO NOTHING;

-- Insert default language setting (GPT supports all languages, no limitation)
INSERT INTO settings (key, value, category, description, is_secret)
VALUES ('default_bot_language', 'de', 'bot', 'Default language for bot responses (GPT supports all languages)', false)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- BOT CONFIGURATION SETTINGS (Comprehensive)
-- ============================================

-- Business Information
INSERT INTO settings (key, value, category, description, is_secret) VALUES
('business_name', 'My Business', 'bot_config', 'Business name displayed to customers', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, category, description, is_secret) VALUES
('business_location', '', 'bot_config', 'Physical business address for appointments', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, category, description, is_secret) VALUES
('business_directions', '', 'bot_config', 'How to reach the business (Anfahrtsbeschreibung)', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, category, description, is_secret) VALUES
('business_opening_hours', '{"monday":"09:00-18:00","tuesday":"09:00-18:00","wednesday":"09:00-18:00","thursday":"09:00-18:00","friday":"09:00-18:00","saturday":"10:00-14:00","sunday":"closed"}', 'bot_config', 'JSON object with opening hours per day', false)
ON CONFLICT (key) DO NOTHING;

-- Bot Prompts (Two-Tier System)
INSERT INTO settings (key, value, category, description, is_secret) VALUES
('bot_business_prompt', 'We are a professional service provider focused on quality and customer satisfaction. Maintain a friendly yet professional tone. Show empathy and patience. Use clear, concise language. Always confirm customer understanding before proceeding with bookings.', 'bot_config', 'Business fine-tuning prompt (editable) - defines tone, style, and personality', false)
ON CONFLICT (key) DO NOTHING;

-- Email Collection Settings
INSERT INTO settings (key, value, category, description, is_secret) VALUES
('booking_email_mandatory', 'false', 'bot_config', 'Require email before confirming bookings (true/false)', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, category, description, is_secret) VALUES
('booking_email_collection_prompt', 'gentle', 'bot_config', 'How to ask for email: "gentle" (optional, ask once) or "mandatory" (required for booking)', false)
ON CONFLICT (key) DO NOTHING;

-- Confirmation Templates
INSERT INTO settings (key, value, category, description, is_secret) VALUES
('whatsapp_confirmation_enabled', 'true', 'bot_config', 'Send WhatsApp booking confirmations', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, category, description, is_secret) VALUES
('whatsapp_confirmation_template', '✅ *Booking Confirmed*\n\nHello {{name}}!\n\nYour appointment is confirmed:\n\n📅 *Service:* {{service}}\n🕐 *Date & Time:* {{datetime}}\n💰 *Cost:* CHF {{cost}}\n📍 *Location:* {{location}}\n\n{{directions}}\n\nWe look forward to seeing you!', 'bot_config', 'WhatsApp confirmation message template with placeholders', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, category, description, is_secret) VALUES
('email_confirmation_enabled', 'true', 'bot_config', 'Send email booking confirmations', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, category, description, is_secret) VALUES
('email_confirmation_template', 'Dear {{name}},\n\nYour appointment has been confirmed.\n\nService: {{service}}\nDate & Time: {{datetime}}\nCost: CHF {{cost}}\nLocation: {{location}}\n\n{{directions}}\n\nIf you need to cancel or reschedule, please contact us at least 24 hours in advance.\n\nBest regards,\n{{business_name}}', 'bot_config', 'Email confirmation message template with placeholders', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, category, description, is_secret) VALUES
('email_confirmation_subject', 'Booking Confirmation - {{service}} on {{date}}', 'bot_config', 'Email subject line template', false)
ON CONFLICT (key) DO NOTHING;

-- Escalation Triggers (DEPRECATED - moved to escalation_config)
INSERT INTO settings (key, value, category, description, is_secret) VALUES
('escalation_trigger_words', '["complaint","angry","refund","cancel subscription","speak to manager","terrible","awful","disappointed"]', 'bot_config', 'DEPRECATED: Use escalation_config instead', false)
ON CONFLICT (key) DO NOTHING;

-- Escalation Configuration (Consolidated, User-Friendly)
INSERT INTO settings (key, value, category, description, is_secret) VALUES
('escalation_config', '{
  "mode": "sentiment_and_keyword",
  "enabled": true,
  "triggers": {
    "keywords": ["complaint", "angry", "refund", "cancel subscription", "speak to manager", "terrible", "awful", "disappointed", "lawyer", "legal"],
    "sentiment_threshold": -0.3,
    "inactivity_timeout_minutes": 30,
    "manual_flags": ["urgent", "vip_customer"]
  },
  "behavior": {
    "auto_takeover": false,
    "notify_agents": true,
    "pause_bot": true,
    "escalation_message": "I understand this is important. Let me connect you with our team right away.",
    "agent_notification": "🚨 Escalation: {reason} | Customer: {name} | Sentiment: {sentiment}"
  },
  "modes_available": {
    "keyword_only": "Escalate only when trigger keywords detected",
    "sentiment_only": "Escalate only when sentiment drops below threshold",
    "sentiment_and_keyword": "Escalate when EITHER sentiment is low OR keywords detected",
    "sentiment_then_keyword": "Escalate when sentiment is low AND keywords detected",
    "manual_only": "Only escalate when manually flagged by agent"
  },
  "test_scenarios": {
    "negative_sentiment": "Test with: I am very disappointed and frustrated",
    "trigger_word": "Test with: I want a refund immediately",
    "combined": "Test with: This is terrible, I want to speak to a manager"
  }
}', 'bot_config', 'Comprehensive escalation configuration with modes, triggers, and behavior', false)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- MULTI-TEAM MEMBER SYSTEM - MIGRATION & SEED DATA
-- ============================================

-- Create default "General Calendar" team member for backward compatibility
-- This allows existing installations to continue working without immediate team member setup
INSERT INTO team_members (
    id, 
    name, 
    role, 
    bio, 
    calendar_provider, 
    calendar_source_url,
    calendar_secret_ref,
    is_active, 
    is_bookable,
    default_priority,
    display_order
) VALUES (
    '00000000-0000-0000-0000-000000000001', -- Fixed UUID for default team member
    'General Calendar',
    'Default Provider',
    'Default calendar for appointments when no specific team member is selected.',
    'google', -- Or 'ical' depending on existing setup
    '', -- Will be populated from existing calendar settings
    'GOOGLE_CALENDAR_DEFAULT', -- Reference to existing calendar secret
    true,
    true,
    0,
    999 -- Display last in lists
) ON CONFLICT (id) DO NOTHING;

-- Note: Admins should configure proper team members and deprecate this default

-- ============================================
-- WhatsApp CRM Bot - Promotion & Payment System Schema Updates
-- Date: October 16, 2025

-- ============================================
-- 1. UPDATE CONTACTS TABLE FOR MANUAL/CSV IMPORT
-- ============================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'whatsapp' CHECK (source IN ('whatsapp', 'manual', 'csv_import'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS import_batch_id UUID;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags TEXT[]; -- For segmentation

CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts(source);
CREATE INDEX IF NOT EXISTS idx_contacts_import_batch ON contacts(import_batch_id);

-- ============================================
-- 2. PROMOTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    promotion_type VARCHAR(50) NOT NULL CHECK (promotion_type IN ('service_discount', 'voucher', 'reactivation')),
    
    -- Service linkage
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    applies_to_all_services BOOLEAN DEFAULT false,
    
    -- Discount configuration
    discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('fixed_chf', 'percentage')),
    discount_value DECIMAL(10,2) NOT NULL, -- CHF amount or percentage
    max_discount_chf DECIMAL(10,2), -- Cap for percentage discounts
    
    -- Voucher code
    voucher_code VARCHAR(100) UNIQUE,
    code_required BOOLEAN DEFAULT false, -- If true, customer must enter code
    
    -- Validity
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER, -- NULL = unlimited
    uses_count INTEGER DEFAULT 0,
    max_uses_per_customer INTEGER DEFAULT 1,
    
    -- Audience targeting (for marketing campaigns)
    target_audience JSONB, -- {sentiment: ['negative'], inactive_days: 90, no_conversation: true, etc}
    
    -- Bot autonomy settings
    bot_can_offer BOOLEAN DEFAULT false, -- Bot can autonomously offer this
    bot_max_chf DECIMAL(10,2) DEFAULT 0, -- Max CHF bot can offer without admin approval
    requires_admin_approval BOOLEAN DEFAULT true,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES agents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_service ON promotions(service_id);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(voucher_code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, valid_from, valid_until);

-- ============================================
-- 3. PROMOTION USAGE TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS promotion_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    discount_applied_chf DECIMAL(10,2) NOT NULL,
    original_price_chf DECIMAL(10,2) NOT NULL,
    final_price_chf DECIMAL(10,2) NOT NULL,
    offered_by VARCHAR(50) CHECK (offered_by IN ('bot_autonomous', 'bot_approved', 'agent', 'customer_entered')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion ON promotion_usage(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_contact ON promotion_usage(contact_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_booking ON promotion_usage(booking_id);

-- ============================================
-- 4. BOT DISCOUNT REQUESTS (Admin Approval Queue)
-- ============================================

CREATE TABLE IF NOT EXISTS bot_discount_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Bot's recommendation
    recommended_discount_chf DECIMAL(10,2) NOT NULL,
    recommended_service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    reason TEXT NOT NULL, -- Bot explains why (sentiment, inactivity, etc)
    bot_confidence DECIMAL(3,2), -- 0.00-1.00 confidence score
    
    -- Context for admin
    customer_sentiment VARCHAR(50), -- negative, neutral, positive
    days_inactive INTEGER,
    total_bookings INTEGER DEFAULT 0,
    total_spent_chf DECIMAL(10,2) DEFAULT 0,
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    
    -- Admin decision
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    reviewed_by UUID REFERENCES agents(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT,
    
    -- If approved, track the created promotion
    created_promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL,
    
    -- Auto-expire after 7 days
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_discount_status ON bot_discount_requests(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_bot_discount_contact ON bot_discount_requests(contact_id);

-- ============================================
-- 5. STRIPE PAYMENT LINKS
-- ============================================

CREATE TABLE IF NOT EXISTS payment_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Stripe data
    stripe_checkout_session_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    checkout_url TEXT NOT NULL,
    
    -- Pricing
    amount_chf DECIMAL(10,2) NOT NULL,
    original_amount_chf DECIMAL(10,2), -- Before discount
    promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL,
    discount_applied_chf DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'expired', 'cancelled')),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Tracking
    sent_via_whatsapp BOOLEAN DEFAULT false,
    whatsapp_message_id VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_links_booking ON payment_links(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_stripe_session ON payment_links(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_status ON payment_links(payment_status);

-- ============================================
-- 6. UPDATE BOOKINGS TABLE
-- ============================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS original_price_chf DECIMAL(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_price_chf DECIMAL(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_link_sent BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_link_sent_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_bookings_promotion ON bookings(promotion_id);
CREATE INDEX IF NOT EXISTS idx_bookings_session_group ON bookings(session_group_id);
CREATE INDEX IF NOT EXISTS idx_bookings_multi_session ON bookings(is_part_of_multi_session, session_group_id);

-- ============================================
-- 7. CSV IMPORT BATCHES (Track bulk uploads)
-- ============================================

CREATE TABLE IF NOT EXISTS csv_import_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    total_rows INTEGER NOT NULL,
    successful_imports INTEGER DEFAULT 0,
    failed_imports INTEGER DEFAULT 0,
    errors JSONB, -- Store validation errors
    status VARCHAR(50) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_csv_batches_uploaded_by ON csv_import_batches(uploaded_by);

-- ============================================
-- 8. BOT SETTINGS FOR DISCOUNT AUTONOMY
-- ============================================

-- Add to settings table (already exists, just insert defaults)
INSERT INTO settings (key, value, description) VALUES
('bot_max_autonomous_discount_chf', '20', 'Maximum CHF the bot can offer autonomously without admin approval')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, description) VALUES
('bot_discount_sentiment_threshold', '-0.3', 'Sentiment score threshold for bot to consider offering discount (-1 to 1)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, description) VALUES
('bot_discount_inactive_days_threshold', '90', 'Days of inactivity before bot considers reactivation discount')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, description) VALUES
('bot_discount_enabled', 'false', 'Enable bot autonomous discount offering')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 9. ANALYTICS VIEWS
-- ============================================

-- View for promotion performance
CREATE OR REPLACE VIEW promotion_performance AS
SELECT 
    p.id,
    p.name,
    p.voucher_code,
    p.discount_type,
    p.discount_value,
    p.uses_count,
    p.max_uses,
    COUNT(pu.id) as actual_uses,
    SUM(pu.discount_applied_chf) as total_discount_given_chf,
    SUM(pu.final_price_chf) as total_revenue_chf,
    AVG(pu.discount_applied_chf) as avg_discount_chf,
    p.is_active,
    p.valid_from,
    p.valid_until
FROM promotions p
LEFT JOIN promotion_usage pu ON p.id = pu.promotion_id
GROUP BY p.id, p.name, p.voucher_code, p.discount_type, p.discount_value, 
         p.uses_count, p.max_uses, p.is_active, p.valid_from, p.valid_until;

-- View for bot discount request analytics
CREATE OR REPLACE VIEW bot_discount_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as request_date,
    status,
    COUNT(*) as request_count,
    AVG(recommended_discount_chf) as avg_recommended_chf,
    AVG(bot_confidence) as avg_confidence,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
FROM bot_discount_requests
GROUP BY DATE_TRUNC('day', created_at), status
ORDER BY request_date DESC;

-- ============================================
-- 10. FUNCTIONS AND TRIGGERS
-- ============================================

-- Auto-increment promotion usage count
CREATE OR REPLACE FUNCTION increment_promotion_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE promotions 
    SET uses_count = uses_count + 1,
        updated_at = NOW()
    WHERE id = NEW.promotion_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_promotion_usage
AFTER INSERT ON promotion_usage
FOR EACH ROW
EXECUTE FUNCTION increment_promotion_usage();

-- Auto-expire old bot discount requests
CREATE OR REPLACE FUNCTION expire_old_bot_requests()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'pending' AND NEW.expires_at < NOW() THEN
        NEW.status := 'expired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_expire_bot_requests
BEFORE UPDATE ON bot_discount_requests
FOR EACH ROW
EXECUTE FUNCTION expire_old_bot_requests();

-- ============================================
-- BOT CONFIGURATION RESTRUCTURE (October 22, 2025)
-- Phase 4: Service Booking Windows & Service-Specific Blockers
-- ============================================

-- Service Booking Windows (replaces booking_time_restrictions JSONB)
-- Allows Calendly-style day-specific availability per service
-- Example: Dental cleanings only on Monday 9-12, Wednesday 8-16, Friday 14-18
CREATE TABLE IF NOT EXISTS service_booking_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL, -- e.g. 09:00
    end_time TIME NOT NULL, -- e.g. 17:00
    is_active BOOLEAN DEFAULT true, -- Can temporarily disable without deleting
    valid_from DATE, -- Optional: window only valid from this date
    valid_until DATE, -- Optional: window expires after this date
    notes TEXT, -- e.g. "Summer hours", "Holiday schedule"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure end_time is after start_time
    CHECK (end_time > start_time),
    
    -- Prevent duplicate windows for same service/day
    UNIQUE(service_id, day_of_week, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_service_booking_windows_service ON service_booking_windows(service_id);
CREATE INDEX IF NOT EXISTS idx_service_booking_windows_active ON service_booking_windows(is_active);
CREATE INDEX IF NOT EXISTS idx_service_booking_windows_day ON service_booking_windows(day_of_week);

-- Service Blockers (service-specific unavailable times)
-- Unlike emergency_slots (global blockers), these are per-service
-- Example: Dental implant surgery blocked Dec 20-Jan 5 (holiday break)
CREATE TABLE IF NOT EXISTS service_blockers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL, -- e.g. "Holiday Break", "Equipment Maintenance"
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT, -- Optional explanation
    is_recurring BOOLEAN DEFAULT false, -- If true, repeats (e.g. every Monday)
    recurrence_pattern VARCHAR(50), -- 'weekly', 'monthly', 'yearly'
    recurrence_end_date TIMESTAMP WITH TIME ZONE, -- When recurrence stops
    created_by UUID REFERENCES agents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure end_time is after start_time
    CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_service_blockers_service ON service_blockers(service_id);
CREATE INDEX IF NOT EXISTS idx_service_blockers_time ON service_blockers(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_service_blockers_recurring ON service_blockers(is_recurring);

-- Update triggers for new tables
CREATE TRIGGER update_service_booking_windows_updated_at BEFORE UPDATE ON service_booking_windows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_blockers_updated_at BEFORE UPDATE ON service_blockers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEPLOYMENT NOTES
-- ============================================

-- This schema includes ALL production features:
-- Phase 1: CRM customer insight extraction (10 new contact fields)
-- Phase 2: Marketing campaigns, promotions, payment links, CSV imports
-- Phase 3: Multi-session booking system (immediate/sequential/flexible strategies)
-- Phase 4: Bot configuration restructure with service booking windows
-- 1. Full promotion system with service-specific discounts
-- 2. Bot autonomous discount offering with admin approval queue
-- 3. Payment link tracking for Stripe checkout
-- 4. CSV import support for customer lists
-- 5. Comprehensive promotion usage analytics
-- 6. Security: Bot autonomy capped at configurable CHF limit
-- 7. Balance sheet protection through admin approval workflow
-- 8. Multi-session bookings with session grouping and auto-triggers
-- 9. Service booking windows and service-specific blockers

-- Deploy via: GitHub Actions → .github/workflows/deploy-supabase.yml
-- Deployment date: October 22, 2025
-- Phase 4: Service booking windows deployed Wed Oct 22 08:08:09 AM UTC 2025
