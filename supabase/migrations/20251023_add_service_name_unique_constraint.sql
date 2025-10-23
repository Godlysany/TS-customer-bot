-- Add unique constraint on service name to prevent duplicate services
-- October 23, 2025 - Fix for duplicate services issue

-- First, clean up any existing duplicates (keep the oldest record for each name)
DELETE FROM services
WHERE id NOT IN (
    SELECT MIN(id)
    FROM services
    GROUP BY name
);

-- Now add the unique constraint
ALTER TABLE services ADD CONSTRAINT services_name_unique UNIQUE (name);

COMMENT ON CONSTRAINT services_name_unique ON services IS 'Prevents duplicate service names in the system';
