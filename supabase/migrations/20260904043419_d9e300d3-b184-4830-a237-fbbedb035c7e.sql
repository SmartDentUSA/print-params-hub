ALTER TABLE public.smartops_events
  ADD COLUMN IF NOT EXISTS start_time time without time zone NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS end_time time without time zone NOT NULL DEFAULT '19:00';