
-- Add proactive outreach control fields to lia_attendances
ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS proactive_sent_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proactive_count integer DEFAULT 0;

-- Index for efficient querying of outreach candidates
CREATE INDEX IF NOT EXISTS idx_lia_attendances_proactive_outreach 
  ON public.lia_attendances (lead_status, updated_at, proactive_sent_at) 
  WHERE lead_status NOT IN ('estagnado_final', 'descartado');
