CREATE TABLE IF NOT EXISTS public.ai_model_routing (
  task_type TEXT PRIMARY KEY,
  description TEXT,
  modality TEXT NOT NULL DEFAULT 'text' CHECK (modality IN ('text','image','embedding','audio','video')),
  primary_provider TEXT NOT NULL CHECK (primary_provider IN ('poe','lovable','deepseek','google','openai')),
  primary_model TEXT NOT NULL,
  fallback_provider TEXT CHECK (fallback_provider IN ('poe','lovable','deepseek','google','openai')),
  fallback_model TEXT,
  input_cost_per_m NUMERIC(10,4) DEFAULT 0,
  output_cost_per_m NUMERIC(10,4) DEFAULT 0,
  max_tokens INTEGER DEFAULT 4096,
  temperature NUMERIC(3,2) DEFAULT 0.7,
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_model_routing TO authenticated;
GRANT ALL ON public.ai_model_routing TO service_role;

ALTER TABLE public.ai_model_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_ai_routing"
  ON public.ai_model_routing FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "admin_manage_ai_routing"
  ON public.ai_model_routing FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_ai_model_routing_updated_at
  BEFORE UPDATE ON public.ai_model_routing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_model_routing
  (task_type, description, modality, primary_provider, primary_model, fallback_provider, fallback_model, input_cost_per_m, output_cost_per_m, notes)
VALUES
  ('copilot_default',         'SmartOps Copilot',           'text', 'deepseek', 'deepseek-chat',                       'poe',     'claude-sonnet-4.6',          0.14,  0.28, 'DeepSeek primário; Poe Claude fallback'),
  ('copilot_fast',            'Copilot lookups rápidos',    'text', 'lovable',  'google/gemini-3.1-flash-lite-preview','poe',     'gemini-3.1-flash-lite',      0.10,  0.40, NULL),
  ('copilot_premium',         'Copilot raciocínio profundo','text', 'poe',      'claude-opus-4.8',                     'poe',     'gpt-5.5',                    5.00, 25.00, 'Override explícito'),
  ('dra_lia_chat',            'Dra. LIA chat público',      'text', 'lovable',  'google/gemini-2.5-flash',             'poe',     'gemini-2.5-flash',           0.30,  2.50, NULL),
  ('waleads_briefing',        'Briefings WaLeads',          'text', 'lovable',  'google/gemini-2.5-flash-lite',        'poe',     'gemini-3.1-flash-lite',      0.10,  0.40, NULL),
  ('cognitive_lead_analysis', 'Análise cognitiva de leads', 'text', 'deepseek', 'deepseek-chat',                       'poe',     'deepseek-v3.2',              0.14,  0.28, NULL),
  ('workflow_diagnosis',      'Diagnóstico de workflow',    'text', 'deepseek', 'deepseek-chat',                       'poe',     'deepseek-v3.2',              0.14,  0.28, NULL),
  ('content_seo',             'Geração SEO/artigos',        'text', 'lovable',  'google/gemini-2.5-flash',             'poe',     'gemini-2.5-flash',           0.30,  2.50, NULL),
  ('content_format',          'Formatação de conteúdo',     'text', 'lovable',  'google/gemini-3-flash-preview',       'poe',     'gemini-3-flash',             0.50,  3.00, NULL),
  ('wa_ai_content',           'WhatsApp IA + Conteúdo',     'text', 'deepseek', 'deepseek-chat',                       'lovable', 'google/gemini-2.5-flash',    0.14,  0.28, NULL),
  ('social_caption',          'Legenda redes sociais',      'text', 'lovable',  'google/gemini-3-flash-preview',       'poe',     'gemini-3-flash',             0.50,  3.00, NULL),
  ('watchdog',                'Watchdog operacional',       'text', 'deepseek', 'deepseek-chat',                       NULL,      NULL,                         0.14,  0.28, NULL),
  ('auto_cheap',              'Auto: menor custo',          'text', 'lovable',  'google/gemini-2.5-flash-lite',        'poe',     'gemini-3.1-flash-lite',      0.10,  0.40, NULL),
  ('auto_balanced',           'Auto: equilíbrio',           'text', 'lovable',  'google/gemini-3-flash-preview',       'poe',     'gemini-3-flash',             0.50,  3.00, NULL),
  ('auto_premium',            'Auto: reasoning premium',    'text', 'poe',      'claude-opus-4.8',                     'poe',     'gpt-5.5',                    5.00, 25.00, NULL),
  ('auto_code',               'Auto: geração de código',    'text', 'poe',      'gpt-5.3-codex',                       'poe',     'claude-sonnet-4.6',          1.75, 14.00, NULL)
ON CONFLICT (task_type) DO NOTHING;