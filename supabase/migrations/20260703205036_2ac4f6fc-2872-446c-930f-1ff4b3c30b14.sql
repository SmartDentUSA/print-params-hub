CREATE TABLE public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  lead_id uuid NULL,
  payload jsonb NOT NULL,
  error text NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stripe_webhook_events TO authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_stripe_webhook_events"
ON public.stripe_webhook_events
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX idx_stripe_webhook_events_lead_id ON public.stripe_webhook_events(lead_id);
CREATE INDEX idx_stripe_webhook_events_event_type ON public.stripe_webhook_events(event_type);
CREATE INDEX idx_stripe_webhook_events_processed_at ON public.stripe_webhook_events(processed_at DESC);