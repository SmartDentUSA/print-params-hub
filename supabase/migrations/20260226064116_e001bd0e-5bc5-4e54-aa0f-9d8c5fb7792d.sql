
CREATE TABLE IF NOT EXISTS public.whatsapp_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  phone text NOT NULL,
  phone_normalized text,
  message_text text,
  media_url text,
  media_type text,
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  lead_id uuid REFERENCES public.lia_attendances(id),
  matched_by text,
  intent_detected text CHECK (intent_detected IS NULL OR intent_detected IN (
    'interesse_imediato', 'interesse_futuro', 'pedido_info',
    'objecao', 'sem_interesse', 'suporte', 'indefinido'
  )),
  confidence_score integer,
  seller_notified boolean DEFAULT false,
  processed_at timestamptz,
  raw_payload jsonb DEFAULT '{}'
);

CREATE INDEX idx_wainbox_phone ON public.whatsapp_inbox(phone_normalized);
CREATE INDEX idx_wainbox_lead ON public.whatsapp_inbox(lead_id);
CREATE INDEX idx_wainbox_intent ON public.whatsapp_inbox(intent_detected);
CREATE INDEX idx_wainbox_created ON public.whatsapp_inbox(created_at DESC);

ALTER TABLE public.whatsapp_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only" ON public.whatsapp_inbox
  FOR ALL USING (public.is_admin(auth.uid()));
