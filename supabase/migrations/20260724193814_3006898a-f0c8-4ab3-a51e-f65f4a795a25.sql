-- Fase 0: Congelamento WaLeads/SellFlux
ALTER TABLE public.wa_message_queue ADD COLUMN IF NOT EXISTS paused_at timestamptz;
UPDATE public.wa_campaigns SET status='disabled', updated_at=now()
  WHERE status IN ('active','running','scheduled','pending');
UPDATE public.wa_message_queue SET paused_at=now()
  WHERE paused_at IS NULL
    AND status IN ('pending','queued','scheduled','processing');