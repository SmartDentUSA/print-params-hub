
-- 1. Embedding Cache Tables
CREATE TABLE public.image_embedding_cache (
  image_hash text PRIMARY KEY,
  embedding vector(768),
  hit_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.text_embedding_cache (
  text_hash text PRIMARY KEY,
  embedding vector(768),
  hit_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- No RLS needed — these are only accessed via service_role in edge functions
ALTER TABLE public.image_embedding_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.text_embedding_cache ENABLE ROW LEVEL SECURITY;

-- 2. Telemetry Table
CREATE TABLE public.image_query_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text,
  image_hash text,
  image_size_kb int,
  cache_hit boolean,
  embedding_time_ms int,
  vector_results_count int,
  top_match_score float,
  gatekeeper_result text,
  failure_detected text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.image_query_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_iql_session ON public.image_query_logs(session_id);
CREATE INDEX idx_iql_created ON public.image_query_logs(created_at);

-- Allow edge functions (service_role) full access, admin read
CREATE POLICY "service_insert_iql" ON public.image_query_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "admin_read_iql" ON public.image_query_logs FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 3. Support Cases Table
CREATE TABLE public.support_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  problem_description text NOT NULL,
  failure_type text NOT NULL DEFAULT 'other',
  confidence real DEFAULT 0.8,
  causes jsonb DEFAULT '[]',
  solutions jsonb DEFAULT '[]',
  image_urls text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  -- Parametrization (FK to existing tables)
  brand_id uuid REFERENCES public.brands(id),
  model_id uuid REFERENCES public.models(id),
  resin_id uuid REFERENCES public.resins(id),
  -- Workflow: UUID arrays from system_a_catalog
  workflow_scanners uuid[] DEFAULT '{}',
  workflow_notebook text,
  workflow_cad_softwares uuid[] DEFAULT '{}',
  workflow_resins uuid[] DEFAULT '{}',
  workflow_print_software uuid[] DEFAULT '{}',
  workflow_printers uuid[] DEFAULT '{}',
  workflow_print_accessories uuid[] DEFAULT '{}',
  workflow_print_parts uuid[] DEFAULT '{}',
  workflow_cure_equipment uuid[] DEFAULT '{}',
  workflow_finishing uuid[] DEFAULT '{}',
  workflow_final_equipment uuid[] DEFAULT '{}',
  workflow_characterization uuid[] DEFAULT '{}',
  workflow_installation uuid[] DEFAULT '{}',
  workflow_dentistry_ortho uuid[] DEFAULT '{}',
  workflow_lab_supplies uuid[] DEFAULT '{}',
  -- Control
  status text NOT NULL DEFAULT 'pending',
  author_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;

-- Status validation trigger
CREATE OR REPLACE FUNCTION public.validate_support_case_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_support_case_status
  BEFORE INSERT OR UPDATE ON public.support_cases
  FOR EACH ROW EXECUTE FUNCTION public.validate_support_case_status();

CREATE INDEX idx_support_cases_status ON public.support_cases(status);
CREATE INDEX idx_support_cases_failure_type ON public.support_cases(failure_type);

-- RLS: admin only
CREATE POLICY "admin_all_support_cases" ON public.support_cases
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
