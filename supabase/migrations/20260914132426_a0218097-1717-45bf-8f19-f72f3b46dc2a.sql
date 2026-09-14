ALTER TABLE public.promotional_tables
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.smartops_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_promotional_tables_event_id ON public.promotional_tables(event_id);