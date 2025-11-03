-- Migration: Customer-specific recurring service reminder configurations
-- Created: 2025-11-03
-- Purpose: Allow per-customer customization of recurring service reminders that override service defaults

-- =====================================================
-- CUSTOMER RECURRING REMINDERS TABLE
-- =====================================================
-- Stores customer-specific overrides for recurring service reminders
-- When a customer books a service with recurring reminders enabled,
-- this table stores their personalized schedule

CREATE TABLE IF NOT EXISTS customer_recurring_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  last_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  
  -- Customer-specific configuration (overrides service defaults)
  is_active BOOLEAN DEFAULT true NOT NULL,
  custom_interval_days INTEGER, -- NULL means use service default
  custom_reminder_days_before INTEGER, -- NULL means use service default
  custom_message TEXT, -- NULL means use service default
  
  -- Scheduling metadata
  last_reminder_sent_at TIMESTAMPTZ,
  next_reminder_due_at TIMESTAMPTZ,
  last_completed_booking_at TIMESTAMPTZ, -- Track when they last completed this service
  
  -- History tracking
  total_reminders_sent INTEGER DEFAULT 0,
  total_bookings_completed INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one reminder config per customer-service combination
  UNIQUE(contact_id, service_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_customer_recurring_reminders_contact ON customer_recurring_reminders(contact_id);
CREATE INDEX IF NOT EXISTS idx_customer_recurring_reminders_service ON customer_recurring_reminders(service_id);
CREATE INDEX IF NOT EXISTS idx_customer_recurring_reminders_active ON customer_recurring_reminders(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_customer_recurring_reminders_due ON customer_recurring_reminders(next_reminder_due_at, is_active) 
  WHERE is_active = true AND next_reminder_due_at IS NOT NULL;

COMMENT ON TABLE customer_recurring_reminders IS 'Customer-specific recurring service reminder configurations that override service defaults';
COMMENT ON COLUMN customer_recurring_reminders.custom_interval_days IS 'Customer override for recurring interval (NULL = use service default)';
COMMENT ON COLUMN customer_recurring_reminders.custom_reminder_days_before IS 'Customer override for reminder timing (NULL = use service default)';
COMMENT ON COLUMN customer_recurring_reminders.next_reminder_due_at IS 'Calculated next reminder date based on last_completed_booking_at + interval';

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_customer_recurring_reminders_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_recurring_reminders_update_timestamp ON customer_recurring_reminders;
CREATE TRIGGER customer_recurring_reminders_update_timestamp
  BEFORE UPDATE ON customer_recurring_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_recurring_reminders_timestamp();
