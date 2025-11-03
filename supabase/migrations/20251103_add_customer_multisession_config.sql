-- Migration: Customer-specific multi-session booking configurations
-- Created: 2025-11-03
-- Purpose: Allow per-customer customization of multi-session booking requirements that override service defaults

-- =====================================================
-- CUSTOMER MULTI-SESSION CONFIG TABLE
-- =====================================================
-- Stores customer-specific overrides for multi-session booking parameters
-- When a customer is undergoing multi-session treatment, this table stores
-- their personalized scheduling requirements

CREATE TABLE IF NOT EXISTS customer_multisession_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  parent_booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE, -- First booking in the series
  
  -- Customer-specific configuration (overrides service defaults)
  is_active BOOLEAN DEFAULT true NOT NULL,
  custom_total_sessions INTEGER, -- NULL means use service default
  custom_strategy VARCHAR(50), -- 'immediate', 'sequential', 'flexible' (NULL = use service default)
  
  -- Per-customer timing requirements
  custom_min_days_between_sessions INTEGER, -- NULL means use service default
  custom_max_days_between_sessions INTEGER, -- NULL means use service default
  custom_buffer_before_minutes INTEGER, -- NULL means use service default
  custom_buffer_after_minutes INTEGER, -- NULL means use service default
  
  -- Custom session-specific configuration (JSONB for flexibility)
  -- Format: {"sessions": [{"session_number": 1, "min_days_from_start": 0, "max_days_from_start": 7}, ...]}
  custom_session_schedule JSONB,
  
  -- Progress tracking
  sessions_completed INTEGER DEFAULT 0,
  sessions_scheduled INTEGER DEFAULT 0,
  sessions_cancelled INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'cancelled', 'paused'
  completion_percentage DECIMAL(5,2) DEFAULT 0.0,
  
  -- Metadata
  notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one config per customer-service combination
  UNIQUE(contact_id, service_id, parent_booking_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_customer_multisession_config_contact ON customer_multisession_config(contact_id);
CREATE INDEX IF NOT EXISTS idx_customer_multisession_config_service ON customer_multisession_config(service_id);
CREATE INDEX IF NOT EXISTS idx_customer_multisession_config_active ON customer_multisession_config(status, is_active) 
  WHERE status = 'active' AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_customer_multisession_config_parent_booking ON customer_multisession_config(parent_booking_id);

COMMENT ON TABLE customer_multisession_config IS 'Customer-specific multi-session booking configurations that override service defaults';
COMMENT ON COLUMN customer_multisession_config.custom_session_schedule IS 'JSON array defining custom timing for each session: [{"session_number": 1, "min_days_from_start": 0, "max_days_from_start": 7}]';
COMMENT ON COLUMN customer_multisession_config.completion_percentage IS 'Calculated as (sessions_completed / custom_total_sessions) * 100';

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_customer_multisession_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  
  -- Auto-calculate completion percentage
  IF NEW.custom_total_sessions IS NOT NULL AND NEW.custom_total_sessions > 0 THEN
    NEW.completion_percentage := (NEW.sessions_completed::DECIMAL / NEW.custom_total_sessions::DECIMAL) * 100.0;
  END IF;
  
  -- Auto-update status based on completion
  IF NEW.sessions_completed >= NEW.custom_total_sessions THEN
    NEW.status := 'completed';
    NEW.completed_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_multisession_config_update_timestamp ON customer_multisession_config;
CREATE TRIGGER customer_multisession_config_update_timestamp
  BEFORE UPDATE ON customer_multisession_config
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_multisession_config_timestamp();
