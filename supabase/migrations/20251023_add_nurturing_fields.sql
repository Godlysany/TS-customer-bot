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
