CREATE TABLE IF NOT EXISTS public.zernio_leadgen_dedup (
  leadgen_id        text PRIMARY KEY,
  zernio_lead_id    text,
  first_delivery_id text,
  lead_id           uuid,
  processed_at      timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.zernio_leadgen_dedup TO service_role;

ALTER TABLE public.zernio_leadgen_dedup ENABLE ROW LEVEL SECURITY;

-- No policies: acesso apenas via service_role (edge functions). Sem exposição a anon/authenticated.