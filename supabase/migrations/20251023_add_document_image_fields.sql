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
