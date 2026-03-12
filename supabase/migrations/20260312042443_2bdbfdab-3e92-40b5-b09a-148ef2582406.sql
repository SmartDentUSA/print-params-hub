
-- Add new columns for full PipeRun webhook enrichment
ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS empresa_cidade text,
  ADD COLUMN IF NOT EXISTS empresa_uf text,
  ADD COLUMN IF NOT EXISTS empresa_facebook text,
  ADD COLUMN IF NOT EXISTS empresa_linkedin text,
  ADD COLUMN IF NOT EXISTS empresa_touch_model text,
  ADD COLUMN IF NOT EXISTS piperun_tags_raw jsonb,
  ADD COLUMN IF NOT EXISTS piperun_origin_sub_name text,
  ADD COLUMN IF NOT EXISTS piperun_involved_users jsonb,
  ADD COLUMN IF NOT EXISTS pessoa_website text,
  ADD COLUMN IF NOT EXISTS pessoa_endereco jsonb,
  ADD COLUMN IF NOT EXISTS empresa_endereco jsonb;
