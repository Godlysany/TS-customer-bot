-- Phase 2: Add service and promotion linking to questionnaires
-- Allows service-specific questionnaires and promotion-linked questionnaires

-- Add linking columns
ALTER TABLE questionnaires
ADD COLUMN IF NOT EXISTS linked_services UUID[],
ADD COLUMN IF NOT EXISTS linked_promotions UUID[];

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_questionnaires_trigger_type 
  ON questionnaires(trigger_type) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_questionnaires_linked_services 
  ON questionnaires USING GIN(linked_services) 
  WHERE linked_services IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questionnaires_active 
  ON questionnaires(is_active);

-- Update comments
COMMENT ON COLUMN questionnaires.linked_services IS 'Service IDs for service-specific questionnaires (trigger_type = service_specific)';
COMMENT ON COLUMN questionnaires.linked_promotions IS 'Promotion IDs for promotion-linked questionnaires';
COMMENT ON COLUMN questionnaires.trigger_type IS 'Trigger options: manual, before_booking, after_booking, first_contact, service_specific';
-- Add CRM customer insight fields to contacts table
-- These columns store automatically extracted customer data from conversations
-- Part of Phase 1: Production Readiness Fixes

-- Add CRM insight columns
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS preferred_times TEXT,
ADD COLUMN IF NOT EXISTS preferred_staff TEXT,
ADD COLUMN IF NOT EXISTS preferred_services TEXT,
ADD COLUMN IF NOT EXISTS fears_anxieties TEXT,
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS physical_limitations TEXT,
ADD COLUMN IF NOT EXISTS special_requests TEXT,
ADD COLUMN IF NOT EXISTS communication_preferences JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS behavioral_notes TEXT,
ADD COLUMN IF NOT EXISTS customer_insights TEXT;

-- Add index for efficient querying of contacts with specific preferences
CREATE INDEX IF NOT EXISTS idx_contacts_preferred_staff ON contacts(preferred_staff) WHERE preferred_staff IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_allergies ON contacts(allergies) WHERE allergies IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_physical_limitations ON contacts(physical_limitations) WHERE physical_limitations IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN contacts.preferred_times IS 'Customer''s preferred appointment times (e.g., "mornings", "Tuesdays only")';
COMMENT ON COLUMN contacts.preferred_staff IS 'Preferred staff members or providers';
COMMENT ON COLUMN contacts.preferred_services IS 'Services the customer is interested in';
COMMENT ON COLUMN contacts.fears_anxieties IS 'Dental anxiety, needle phobia, claustrophobia, etc.';
COMMENT ON COLUMN contacts.allergies IS 'Latex, medications, materials allergies';
COMMENT ON COLUMN contacts.physical_limitations IS 'Wheelchair access, hearing/vision issues, mobility concerns';
COMMENT ON COLUMN contacts.special_requests IS 'Quiet environment, companion, child-friendly, cultural/religious needs';
COMMENT ON COLUMN contacts.communication_preferences IS 'How customer prefers to be contacted (JSON)';
COMMENT ON COLUMN contacts.behavioral_notes IS 'Punctuality patterns, communication style, personality traits';
COMMENT ON COLUMN contacts.customer_insights IS 'General observations and other relevant insights';
-- Migration: Add recurring service reminder configuration to services table
-- Created: October 22, 2025
-- Purpose: Enable automatic proactive reminders for recurring services (yearly dental, quarterly maintenance, etc.)

ALTER TABLE services 
ADD COLUMN IF NOT EXISTS recurring_reminder_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurring_interval_days INTEGER DEFAULT 365,
ADD COLUMN IF NOT EXISTS recurring_reminder_days_before INTEGER DEFAULT 14,
ADD COLUMN IF NOT EXISTS recurring_reminder_message TEXT;

-- Add helpful comment
COMMENT ON COLUMN services.recurring_reminder_enabled IS 'Enable automatic reminders for this recurring service';
COMMENT ON COLUMN services.recurring_interval_days IS 'Days between recurring appointments (365=yearly, 90=quarterly, 30=monthly)';
COMMENT ON COLUMN services.recurring_reminder_days_before IS 'Start reminding customer X days before next due date';
COMMENT ON COLUMN services.recurring_reminder_message IS 'Custom message template supporting {{name}}, {{service}}, {{last_date}}, {{next_date}} placeholders';

-- Create index for efficient scheduler queries
CREATE INDEX IF NOT EXISTS idx_services_recurring_enabled ON services(recurring_reminder_enabled) WHERE recurring_reminder_enabled = true;
-- Add document/image attachment fields to services and promotions
-- Created: October 23, 2025
-- Purpose: Enable document sharing and image attachments for services and promotions

