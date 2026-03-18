
-- Step 1: Delete existing duplicate rows (keep oldest per lead_id + event_type + entity_id combo)
DELETE FROM lead_activity_log a
USING lead_activity_log b
WHERE a.lead_id = b.lead_id
  AND a.event_type = b.event_type
  AND a.entity_id = b.entity_id
  AND a.entity_id IS NOT NULL
  AND a.source_channel = 'ecommerce'
  AND b.source_channel = 'ecommerce'
  AND a.id > b.id;

-- Step 2: Create unique partial index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_log_ecom_dedup
ON lead_activity_log (lead_id, event_type, entity_id)
WHERE entity_id IS NOT NULL AND source_channel = 'ecommerce';
