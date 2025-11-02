-- Backfill actual_start_time and actual_end_time for existing bookings
-- This ensures all bookings have buffered timestamps for conflict detection

UPDATE bookings
SET 
  actual_start_time = start_time - INTERVAL '1 minute' * COALESCE(buffer_time_before, 0),
  actual_end_time = end_time + INTERVAL '1 minute' * COALESCE(buffer_time_after, 0)
WHERE 
  actual_start_time IS NULL 
  OR actual_end_time IS NULL;

-- Add comment for future reference
COMMENT ON COLUMN bookings.actual_start_time IS 'Booking start time minus buffer_time_before - used for conflict detection';
COMMENT ON COLUMN bookings.actual_end_time IS 'Booking end time plus buffer_time_after - used for conflict detection';
