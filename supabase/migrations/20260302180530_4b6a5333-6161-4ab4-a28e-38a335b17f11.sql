
CREATE TABLE public.ai_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  function_name text NOT NULL,
  action_label text NOT NULL,
  provider text NOT NULL DEFAULT 'lovable',
  model text,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  estimated_cost_usd numeric(10,6) DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.ai_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_all" ON public.ai_token_usage
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "service_insert" ON public.ai_token_usage
  FOR INSERT TO anon WITH CHECK (true);

CREATE INDEX idx_ai_token_usage_created ON public.ai_token_usage(created_at DESC);
CREATE INDEX idx_ai_token_usage_function ON public.ai_token_usage(function_name);