-- Extend services table with document attachment fields
ALTER TABLE services ADD COLUMN IF NOT EXISTS document_url TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS document_name VARCHAR(255);
ALTER TABLE services ADD COLUMN IF NOT EXISTS document_timing VARCHAR(20) DEFAULT 'as_info' 
  CHECK (document_timing IN ('as_info', 'on_confirmation', 'after_booking'));
ALTER TABLE services ADD COLUMN IF NOT EXISTS document_description TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS document_keywords JSONB DEFAULT '[]'::jsonb;
ALTER TABLE services ADD COLUMN IF NOT EXISTS document_storage_path TEXT;

-- Extend promotions table with image attachment
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS image_name VARCHAR(255);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_services_document_timing ON services(document_timing) WHERE document_url IS NOT NULL;

-- Add updated_at trigger for timestamp tracking
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create document_deliveries table for tracking sent documents
CREATE TABLE IF NOT EXISTS document_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    document_url TEXT NOT NULL,
    document_name TEXT,
    delivery_method VARCHAR(20) CHECK (delivery_method IN ('whatsapp', 'email', 'both')),
    delivery_trigger VARCHAR(20) CHECK (delivery_trigger IN ('keyword', 'confirmation', 'completion', 'manual')),
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'acknowledged')),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for document_deliveries
CREATE INDEX IF NOT EXISTS idx_doc_deliveries_contact ON document_deliveries(contact_id);
CREATE INDEX IF NOT EXISTS idx_doc_deliveries_service ON document_deliveries(service_id);
CREATE INDEX IF NOT EXISTS idx_doc_deliveries_sent_at ON document_deliveries(sent_at);
CREATE INDEX IF NOT EXISTS idx_doc_deliveries_trigger ON document_deliveries(delivery_trigger);

-- Unique constraint to prevent duplicate document deliveries
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_deliveries_unique 
ON document_deliveries(contact_id, service_id, delivery_trigger, DATE(sent_at));

-- Comment documentation
COMMENT ON COLUMN services.document_url IS 'Supabase Storage URL for service-specific document (PDF, image, etc.)';
COMMENT ON COLUMN services.document_timing IS 'When to send document: as_info (with service details), on_confirmation (when booking confirmed), after_booking (after appointment completed)';
COMMENT ON COLUMN services.document_keywords IS 'JSONB array of trigger keywords for as_info document delivery';
COMMENT ON COLUMN promotions.image_url IS 'Supabase Storage URL for promotion image/banner';
COMMENT ON TABLE document_deliveries IS 'Tracks all document deliveries to customers with delivery status and trigger source';
-- Add nurturing-related fields to contacts table
-- October 23, 2025 - Client Nurturing System Enhancement

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birthdate DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_out_marketing BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_out_birthday_wishes BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_out_reviews BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_review_request_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_birthday_message_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS nurturing_frequency VARCHAR(20) DEFAULT 'normal' CHECK (nurturing_frequency IN ('high', 'normal', 'low', 'paused'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS google_review_submitted BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS google_review_submitted_at TIMESTAMP WITH TIME ZONE;

-- Create index for birthday reminders
CREATE INDEX IF NOT EXISTS idx_contacts_birthdate ON contacts(birthdate) WHERE birthdate IS NOT NULL;

-- Create nurturing settings table for global configuration
CREATE TABLE IF NOT EXISTS nurturing_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default nurturing settings
INSERT INTO nurturing_settings (setting_key, setting_value, description)
VALUES 
    ('google_business_url', '', 'Google Business Profile URL for review collection'),
    ('birthday_wish_enabled', 'true', 'Send automated birthday wishes'),
    ('birthday_wish_template', 'Happy Birthday {name}! 🎉 Wishing you a wonderful day. As a special gift, we''d like to offer you a 10% discount on your next appointment.', 'Template for birthday messages'),
    ('review_request_enabled', 'true', 'Send automated review requests after appointments'),
    ('review_request_delay_hours', '24', 'Hours to wait after appointment before requesting review'),
    ('review_request_template', 'Hi {name}, thank you for choosing us! We hope you had a great experience. Would you mind sharing your feedback on Google? {review_link}', 'Template for review requests'),
    ('new_contact_nurture_enabled', 'true', 'Enable nurturing campaigns for contacts without booking history'),
    ('new_contact_nurture_delay_days', '7', 'Days to wait before starting new contact nurturing'),
    ('post_appointment_followup_enabled', 'true', 'Send follow-up messages after appointments'),
    ('post_appointment_followup_delay_hours', '48', 'Hours after appointment to send follow-up')
ON CONFLICT (setting_key) DO NOTHING;

-- Add trigger for nurturing_settings updated_at
CREATE TRIGGER update_nurturing_settings_updated_at 
BEFORE UPDATE ON nurturing_settings 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Create nurturing activity log for transparency
CREATE TABLE IF NOT EXISTS nurturing_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('birthday_wish', 'review_request', 'new_contact_outreach', 'post_appointment_followup', 'reactivation', 'questionnaire_trigger')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'completed', 'cancelled')),
    message_content TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for nurturing activity log
