-- Add document/image attachment fields to services and promotions
-- Created: October 23, 2025
-- Purpose: Enable document sharing and image attachments for services and promotions

-- Extend services table with document attachment fields
ALTER TABLE services ADD COLUMN IF NOT EXISTS document_url TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS document_name VARCHAR(255);
ALTER TABLE services ADD COLUMN IF NOT EXISTS document_timing VARCHAR(20) DEFAULT 'as_info' 
  CHECK (document_timing IN ('as_info', 'on_confirmation', 'after_booking'));
ALTER TABLE services ADD COLUMN IF NOT EXISTS document_description TEXT;

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

-- Comment documentation
COMMENT ON COLUMN services.document_url IS 'Supabase Storage URL for service-specific document (PDF, image, etc.)';
COMMENT ON COLUMN services.document_timing IS 'When to send document: as_info (with service details), on_confirmation (when booking confirmed), after_booking (after appointment completed)';
COMMENT ON COLUMN promotions.image_url IS 'Supabase Storage URL for promotion image/banner';
