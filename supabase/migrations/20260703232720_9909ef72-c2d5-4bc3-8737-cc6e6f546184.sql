
ALTER TABLE public.campaign_send_log
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subject_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS html_snapshot TEXT;

CREATE INDEX IF NOT EXISTS idx_campaign_send_log_campaign_opened ON public.campaign_send_log(campaign_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_campaign_send_log_campaign_clicked ON public.campaign_send_log(campaign_id, clicked_at);

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS email_subject TEXT,
  ADD COLUMN IF NOT EXISTS email_preheader TEXT,
  ADD COLUMN IF NOT EXISTS email_html TEXT,
  ADD COLUMN IF NOT EXISTS cta_config JSONB;

ALTER TABLE public.short_links
  ADD COLUMN IF NOT EXISTS campaign_id UUID,
  ADD COLUMN IF NOT EXISTS send_log_id UUID;

CREATE INDEX IF NOT EXISTS idx_short_links_campaign ON public.short_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_short_links_send_log ON public.short_links(send_log_id);
