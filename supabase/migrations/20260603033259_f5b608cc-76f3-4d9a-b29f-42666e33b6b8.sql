CREATE TABLE IF NOT EXISTS public.smartops_deal_note_locks (
  deal_id BIGINT PRIMARY KEY,
  lead_id UUID,
  content_hash TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.smartops_deal_note_locks TO service_role;

ALTER TABLE public.smartops_deal_note_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access smartops_deal_note_locks"
ON public.smartops_deal_note_locks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_smartops_deal_note_locks_lead_posted
  ON public.smartops_deal_note_locks (lead_id, posted_at DESC);