CREATE INDEX IF NOT EXISTS idx_nurturing_activity_contact ON nurturing_activity_log(contact_id);
CREATE INDEX IF NOT EXISTS idx_nurturing_activity_type ON nurturing_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_nurturing_activity_status ON nurturing_activity_log(status);
CREATE INDEX IF NOT EXISTS idx_nurturing_activity_sent ON nurturing_activity_log(sent_at) WHERE sent_at IS NOT NULL;

-- Add trigger for nurturing_activity_log updated_at
CREATE TRIGGER update_nurturing_activity_log_updated_at 
BEFORE UPDATE ON nurturing_activity_log 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE nurturing_settings IS 'Global configuration for client nurturing features';
COMMENT ON TABLE nurturing_activity_log IS 'Audit log for all nurturing activities to provide admin transparency';
COMMENT ON COLUMN contacts.birthdate IS 'Customer birthdate for birthday wishes and age-related insights';
COMMENT ON COLUMN contacts.opt_out_marketing IS 'Customer opted out of marketing campaigns';
COMMENT ON COLUMN contacts.opt_out_birthday_wishes IS 'Customer opted out of birthday messages';
COMMENT ON COLUMN contacts.opt_out_reviews IS 'Customer opted out of review requests';
COMMENT ON COLUMN contacts.nurturing_frequency IS 'How often this contact should receive nurturing messages (high/normal/low/paused)';
-- Add unique constraint on service name to prevent duplicate services
-- October 23, 2025 - Fix for duplicate services issue

-- First, clean up any existing duplicates (keep the oldest record for each name)
DELETE FROM services
WHERE id NOT IN (
    SELECT MIN(id)
    FROM services
    GROUP BY name
);

-- Now add the unique constraint
ALTER TABLE services ADD CONSTRAINT services_name_unique UNIQUE (name);

COMMENT ON CONSTRAINT services_name_unique ON services IS 'Prevents duplicate service names in the system';
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

