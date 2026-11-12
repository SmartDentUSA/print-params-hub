ALTER TABLE public.smartops_events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'feira_congresso';
ALTER TABLE public.smartops_events
  DROP CONSTRAINT IF EXISTS smartops_events_event_type_check;
ALTER TABLE public.smartops_events
  ADD CONSTRAINT smartops_events_event_type_check
  CHECK (event_type IN ('feira_congresso', 'presencial_parceiros', 'campanha_promocional'));