-- 1) Classificação manual de origens (inbound/outbound)
CREATE TABLE IF NOT EXISTS public.lead_origin_classification (
  origin_key text PRIMARY KEY,
  origin_name text,
  acquisition_type text NOT NULL CHECK (acquisition_type IN ('inbound','outbound')),
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lead_origin_classification TO authenticated;
GRANT ALL ON public.lead_origin_classification TO service_role;

ALTER TABLE public.lead_origin_classification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read origin classification" ON public.lead_origin_classification;
CREATE POLICY "authenticated read origin classification"
  ON public.lead_origin_classification FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admins manage origin classification" ON public.lead_origin_classification;
CREATE POLICY "admins manage origin classification"
  ON public.lead_origin_classification FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) RPC de gravação (admin-only). p_type NULL/'' remove a marcação manual.
CREATE OR REPLACE FUNCTION public.set_origin_acquisition_type(
  p_origin_key text,
  p_type text,
  p_origin_name text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_type text := lower(nullif(trim(coalesce(p_type,'')), ''));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'apenas administradores podem classificar origens';
  END IF;
  IF coalesce(trim(p_origin_key),'') = '' THEN
    RAISE EXCEPTION 'origin_key obrigatório';
  END IF;

  IF v_type IS NULL THEN
    DELETE FROM public.lead_origin_classification WHERE origin_key = trim(p_origin_key);
    RETURN;
  END IF;

  IF v_type NOT IN ('inbound','outbound') THEN
    RAISE EXCEPTION 'tipo inválido: %', p_type;
  END IF;

  INSERT INTO public.lead_origin_classification (origin_key, origin_name, acquisition_type, updated_by, updated_at)
  VALUES (trim(p_origin_key), nullif(trim(coalesce(p_origin_name,'')),''), v_type, auth.uid(), now())
  ON CONFLICT (origin_key) DO UPDATE
    SET acquisition_type = excluded.acquisition_type,
        origin_name = coalesce(excluded.origin_name, public.lead_origin_classification.origin_name),
        updated_by = excluded.updated_by,
        updated_at = now();
END $$;

GRANT EXECUTE ON FUNCTION public.set_origin_acquisition_type(text, text, text) TO authenticated;

-- 3) list_lead_origins agora devolve acquisition_type + origem da classificação
DROP FUNCTION IF EXISTS public.list_lead_origins();
CREATE OR REPLACE FUNCTION public.list_lead_origins()
RETURNS TABLE(
  origin_key text, origin_name text, origin_type text, source_kind text,
  leads_count bigint, active_leads_count bigint,
  first_lead_at timestamptz, last_lead_at timestamptz,
  workflow_stage_target text, is_active boolean, mapping_id uuid, mapped boolean,
  acquisition_type text, acquisition_source text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH raw AS (
  SELECT
    COALESCE(NULLIF(la.meta_form_id, ''), NULLIF(la.platform_form_id, '')) AS fid,
    NULLIF(la.form_name, '') AS fname,
    NULLIF(la.origem_primeiro_contato, '') AS origem,
    la.created_at
  FROM public.lia_attendances la
  WHERE la.merged_into IS NULL
),
agg AS (
  SELECT
    COALESCE(r.fid, r.fname, r.origem) AS k,
    (r.fid IS NOT NULL) AS is_meta,
    (array_agg(COALESCE(r.fname, r.origem) ORDER BY r.created_at DESC NULLS LAST)
      FILTER (WHERE COALESCE(r.fname, r.origem) IS NOT NULL))[1] AS nm,
    count(*)::bigint AS n,
    count(*) FILTER (WHERE r.created_at > now() - interval '90 days')::bigint AS n_active,
    min(r.created_at) AS first_at,
    max(r.created_at) AS last_at
  FROM raw r
  WHERE COALESCE(r.fid, r.fname, r.origem) IS NOT NULL
  GROUP BY COALESCE(r.fid, r.fname, r.origem), (r.fid IS NOT NULL)
),
sys_forms AS (
  SELECT
    f.slug AS k,
    COALESCE(NULLIF(f.name, ''), NULLIF(f.title, ''), f.slug) AS nm,
    f.workflow_stage_target,
    f.active,
    f.created_at,
    COALESCE(f.submissions_count, 0)::bigint AS n
  FROM public.smartops_forms f
  WHERE f.slug IS NOT NULL
),
unified AS (
  SELECT a.k, a.nm,
    CASE WHEN a.is_meta THEN 'meta_form' ELSE 'origin' END AS source_kind,
    a.n, a.n_active, a.first_at, a.last_at,
    NULL::text AS wf, NULL::boolean AS act
  FROM agg a
  WHERE NOT EXISTS (SELECT 1 FROM sys_forms s WHERE s.k = a.k)
  UNION ALL
  SELECT s.k, s.nm, 'system_form',
    GREATEST(s.n, COALESCE((SELECT a2.n FROM agg a2 WHERE a2.k = s.k LIMIT 1), 0)),
    COALESCE((SELECT a2.n_active FROM agg a2 WHERE a2.k = s.k LIMIT 1), 0),
    LEAST(s.created_at, COALESCE((SELECT a2.first_at FROM agg a2 WHERE a2.k = s.k LIMIT 1), s.created_at)),
    COALESCE((SELECT a2.last_at FROM agg a2 WHERE a2.k = s.k LIMIT 1), s.created_at),
    s.workflow_stage_target, s.active
  FROM sys_forms s
),
base AS (
  SELECT
    u.k AS origin_key,
    COALESCE(u.nm, u.k) AS origin_name,
    CASE
      WHEN u.source_kind = 'meta_form' THEN 'meta'
      WHEN u.source_kind = 'system_form' THEN 'sistema'
      WHEN u.k ~* '^(piperun|omie|sellflux|loja_integrada|astron|zapier|dra-lia|involve)' THEN 'integracao'
      WHEN u.k ~* '(busca ativa|lista clientes|pr[eé].?venda|outbound|prospec|indica)' THEN 'outbound'
      WHEN u.k ~* '(meta|facebook|instagram|tiktok|google|youtube)' THEN 'meta'
      ELSE 'inbound'
    END AS origin_type,
    u.source_kind,
    u.n AS leads_count,
    u.n_active AS active_leads_count,
    u.first_at AS first_lead_at,
    u.last_at AS last_lead_at,
    COALESCE(m.workflow_stage_target, u.wf) AS workflow_stage_target,
    COALESCE(m.active, u.act, true) AS is_active,
    m.id AS mapping_id,
    (m.id IS NOT NULL) AS mapped,
    c.acquisition_type AS manual_type
  FROM unified u
  LEFT JOIN public.meta_form_mappings m ON m.form_id = u.k
  LEFT JOIN public.lead_origin_classification c ON c.origin_key = u.k
)
SELECT
  b.origin_key, b.origin_name, b.origin_type, b.source_kind,
  b.leads_count, b.active_leads_count, b.first_lead_at, b.last_lead_at,
  b.workflow_stage_target, b.is_active, b.mapping_id, b.mapped,
  COALESCE(
    b.manual_type,
    CASE
      WHEN b.origin_type IN ('meta','sistema','inbound') THEN 'inbound'
      WHEN b.origin_type = 'outbound' THEN 'outbound'
      WHEN b.origin_key ~* '(busca ativa|lista clientes|pr[eé].?venda|outbound|prospec|indica|cold)' THEN 'outbound'
      ELSE 'inbound'
    END
  ) AS acquisition_type,
  CASE WHEN b.manual_type IS NOT NULL THEN 'manual' ELSE 'auto' END AS acquisition_source
FROM base b
ORDER BY b.leads_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_lead_origins() TO authenticated;

-- 4) Painel comercial: bloco de origens respeita a classificação manual
CREATE OR REPLACE FUNCTION public.painel_origens_refresh(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
/* Coorte do mes por data_primeiro_contato. Conversao calculada dentro da coorte.
   Inbound/Outbound: usa a classificacao manual de lead_origin_classification quando existir;
   senao cai na heuristica (form/meta = Inbound). */
DECLARE
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_payload jsonb;
  v_fora text[] := ARRAY[
      'Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao',
      'Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'];
BEGIN
  WITH norm AS (
    SELECT la.id,
      coalesce(la.data_primeiro_contato, la.created_at) AS dt,
      CASE WHEN lower(coalesce(trim(la.origem_primeiro_contato),'')) IN
                ('piperun','piperun_webhook','zapier','wats','loja_integrada','')
           THEN coalesce(nullif(trim(la.origem_campanha),''),'Não informado')
           ELSE trim(la.origem_primeiro_contato) END AS origem,
      coalesce(nullif(trim(la.origem_campanha),''),'Sem campanha') AS campanha,
      CASE
        WHEN cls.acquisition_type = 'outbound' THEN 'Outbound'
        WHEN cls.acquisition_type = 'inbound'  THEN 'Inbound'
        WHEN la.meta_form_id IS NOT NULL OR la.meta_leadgen_id IS NOT NULL
             OR la.form_name IS NOT NULL THEN 'Inbound'
        ELSE 'Outbound' END AS tipo
    FROM public.lia_attendances la
    LEFT JOIN LATERAL (
      SELECT c.acquisition_type
      FROM public.lead_origin_classification c
      WHERE c.origin_key IN (
        nullif(la.meta_form_id,''), nullif(la.platform_form_id,''),
        nullif(la.form_name,''), nullif(la.origem_primeiro_contato,'')
      )
      ORDER BY c.updated_at DESC
      LIMIT 1
    ) cls ON TRUE
    WHERE la.merged_into IS NULL
  ), coorte AS (
    SELECT n.origem, n.campanha, n.tipo, n.id AS lead_id, n.dt, dd.status, dd.stage_name
    FROM norm n
    LEFT JOIN public.deals dd
      ON dd.lead_id = n.id AND coalesce(dd.is_deleted,false)=false
     AND dd.pipeline_name ILIKE '%vendas%'
    WHERE n.dt >= v_ini AND n.dt < v_fim
  ), leads_agg AS (
    SELECT origem, campanha, tipo,
      count(DISTINCT lead_id) AS leads,
      count(DISTINCT lead_id) FILTER (WHERE status='aberta')  AS ativos,
      count(DISTINCT lead_id) FILTER (WHERE status='perdida') AS perdidos
    FROM coorte GROUP BY 1,2,3
  ), perda AS (
    SELECT origem, campanha, tipo, stage_name,
      row_number() OVER (PARTITION BY origem, campanha, tipo ORDER BY count(*) DESC) AS rn
    FROM coorte WHERE status='perdida' AND stage_name IS NOT NULL
    GROUP BY 1,2,3,4
  ), coorte_ganhos AS (
    SELECT n.origem, n.campanha, n.tipo,
      count(DISTINCT d.lead_id) AS ganhos_coorte,
      avg(extract(epoch FROM (d.closed_at - n.dt))/86400)
        FILTER (WHERE d.closed_at >= n.dt) AS lead_time
    FROM public.deals d
    JOIN norm n ON n.id = d.lead_id
    WHERE coalesce(d.is_deleted,false)=false AND d.status='ganha' AND d.closed_at IS NOT NULL
      AND n.dt >= v_ini AND n.dt < v_fim
      AND coalesce(d.pipeline_name,'') <> ALL (v_fora)
    GROUP BY 1,2,3
  ), ganhos_agg AS (
    SELECT n.origem, n.campanha, n.tipo,
      count(DISTINCT d.id) AS ganhos,
      coalesce(sum(coalesce(nullif(d.value,0),0)), 0) AS receita
    FROM public.deals d
    JOIN norm n ON n.id = d.lead_id
    WHERE coalesce(d.is_deleted,false)=false AND d.status='ganha' AND d.closed_at IS NOT NULL
      AND d.closed_at >= v_ini AND d.closed_at < v_fim
      AND coalesce(d.pipeline_name,'') <> ALL (v_fora)
    GROUP BY 1,2,3
  ), j AS (
    SELECT coalesce(l.origem,g.origem) origem, coalesce(l.campanha,g.campanha) campanha,
           coalesce(l.tipo,g.tipo) tipo, coalesce(l.leads,0) leads, coalesce(l.ativos,0) ativos,
           coalesce(l.perdidos,0) perdidos, coalesce(g.ganhos,0) ganhos,
           coalesce(g.receita,0) receita,
           coalesce(cg.ganhos_coorte,0) ganhos_coorte, cg.lead_time
    FROM leads_agg l
    FULL JOIN ganhos_agg g ON g.origem=l.origem AND g.campanha=l.campanha AND g.tipo=l.tipo
    LEFT JOIN coorte_ganhos cg
      ON cg.origem=coalesce(l.origem,g.origem) AND cg.campanha=coalesce(l.campanha,g.campanha)
     AND cg.tipo=coalesce(l.tipo,g.tipo)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'origem', j.origem, 'campanha', j.campanha, 'tipo', j.tipo,
    'leads_gerados', j.leads, 'ativos', j.ativos, 'perdidos', j.perdidos,
    'pct_perda', CASE WHEN j.leads>0 THEN round(100.0*j.perdidos/j.leads,1) END,
    'etapa_maior_perda', pp.stage_name,
    'ganhos', j.ganhos, 'ganhos_coorte', j.ganhos_coorte,
    'lead_time_dias', round(j.lead_time::numeric,1),
    'pct_conversao', CASE WHEN j.leads>0 THEN round(100.0*j.ganhos_coorte/j.leads,1) END,
    'receita', round(j.receita::numeric,2)
  ) ORDER BY j.leads DESC, j.receita DESC), '[]'::jsonb) INTO v_payload
  FROM j LEFT JOIN perda pp
    ON pp.origem=j.origem AND pp.campanha=j.campanha AND pp.tipo=j.tipo AND pp.rn=1;

  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('origens', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();
END $function$;

-- 5) Lead time = entrada no Funil de Vendas -> entrada no funil de CS
CREATE OR REPLACE FUNCTION public.fn_campaign_revenue(p_from date, p_to date)
RETURNS TABLE(platform_campaign_id text, revenue numeric, won_deals bigint, won_leads bigint, leads_converted bigint, avg_lead_time_days numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH conv AS (
    SELECT la.id AS lead_id,
           la.platform_campaign_id::text AS cid,
           COALESCE(
             (SELECT MAX(l.event_timestamp) FROM public.lead_activity_log l
               WHERE l.lead_id = la.id
                 AND l.event_type IN ('meta_ads_lead_entry','zernio_lead_raw')),
             la.entrada_sistema, la.created_at
           ) AS conv_at
    FROM public.lia_attendances la
    WHERE la.merged_into IS NULL
      AND la.platform_campaign_id IS NOT NULL
  ), funnel AS (
    SELECT d.lead_id,
           MIN(COALESCE(d.piperun_created_at, d.created_at))
             FILTER (WHERE d.pipeline_name ILIKE '%vendas%') AS vendas_at,
           MIN(COALESCE(d.piperun_created_at, d.created_at))
             FILTER (WHERE d.pipeline_name ILIKE '%cs%' OR d.pipeline_name ILIKE '%onboarding%') AS cs_at
    FROM public.deals d
    WHERE COALESCE(d.is_deleted,false) = false
    GROUP BY d.lead_id
  ), won AS (
    SELECT c.cid, c.lead_id, d.id AS deal_id,
           COALESCE(d.value, d.value_products, 0) AS deal_value,
           CASE WHEN f.vendas_at IS NOT NULL AND f.cs_at IS NOT NULL AND f.cs_at >= f.vendas_at
                THEN EXTRACT(EPOCH FROM (f.cs_at - f.vendas_at)) / 86400 END AS lead_time_days
    FROM conv c
    JOIN public.deals d ON d.lead_id = c.lead_id
    LEFT JOIN funnel f ON f.lead_id = c.lead_id
    WHERE d.status = 'ganha'
      AND d.closed_at IS NOT NULL
      AND d.closed_at >= c.conv_at
      AND d.closed_at::date BETWEEN p_from AND p_to
  )
  SELECT c.cid,
         COALESCE((SELECT SUM(w.deal_value) FROM won w WHERE w.cid = c.cid), 0)::numeric,
         COALESCE((SELECT COUNT(*) FROM won w WHERE w.cid = c.cid), 0)::bigint,
         COALESCE((SELECT COUNT(DISTINCT w.lead_id) FROM won w WHERE w.cid = c.cid), 0)::bigint,
         COUNT(DISTINCT c.lead_id)::bigint,
         (SELECT ROUND(AVG(w.lead_time_days)::numeric, 1) FROM won w WHERE w.cid = c.cid)
  FROM conv c
  GROUP BY c.cid
$function$;

DROP FUNCTION IF EXISTS public.fn_campaign_revenue_detail(text, date, date);
CREATE OR REPLACE FUNCTION public.fn_campaign_revenue_detail(p_campaign_id text, p_from date, p_to date)
RETURNS TABLE(
  lead_id uuid, lead_name text, deal_id uuid, piperun_deal_id text, deal_title text,
  pipeline_name text, deal_value numeric, converted_at timestamptz, closed_at timestamptz,
  vendas_at timestamptz, cs_at timestamptz, lead_time_days numeric,
  campaign_product text, purchased_products text[], cross_sell boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH conv AS (
    SELECT la.id AS lead_id,
           la.nome AS lead_name,
           la.produto_interesse AS campaign_product,
           COALESCE(
             (SELECT MAX(l.event_timestamp) FROM public.lead_activity_log l
               WHERE l.lead_id = la.id
                 AND l.event_type IN ('meta_ads_lead_entry','zernio_lead_raw')),
             la.entrada_sistema, la.created_at
           ) AS conv_at
    FROM public.lia_attendances la
    WHERE la.merged_into IS NULL
      AND la.platform_campaign_id::text = p_campaign_id
  ), funnel AS (
    SELECT d.lead_id,
           MIN(COALESCE(d.piperun_created_at, d.created_at))
             FILTER (WHERE d.pipeline_name ILIKE '%vendas%') AS vendas_at,
           MIN(COALESCE(d.piperun_created_at, d.created_at))
             FILTER (WHERE d.pipeline_name ILIKE '%cs%' OR d.pipeline_name ILIKE '%onboarding%') AS cs_at
    FROM public.deals d
    WHERE COALESCE(d.is_deleted,false) = false
    GROUP BY d.lead_id
  )
  SELECT c.lead_id,
         c.lead_name,
         d.id,
         d.piperun_deal_id,
         d.deal_title,
         d.pipeline_name,
         COALESCE(d.value, d.value_products, 0)::numeric,
         c.conv_at,
         d.closed_at,
         f.vendas_at,
         f.cs_at,
         CASE WHEN f.vendas_at IS NOT NULL AND f.cs_at IS NOT NULL AND f.cs_at >= f.vendas_at
              THEN ROUND((EXTRACT(EPOCH FROM (f.cs_at - f.vendas_at)) / 86400)::numeric, 1) END,
         c.campaign_product,
         COALESCE(items.names, ARRAY[]::text[]),
         CASE
           WHEN c.campaign_product IS NULL OR items.names IS NULL THEN NULL
           ELSE NOT EXISTS (
             SELECT 1 FROM unnest(items.names) n
             WHERE lower(n) LIKE '%' || lower(split_part(c.campaign_product, ' ', 1)) || '%'
           )
         END
  FROM conv c
  JOIN public.deals d ON d.lead_id = c.lead_id
  LEFT JOIN funnel f ON f.lead_id = c.lead_id
  LEFT JOIN LATERAL (
    SELECT array_agg(DISTINCT COALESCE(di.product_name, di.nome_produto)) AS names
    FROM public.deal_items di
    WHERE di.deal_id = d.piperun_deal_id
      AND COALESCE(di.product_name, di.nome_produto) IS NOT NULL
  ) items ON TRUE
  WHERE d.status = 'ganha'
    AND d.closed_at IS NOT NULL
    AND d.closed_at >= c.conv_at
    AND d.closed_at::date BETWEEN p_from AND p_to
  ORDER BY d.closed_at DESC
$function$;

GRANT EXECUTE ON FUNCTION public.fn_campaign_revenue(date, date) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_campaign_revenue_detail(text, date, date) TO authenticated, anon;
