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
