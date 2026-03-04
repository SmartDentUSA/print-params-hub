ALTER TABLE public.lia_attendances 
  ADD COLUMN IF NOT EXISTS sellflux_custom_fields jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sellflux_synced_at timestamp with time zone DEFAULT NULL;