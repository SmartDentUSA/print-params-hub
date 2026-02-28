
-- ══════════════════════════════════════════════════════
-- DEAL fields (oportunidade PipeRun)
-- ══════════════════════════════════════════════════════
ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS piperun_title text,
  ADD COLUMN IF NOT EXISTS piperun_hash text,
  ADD COLUMN IF NOT EXISTS piperun_status smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS piperun_deleted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS piperun_frozen boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS piperun_frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS piperun_probability integer,
  ADD COLUMN IF NOT EXISTS piperun_lead_time integer,
  ADD COLUMN IF NOT EXISTS piperun_value_mrr numeric,
  ADD COLUMN IF NOT EXISTS piperun_description text,
  ADD COLUMN IF NOT EXISTS piperun_observation text,
  ADD COLUMN IF NOT EXISTS piperun_last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS piperun_stage_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS piperun_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS piperun_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS piperun_probably_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS piperun_pipeline_id integer,
  ADD COLUMN IF NOT EXISTS piperun_pipeline_name text,
  ADD COLUMN IF NOT EXISTS piperun_stage_id integer,
  ADD COLUMN IF NOT EXISTS piperun_stage_name text,
  ADD COLUMN IF NOT EXISTS piperun_origin_name text,
  ADD COLUMN IF NOT EXISTS piperun_origin_id integer,
  ADD COLUMN IF NOT EXISTS piperun_owner_id integer,
  ADD COLUMN IF NOT EXISTS piperun_custom_fields jsonb DEFAULT '[]'::jsonb,

-- ══════════════════════════════════════════════════════
-- PERSON fields (pessoa vinculada ao deal)
-- ══════════════════════════════════════════════════════
  ADD COLUMN IF NOT EXISTS pessoa_piperun_id integer,
  ADD COLUMN IF NOT EXISTS pessoa_cpf text,
  ADD COLUMN IF NOT EXISTS pessoa_cargo text,
  ADD COLUMN IF NOT EXISTS pessoa_nascimento date,
  ADD COLUMN IF NOT EXISTS pessoa_genero text,
  ADD COLUMN IF NOT EXISTS pessoa_linkedin text,
  ADD COLUMN IF NOT EXISTS pessoa_facebook text,
  ADD COLUMN IF NOT EXISTS pessoa_observation text,

-- ══════════════════════════════════════════════════════
-- COMPANY fields (empresa vinculada)
-- ══════════════════════════════════════════════════════
  ADD COLUMN IF NOT EXISTS empresa_piperun_id integer,
  ADD COLUMN IF NOT EXISTS empresa_cnpj text,
  ADD COLUMN IF NOT EXISTS empresa_razao_social text,
  ADD COLUMN IF NOT EXISTS empresa_nome text,
  ADD COLUMN IF NOT EXISTS empresa_ie text,
  ADD COLUMN IF NOT EXISTS empresa_segmento text,
  ADD COLUMN IF NOT EXISTS empresa_porte text,
  ADD COLUMN IF NOT EXISTS empresa_situacao text,
  ADD COLUMN IF NOT EXISTS empresa_website text,
  ADD COLUMN IF NOT EXISTS empresa_cnae text,
  ADD COLUMN IF NOT EXISTS empresa_custom_fields jsonb DEFAULT '[]'::jsonb,

-- ══════════════════════════════════════════════════════
-- PROPOSALS (propostas como JSONB array)
-- ══════════════════════════════════════════════════════
  ADD COLUMN IF NOT EXISTS proposals_data jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS proposals_total_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proposals_total_mrr numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proposals_last_status smallint;

-- Índices para consultas frequentes do orquestrador
CREATE INDEX IF NOT EXISTS idx_lia_piperun_pipeline ON public.lia_attendances (piperun_pipeline_id) WHERE piperun_pipeline_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lia_piperun_status ON public.lia_attendances (piperun_status) WHERE piperun_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lia_empresa_cnpj ON public.lia_attendances (empresa_cnpj) WHERE empresa_cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lia_pessoa_piperun_id ON public.lia_attendances (pessoa_piperun_id) WHERE pessoa_piperun_id IS NOT NULL;

COMMENT ON COLUMN public.lia_attendances.piperun_status IS '0=Aberto, 1=Ganho, 2=Perdido';
COMMENT ON COLUMN public.lia_attendances.empresa_situacao IS '1=Lead, 2=Suspect, 3=MQL, 4=SQL, 5=SAL, 6=OPs, 7=Ativo, 8=Inativo, 9=Churn';
COMMENT ON COLUMN public.lia_attendances.proposals_data IS 'Array JSON das propostas PipeRun [{id,hash,value,status,items:[...],created_at}]';
