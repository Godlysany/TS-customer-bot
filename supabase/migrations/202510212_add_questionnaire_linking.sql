-- Phase 2: Add service and promotion linking to questionnaires
-- Allows service-specific questionnaires and promotion-linked questionnaires

-- Add linking columns
ALTER TABLE questionnaires
ADD COLUMN IF NOT EXISTS linked_services UUID[],
ADD COLUMN IF NOT EXISTS linked_promotions UUID[];

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_questionnaires_trigger_type 
  ON questionnaires(trigger_type) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_questionnaires_linked_services 
  ON questionnaires USING GIN(linked_services) 
  WHERE linked_services IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questionnaires_active 
  ON questionnaires(is_active);

-- Update comments
COMMENT ON COLUMN questionnaires.linked_services IS 'Service IDs for service-specific questionnaires (trigger_type = service_specific)';
COMMENT ON COLUMN questionnaires.linked_promotions IS 'Promotion IDs for promotion-linked questionnaires';
COMMENT ON COLUMN questionnaires.trigger_type IS 'Trigger options: manual, before_booking, after_booking, first_contact, service_specific';
