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
