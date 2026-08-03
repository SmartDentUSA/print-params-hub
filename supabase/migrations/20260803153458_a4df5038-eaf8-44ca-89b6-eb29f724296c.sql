CREATE OR REPLACE FUNCTION public.list_lead_origins()
RETURNS TABLE(
  origin_key text,
  origin_name text,
  origin_type text,
  source_kind text,
  leads_count bigint,
  active_leads_count bigint,
  first_lead_at timestamp with time zone,
  last_lead_at timestamp with time zone,
  workflow_stage_target text,
  is_active boolean,
  mapping_id uuid,
  mapped boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  SELECT
    a.k,
    a.nm,
    CASE WHEN a.is_meta THEN 'meta_form' ELSE 'origin' END AS source_kind,
    a.n,
    a.n_active,
    a.first_at,
    a.last_at,
    NULL::text AS wf,
    NULL::boolean AS act
  FROM agg a
  WHERE NOT EXISTS (SELECT 1 FROM sys_forms s WHERE s.k = a.k)
  UNION ALL
  SELECT
    s.k,
    s.nm,
    'system_form',
    GREATEST(s.n, COALESCE((SELECT a2.n FROM agg a2 WHERE a2.k = s.k LIMIT 1), 0)),
    COALESCE((SELECT a2.n_active FROM agg a2 WHERE a2.k = s.k LIMIT 1), 0),
    LEAST(s.created_at, COALESCE((SELECT a2.first_at FROM agg a2 WHERE a2.k = s.k LIMIT 1), s.created_at)),
    COALESCE((SELECT a2.last_at FROM agg a2 WHERE a2.k = s.k LIMIT 1), s.created_at),
    s.workflow_stage_target,
    s.active
  FROM sys_forms s
)
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
  (m.id IS NOT NULL) AS mapped
FROM unified u
LEFT JOIN public.meta_form_mappings m ON m.form_id = u.k
ORDER BY u.n DESC;
$function$;

REVOKE ALL ON FUNCTION public.list_lead_origins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_lead_origins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_lead_origins() TO service_role;