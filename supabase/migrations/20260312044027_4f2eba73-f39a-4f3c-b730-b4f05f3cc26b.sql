
ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS pessoa_hash text,
  ADD COLUMN IF NOT EXISTS empresa_hash text,
  ADD COLUMN IF NOT EXISTS piperun_deals_history jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_lia_pessoa_hash ON public.lia_attendances(pessoa_hash);
CREATE INDEX IF NOT EXISTS idx_lia_empresa_hash ON public.lia_attendances(empresa_hash);
