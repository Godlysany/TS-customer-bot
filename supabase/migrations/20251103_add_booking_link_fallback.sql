-- Migration: Add booking link fallback for team members
-- Created: 2025-11-03
-- Purpose: Support Calendly-style link fallback when calendar integration is not available

-- Add booking_link column to team_members
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS booking_link VARCHAR(500);

-- Add index for quick booking link lookups
CREATE INDEX IF NOT EXISTS idx_team_members_booking_link ON team_members(booking_link) WHERE booking_link IS NOT NULL;

COMMENT ON COLUMN team_members.booking_link IS 'Optional Calendly-style booking link as fallback when calendar integration is unavailable. Used for KPI tracking without conversion attribution.';
