CREATE TABLE public.smartops_bio_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.smartops_bio_pages(id) ON DELETE CASCADE,
  item_id text,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX smartops_bio_events_page_idx ON public.smartops_bio_events(page_id, event_type);
GRANT INSERT ON public.smartops_bio_events TO anon, authenticated;
GRANT SELECT ON public.smartops_bio_events TO authenticated;
GRANT ALL ON public.smartops_bio_events TO service_role;
ALTER TABLE public.smartops_bio_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bio events public insert" ON public.smartops_bio_events FOR INSERT TO anon, authenticated
  WITH CHECK (event_type IN ('view','card_click','cta_click','whatsapp_click') AND (item_id IS NULL OR length(item_id) < 200));
CREATE POLICY "bio events staff read" ON public.smartops_bio_events FOR SELECT TO authenticated USING (true);