-- Message approval system columns (for pre-approval workflow)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) CHECK (approval_status IN ('pending_approval', 'sending', 'approved', 'rejected'));
ALTER TABLE messages ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES agents(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES agents(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;

-- Index for efficient approval queue queries
CREATE INDEX IF NOT EXISTS idx_messages_approval_status ON messages(approval_status) WHERE approval_status = 'pending_approval';
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_id ON messages(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;

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
-- Payment Enforcement System for Swiss B2B CRM
-- Created: October 24, 2025
-- Purpose: Complete payment tracking, penalty enforcement, and overdue collection system

-- ====================
-- 1. STANDARDIZE CURRENCY TO CHF
-- ====================

-- Update payment_transactions to use CHF as default (Swiss market)
ALTER TABLE payment_transactions ALTER COLUMN currency SET DEFAULT 'CHF';

-- Note: amount_chf is NOT needed as separate column - we use 'amount' column with CHF currency
-- Removed generated column to allow direct inserts

-- ====================
-- 2. ADD OUTSTANDING BALANCE TRACKING TO CONTACTS
-- ====================

-- Add outstanding balance fields to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS outstanding_balance_chf NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS has_overdue_payments BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS payment_restriction_reason TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS payment_allowance_granted BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS payment_allowance_notes TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS payment_allowance_granted_by UUID; -- Admin ID who granted allowance
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS payment_allowance_granted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_payment_reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for payment queries
CREATE INDEX IF NOT EXISTS idx_contacts_outstanding_balance 
  ON contacts(outstanding_balance_chf) WHERE outstanding_balance_chf > 0;
CREATE INDEX IF NOT EXISTS idx_contacts_overdue_payments 
  ON contacts(has_overdue_payments) WHERE has_overdue_payments = TRUE;
CREATE INDEX IF NOT EXISTS idx_contacts_payment_allowance 
  ON contacts(payment_allowance_granted) WHERE payment_allowance_granted = TRUE;

-- ====================
-- 3. EXTEND PAYMENT_TRANSACTIONS FOR PENALTY ENFORCEMENT
-- ====================

-- Add overdue tracking fields
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS overdue_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS is_penalty BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS related_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS payment_reminder_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS collection_escalated BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS collection_escalated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add constraint to enforce penalty payments have a due date
CREATE OR REPLACE FUNCTION check_penalty_due_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_penalty = TRUE AND NEW.due_date IS NULL THEN
    -- Set due date to 7 days from creation for penalty payments
    NEW.due_date := NOW() + INTERVAL '7 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_penalty_due_date ON payment_transactions;
CREATE TRIGGER set_penalty_due_date
  BEFORE INSERT OR UPDATE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_penalty_due_date();

-- ====================
-- 4. EXTEND BOOKINGS FOR PAYMENT TRACKING
-- ====================

-- Add payment visibility fields to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_required BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_amount_chf NUMERIC(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_reminder_sent BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS calendar_highlight_unpaid BOOLEAN DEFAULT FALSE NOT NULL;

-- Add index for unpaid bookings
CREATE INDEX IF NOT EXISTS idx_bookings_unpaid 
  ON bookings(payment_required, payment_status) 
  WHERE payment_required = TRUE AND payment_status != 'paid';

-- ====================
-- 5. CREATE PAYMENT ESCALATIONS TABLE
-- ====================

CREATE TABLE IF NOT EXISTS payment_escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
  escalation_reason TEXT NOT NULL,
  outstanding_amount_chf NUMERIC(10,2) NOT NULL,
  escalation_level VARCHAR(20) CHECK (escalation_level IN ('reminder', 'urgent', 'collection', 'resolved', 'forgiven')),
  admin_notes TEXT,
  resolved_by UUID, -- Admin ID who resolved escalation
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_action VARCHAR(50) CHECK (resolution_action IN ('paid', 'forgiven', 'payment_plan', 'legal_action', 'customer_allowance')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for payment escalations
CREATE INDEX IF NOT EXISTS idx_payment_escalations_contact ON payment_escalations(contact_id);
CREATE INDEX IF NOT EXISTS idx_payment_escalations_level ON payment_escalations(escalation_level);
CREATE INDEX IF NOT EXISTS idx_payment_escalations_unresolved ON payment_escalations(escalation_level) 
  WHERE escalation_level IN ('reminder', 'urgent', 'collection');

-- ====================
-- 6. CREATE FUNCTION TO CALCULATE OUTSTANDING BALANCE
-- ====================

CREATE OR REPLACE FUNCTION calculate_contact_outstanding_balance(p_contact_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_total NUMERIC(10,2);
BEGIN
  -- Sum ALL pending/failed payments regardless of due date
  -- Outstanding balance reflects any open liability immediately
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total
  FROM payment_transactions
  WHERE contact_id = p_contact_id
    AND status IN ('pending', 'failed');
  
  RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- ====================
-- 7. CREATE FUNCTION TO UPDATE CONTACT OUTSTANDING BALANCE
-- ====================

CREATE OR REPLACE FUNCTION update_contact_outstanding_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_id UUID;
  v_outstanding NUMERIC(10,2);
  v_has_overdue BOOLEAN;
BEGIN
  -- Determine which contact to update (NEW for INSERT/UPDATE, OLD for DELETE)
  IF TG_OP = 'DELETE' THEN
    v_contact_id := OLD.contact_id;
  ELSE
    v_contact_id := NEW.contact_id;
  END IF;

  -- Calculate outstanding balance for this contact
  SELECT calculate_contact_outstanding_balance(v_contact_id)
  INTO v_outstanding;
  
  -- Check if any payments are overdue (past due date and not paid)
  SELECT EXISTS(
    SELECT 1 FROM payment_transactions
    WHERE contact_id = v_contact_id
      AND status IN ('pending', 'failed')
      AND due_date < NOW()
  ) INTO v_has_overdue;
  
  -- Update contact record
  UPDATE contacts
  SET 
    outstanding_balance_chf = v_outstanding,
    has_overdue_payments = v_has_overdue,
    updated_at = NOW()
  WHERE id = v_contact_id;
  
  -- Return appropriate row
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update outstanding balance on ALL status changes
-- INCLUDING 'cancelled', 'forgiven', 'refunded' to properly clear balances
DROP TRIGGER IF EXISTS update_outstanding_balance_on_transaction ON payment_transactions;
DROP TRIGGER IF EXISTS update_outstanding_balance_on_delete ON payment_transactions;

CREATE TRIGGER update_outstanding_balance_on_transaction
  AFTER INSERT OR UPDATE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_outstanding_balance();

CREATE TRIGGER update_outstanding_balance_on_delete
  AFTER DELETE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_outstanding_balance();

-- ====================
-- 8. BACKFILL OUTSTANDING BALANCES FOR EXISTING CONTACTS
-- ====================

-- Update all existing contacts with their current outstanding balance
UPDATE contacts
SET outstanding_balance_chf = calculate_contact_outstanding_balance(id),
    has_overdue_payments = EXISTS(
      SELECT 1 FROM payment_transactions
      WHERE contact_id = contacts.id
        AND status IN ('pending', 'failed')
        AND due_date < NOW()
    );

-- ====================
-- 9. ADD COMMENT DOCUMENTATION
-- ====================

COMMENT ON COLUMN contacts.outstanding_balance_chf IS 'Total unpaid amount (penalties + failed payments) in CHF';
COMMENT ON COLUMN contacts.has_overdue_payments IS 'TRUE if contact has any payment past due date';
COMMENT ON COLUMN contacts.payment_allowance_granted IS 'Admin override to allow booking despite outstanding balance';
COMMENT ON COLUMN contacts.payment_allowance_notes IS 'Admin notes explaining why allowance was granted';

COMMENT ON COLUMN payment_transactions.is_penalty IS 'TRUE for late cancellation penalty fees';
COMMENT ON COLUMN payment_transactions.due_date IS 'Payment deadline - auto-set to +7 days for penalties';
COMMENT ON COLUMN payment_transactions.collection_escalated IS 'TRUE when admin has been notified of overdue payment';

COMMENT ON COLUMN bookings.payment_required IS 'TRUE if upfront payment required for this booking';
COMMENT ON COLUMN bookings.calendar_highlight_unpaid IS 'TRUE to highlight in admin calendar as unpaid';

COMMENT ON TABLE payment_escalations IS 'Tracks overdue payment escalations with admin resolution workflow';

-- ====================
-- H1: QUESTIONNAIRE SESSION PERSISTENCE (HIGH PRIORITY)
-- ====================
-- Prevents customers from losing progress if server restarts mid-questionnaire

CREATE TABLE IF NOT EXISTS questionnaire_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  current_question_index INTEGER NOT NULL DEFAULT 0,
  answers JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  session_data JSONB, -- Store additional context (language, intent, etc.)
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for session lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_questionnaire_sessions_conversation ON questionnaire_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_sessions_active ON questionnaire_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_questionnaire_sessions_expired ON questionnaire_sessions(expires_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_questionnaire_sessions_contact ON questionnaire_sessions(contact_id);

-- Auto-update last_activity_at on answer updates
CREATE OR REPLACE FUNCTION update_questionnaire_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at := NOW();
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS questionnaire_session_activity_trigger ON questionnaire_sessions;
CREATE TRIGGER questionnaire_session_activity_trigger
  BEFORE UPDATE ON questionnaire_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_questionnaire_session_activity();

-- ====================
-- H2: CAMPAIGN DELIVERY TRACKING (HIGH PRIORITY)
-- ====================
-- Prevents duplicate sends or missing contacts if bot crashes mid-campaign

CREATE TABLE IF NOT EXISTS campaign_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  delivery_status VARCHAR(20) CHECK (delivery_status IN ('pending', 'sent', 'failed', 'cancelled')) DEFAULT 'pending',
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  message_content TEXT, -- Personalized message sent to this contact
  idempotency_key VARCHAR(255) UNIQUE, -- Prevent duplicate sends
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  whatsapp_message_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one delivery record per campaign/contact combination
  CONSTRAINT unique_campaign_contact UNIQUE(campaign_id, contact_id)
);

-- Indexes for campaign processing
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_campaign ON campaign_deliveries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_contact ON campaign_deliveries(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_status ON campaign_deliveries(delivery_status);
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_pending ON campaign_deliveries(campaign_id, delivery_status) 
  WHERE delivery_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_scheduled ON campaign_deliveries(scheduled_at, delivery_status) 
  WHERE delivery_status = 'pending';

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_campaign_delivery_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  
  -- Set sent_at when status changes to sent
  IF NEW.delivery_status = 'sent' AND OLD.delivery_status != 'sent' THEN
    NEW.sent_at := NOW();
  END IF;
  
  -- Set failed_at when status changes to failed
  IF NEW.delivery_status = 'failed' AND OLD.delivery_status != 'failed' THEN
    NEW.failed_at := NOW();
    NEW.last_retry_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaign_delivery_timestamps_trigger ON campaign_deliveries;
CREATE TRIGGER campaign_delivery_timestamps_trigger
  BEFORE UPDATE ON campaign_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_delivery_timestamps();

