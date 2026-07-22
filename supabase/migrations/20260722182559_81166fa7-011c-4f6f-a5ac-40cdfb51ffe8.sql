ALTER TABLE public.campaign_send_log
  ADD COLUMN IF NOT EXISTS source_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;

ALTER TABLE public.campaign_send_log
  ALTER COLUMN campaign_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_send_log_source_campaign_status_created
  ON public.campaign_send_log (source_campaign_id, status, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_send_log_source_campaign_lead_unique
  ON public.campaign_send_log (source_campaign_id, lead_id)
  WHERE source_campaign_id IS NOT NULL;