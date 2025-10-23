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
  v_outstanding NUMERIC(10,2);
  v_has_overdue BOOLEAN;
BEGIN
  -- Calculate outstanding balance for this contact
  SELECT calculate_contact_outstanding_balance(NEW.contact_id)
  INTO v_outstanding;
  
  -- Check if any payments are overdue (past due date and not paid)
  SELECT EXISTS(
    SELECT 1 FROM payment_transactions
    WHERE contact_id = NEW.contact_id
      AND status IN ('pending', 'failed')
      AND due_date < NOW()
  ) INTO v_has_overdue;
  
  -- Update contact record
  UPDATE contacts
  SET 
    outstanding_balance_chf = v_outstanding,
    has_overdue_payments = v_has_overdue,
    updated_at = NOW()
  WHERE id = NEW.contact_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_outstanding_balance_on_transaction ON payment_transactions;
CREATE TRIGGER update_outstanding_balance_on_transaction
  AFTER INSERT OR UPDATE ON payment_transactions
  FOR EACH ROW
  WHEN (NEW.status IN ('pending', 'failed', 'succeeded'))
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
