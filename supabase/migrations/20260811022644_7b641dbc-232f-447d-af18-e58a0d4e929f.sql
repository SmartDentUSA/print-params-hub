ALTER TABLE public.seller_briefing_config
  ADD COLUMN IF NOT EXISTS gate_pipeline_id text,
  ADD COLUMN IF NOT EXISTS gate_pipeline_name text,
  ADD COLUMN IF NOT EXISTS gate_stage_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS gate_stage_names text[] NOT NULL DEFAULT '{}';

UPDATE public.seller_briefing_config
SET gate_stage_names = ARRAY['Sem contato']
WHERE COALESCE(array_length(gate_stage_names, 1), 0) = 0;