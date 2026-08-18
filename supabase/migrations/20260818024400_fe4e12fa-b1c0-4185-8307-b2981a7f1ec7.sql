CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid,
  user_id uuid,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  platform text,
  user_agent text,
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_lead ON public.push_subscriptions(lead_id) WHERE enabled;
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins read push subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.push_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  icon_url text,
  image_url text,
  target_url text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  schedule_at timestamptz,
  status text NOT NULL DEFAULT 'rascunho',
  total_audience integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  clicked_count integer NOT NULL DEFAULT 0,
  error_details text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_campaigns TO authenticated;
GRANT ALL ON public.push_campaigns TO service_role;
ALTER TABLE public.push_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage push campaigns" ON public.push_campaigns
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.push_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.push_campaigns(id) ON DELETE CASCADE,
  subscription_id uuid,
  lead_id uuid,
  status text NOT NULL DEFAULT 'enviado',
  error text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  clicked_at timestamptz,
  dedupe_hash text UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_push_send_log_campaign ON public.push_send_log(campaign_id);
GRANT SELECT ON public.push_send_log TO authenticated;
GRANT ALL ON public.push_send_log TO service_role;
ALTER TABLE public.push_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read push send log" ON public.push_send_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.fn_push_audience(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE (
  subscription_id uuid,
  lead_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  nome text,
  cidade text,
  produto_interesse text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, l.id, s.endpoint, s.p256dh, s.auth, l.nome, l.cidade,
         COALESCE(l.produto_interesse, l.produto_interesse_auto)
  FROM public.push_subscriptions s
  JOIN public.lia_attendances l ON l.id = s.lead_id
  WHERE s.enabled
    AND l.merged_into IS NULL
    AND (p_filters->>'platform' IS NULL OR s.platform = p_filters->>'platform')
    AND (p_filters->>'produto_interesse' IS NULL
         OR COALESCE(l.produto_interesse,'') ILIKE '%'||(p_filters->>'produto_interesse')||'%'
         OR COALESCE(l.produto_interesse_auto,'') ILIKE '%'||(p_filters->>'produto_interesse')||'%')
    AND (p_filters->>'temperatura_lead' IS NULL OR l.temperatura_lead = p_filters->>'temperatura_lead')
    AND (p_filters->>'piperun_stage_name' IS NULL OR l.piperun_stage_name = p_filters->>'piperun_stage_name')
    AND (p_filters->>'piperun_pipeline_name' IS NULL OR l.piperun_pipeline_name = p_filters->>'piperun_pipeline_name')
    AND (p_filters->>'especialidade' IS NULL OR l.especialidade = p_filters->>'especialidade')
    AND (p_filters->>'area_atuacao' IS NULL OR l.area_atuacao = p_filters->>'area_atuacao')
    AND (p_filters->>'uf' IS NULL OR l.uf = p_filters->>'uf')
    AND (p_filters->>'cidade' IS NULL OR COALESCE(l.cidade,'') ILIKE '%'||(p_filters->>'cidade')||'%')
    AND (p_filters->>'proprietario_lead_crm' IS NULL OR l.proprietario_lead_crm = p_filters->>'proprietario_lead_crm')
    AND (p_filters->>'real_status' IS NULL OR l.real_status = p_filters->>'real_status')
    AND (p_filters->>'origem_primeiro_contato' IS NULL OR l.origem_primeiro_contato = p_filters->>'origem_primeiro_contato')
    AND (p_filters->>'form_name' IS NULL OR l.form_name = p_filters->>'form_name')
    AND (p_filters->>'tem_scanner' IS NULL
         OR (p_filters->>'tem_scanner' = 'yes' AND lower(COALESCE(l.tem_scanner,'')) IN ('sim','true','yes','1'))
         OR (p_filters->>'tem_scanner' = 'no' AND lower(COALESCE(l.tem_scanner,'')) NOT IN ('sim','true','yes','1')))
    AND (p_filters->>'tem_printer' IS NULL
         OR (p_filters->>'tem_printer' = 'yes' AND lower(COALESCE(l.tem_impressora,'')) IN ('sim','true','yes','1'))
         OR (p_filters->>'tem_printer' = 'no' AND lower(COALESCE(l.tem_impressora,'')) NOT IN ('sim','true','yes','1')))
    AND (p_filters->>'cliente_filter' IS NULL
         OR (p_filters->>'cliente_filter' = 'clientes' AND COALESCE(l.total_deals_all,0) > 0)
         OR (p_filters->>'cliente_filter' = 'leads' AND COALESCE(l.total_deals_all,0) = 0))
    AND (p_filters->>'recencia_dias' IS NULL
         OR l.updated_at >= now() - ((p_filters->>'recencia_dias')::int || ' days')::interval)
    AND (p_filters->>'ltv_min' IS NULL OR COALESCE(l.ltv_total,0) >= (p_filters->>'ltv_min')::numeric)
    AND (p_filters->>'score_min' IS NULL OR COALESCE(l.intelligence_score_total,0) >= (p_filters->>'score_min')::numeric)
    AND COALESCE(l.do_not_contact, false) IS FALSE
$$;

CREATE OR REPLACE FUNCTION public.fn_count_push_audience(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.fn_push_audience(p_filters)
$$;

GRANT EXECUTE ON FUNCTION public.fn_push_audience(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_count_push_audience(jsonb) TO authenticated, service_role;