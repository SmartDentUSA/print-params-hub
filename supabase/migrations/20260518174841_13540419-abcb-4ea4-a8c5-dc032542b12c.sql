
CREATE TABLE IF NOT EXISTS public.wa_lid_phone_map (
  lid_id text PRIMARY KEY,
  phone_digits text NOT NULL,
  lead_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_lid_phone_map_phone ON public.wa_lid_phone_map (phone_digits);
CREATE INDEX IF NOT EXISTS idx_wa_lid_phone_map_lead ON public.wa_lid_phone_map (lead_id);

ALTER TABLE public.wa_lid_phone_map ENABLE ROW LEVEL SECURITY;

-- Service-role only (edge functions). No public policies.
