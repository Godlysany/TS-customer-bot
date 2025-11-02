-- Migration: Add team members infrastructure for multi-team calendar management
-- Created: 2025-11-02
-- Purpose: Support multiple team members with individual calendars within a single calendar provider

-- =====================================================
-- TEAM MEMBERS TABLE
-- =====================================================
-- Stores team member profiles with calendar integration

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(100), -- e.g., "Dentist", "Hygienist", "Therapist"
  
  -- Calendar Integration (provider-specific calendar ID)
  calendar_id VARCHAR(255) NOT NULL, -- For Google: 'primary' or specific calendar ID, For O365: calendar ID, For Custom API: team member identifier
  
  -- Availability Schedule (JSONB for flexible configuration)
  -- Format: { "monday": [{"start": "09:00", "end": "12:00"}, {"start": "14:00", "end": "18:00"}], ... }
  availability_schedule JSONB DEFAULT '{}'::jsonb,
  
  -- Default buffer times (can override service-level buffers)
  default_buffer_before_minutes INTEGER DEFAULT 0,
  default_buffer_after_minutes INTEGER DEFAULT 0,
  
  -- Status and metadata
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INTEGER DEFAULT 0, -- For UI sorting
  color VARCHAR(7), -- Hex color for calendar display (e.g., "#FF5733")
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active team members lookup
CREATE INDEX idx_team_members_active ON team_members(is_active) WHERE is_active = true;

-- Index for calendar_id lookups
CREATE INDEX idx_team_members_calendar_id ON team_members(calendar_id);

COMMENT ON TABLE team_members IS 'Team members with individual calendars within the configured calendar provider';
COMMENT ON COLUMN team_members.calendar_id IS 'Provider-specific calendar identifier (Google: primary or calendar ID, O365: calendar ID, Custom API: member ID)';
COMMENT ON COLUMN team_members.availability_schedule IS 'Weekly availability in JSONB: {"monday": [{"start": "HH:MM", "end": "HH:MM"}], ...}';

-- =====================================================
-- UPDATE BOOKINGS TABLE
-- =====================================================
-- Add team member reference to bookings

ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL;

-- Index for team member bookings lookup
CREATE INDEX IF NOT EXISTS idx_bookings_team_member_id ON bookings(team_member_id);

-- Index for team member's confirmed bookings (for conflict detection)
CREATE INDEX IF NOT EXISTS idx_bookings_team_member_confirmed ON bookings(team_member_id, status) 
  WHERE status IN ('confirmed', 'pending');

COMMENT ON COLUMN bookings.team_member_id IS 'Reference to team member who will provide the service';

-- =====================================================
-- SERVICE-TEAM MEMBER MAPPING (Many-to-Many)
-- =====================================================
-- Junction table for service-to-team-member mapping
-- Multiple team members can provide the same service

CREATE TABLE IF NOT EXISTS service_team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  
  -- Optional: Service-specific settings per team member
  custom_buffer_before INTEGER, -- Override default buffer for this service
  custom_buffer_after INTEGER,
  is_primary_provider BOOLEAN DEFAULT false, -- Mark primary/preferred provider for this service
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique service-team member combinations
  UNIQUE(service_id, team_member_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_service_team_members_service ON service_team_members(service_id);
CREATE INDEX IF NOT EXISTS idx_service_team_members_team_member ON service_team_members(team_member_id);
CREATE INDEX IF NOT EXISTS idx_service_team_members_primary ON service_team_members(service_id, is_primary_provider) 
  WHERE is_primary_provider = true;

COMMENT ON TABLE service_team_members IS 'Many-to-many mapping between services and team members (multiple team members can provide same service)';
COMMENT ON COLUMN service_team_members.is_primary_provider IS 'Marks the primary/preferred team member for this service (for smart auto-assignment)';

-- =====================================================
-- UPDATE CONTACTS TABLE
-- =====================================================
-- Add preferred team member to customer preferences

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS preferred_team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_preferred_team_member ON contacts(preferred_team_member_id);

COMMENT ON COLUMN contacts.preferred_team_member_id IS 'Customer's preferred team member for bookings (optional)';

-- =====================================================
-- UPDATE BOT_CONFIG SETTINGS
-- =====================================================
-- Add calendar provider configuration

INSERT INTO settings (key, value, category, description) 
VALUES 
  ('calendar_provider', 'google', 'calendar', 'Active calendar provider: google, office365, or custom_api')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, category, description)
VALUES
  ('calendar_provider_config', '{}', 'calendar', 'Provider-specific configuration JSON (API endpoints, credentials, etc.)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, category, description)
VALUES
  ('team_selection_mode', 'smart', 'booking', 'Team member selection: smart (auto-assign based on availability/preferences), manual (customer chooses), disabled (no team members)')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE settings IS 'System-wide configuration including calendar provider and team selection modes';

-- =====================================================
-- SESSION GROUP METADATA
-- =====================================================
-- Add session group tracking for multi-session bookings

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS session_group_id UUID,
  ADD COLUMN IF NOT EXISTS session_number INTEGER,
  ADD COLUMN IF NOT EXISTS total_sessions INTEGER;

CREATE INDEX IF NOT EXISTS idx_bookings_session_group ON bookings(session_group_id) WHERE session_group_id IS NOT NULL;

COMMENT ON COLUMN bookings.session_group_id IS 'Groups related bookings in a multi-session treatment (NULL for single bookings)';
COMMENT ON COLUMN bookings.session_number IS 'Current session number in multi-session treatment (e.g., 3 in "Session 3/8")';
COMMENT ON COLUMN bookings.total_sessions IS 'Total sessions in multi-session treatment (e.g., 8 in "Session 3/8")';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Migration deployment trigger
