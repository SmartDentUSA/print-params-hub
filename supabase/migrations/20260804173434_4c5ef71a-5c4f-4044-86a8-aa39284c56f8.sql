CREATE OR REPLACE FUNCTION public.fn_painel_stage_canon(p_stage text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_stage IS NULL THEN NULL
    WHEN lower(p_stage) LIKE 'sem contato%' THEN 'Sem contato'
    WHEN lower(p_stage) = 'c1' OR lower(p_stage) LIKE 'contato feito%' THEN 'C1'
    WHEN lower(p_stage) = 'c2' OR lower(p_stage) LIKE 'em contato%' THEN 'C2'
    WHEN lower(p_stage) = 'c3' THEN 'C3'
    WHEN lower(p_stage) LIKE 'sdr%' OR lower(p_stage) LIKE '%nutri%'
      OR lower(p_stage) LIKE 'qualifica%' OR lower(p_stage) = 'ltv' THEN 'SDR / Nutrição'
    WHEN lower(p_stage) LIKE 'apresenta%' OR lower(p_stage) LIKE '%visita%' THEN 'Apresentação/Visita'
    WHEN lower(p_stage) LIKE 'negocia%' THEN 'Negociação'
    WHEN lower(p_stage) LIKE 'proposta%' THEN 'Proposta enviada'
    WHEN lower(p_stage) LIKE 'fecham%' THEN 'Fechamento'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.painel_funil_refresh(p_mes date DEFAULT (date_trunc('month'::text, now()))::date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ini date := date_trunc('month', p_mes)::date;
  v_payload jsonb;
BEGIN
  WITH ordem AS (
    SELECT * FROM (VALUES
      ('Sem contato',1),('C1',2),('C2',3),('C3',4),('SDR / Nutrição',5),
      ('Apresentação/Visita',6),('Negociação',7),('Proposta enviada',8),('Fechamento',9)
    ) v(etapa, ord)
  ), base AS (
    SELECT d.id, d.piperun_deal_id, d.status,
           public.fn_painel_stage_canon(d.stage_name) AS etapa_atual
    FROM public.deals d
    WHERE d.pipeline_name ILIKE '%vendas%'
      AND coalesce(d.is_deleted,false) = false
      AND d.piperun_created_at >= now() - interval '12 months'
  ), abertos AS (
    SELECT etapa_atual AS etapa, count(*) n
    FROM base WHERE status = 'aberta' AND etapa_atual IS NOT NULL
    GROUP BY 1
  ), alcance AS (
    SELECT etapa, count(DISTINCT id) AS reach,
           count(DISTINCT id) FILTER (WHERE status = 'perdida') AS perdidos
    FROM (
      SELECT b.id, b.status, public.fn_painel_stage_canon(t.stage_to_name) AS etapa
      FROM base b
      JOIN public.piperun_stage_transitions t ON t.deal_id = b.piperun_deal_id
      UNION
      SELECT b.id, b.status, b.etapa_atual FROM base b
    ) s
    WHERE etapa IS NOT NULL
    GROUP BY 1
  ), dur AS (
    SELECT public.fn_painel_stage_canon(t.stage_from_name) AS etapa,
           extract(epoch FROM (t.transitioned_at - lag(t.transitioned_at)
             OVER (PARTITION BY t.deal_id ORDER BY t.transitioned_at)))/86400 AS dias
    FROM public.piperun_stage_transitions t
    WHERE t.transitioned_at >= now() - interval '12 months'
      AND t.pipeline_name ILIKE '%vendas%'
  ), tempos AS (
    SELECT etapa, count(*) qtd,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY dias) AS dias
    FROM dur WHERE etapa IS NOT NULL AND dias > 0.02
    GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'etapa', o.etapa,
    'ordem', o.ord,
    'atual', coalesce(a.n, 0),
    'volume', coalesce(al.reach, 0),
    'media_dias', round(tm.dias::numeric, 1),
    'pct_perda', CASE WHEN coalesce(al.reach,0) > 0
                      THEN round(100.0 * coalesce(al.perdidos,0) / al.reach, 1) END,
    'qtd_saidas', coalesce(tm.qtd, 0)
  ) ORDER BY o.ord), '[]'::jsonb) INTO v_payload
  FROM ordem o
  LEFT JOIN abertos a ON a.etapa = o.etapa
  LEFT JOIN alcance al ON al.etapa = o.etapa
  LEFT JOIN tempos tm ON tm.etapa = o.etapa;

  INSERT INTO public.painel_comercial_cache (bloco, mes, payload, updated_at)
  VALUES ('funil', v_ini, v_payload, now())
  ON CONFLICT (bloco, mes) DO UPDATE SET payload = excluded.payload, updated_at = now();
END $function$;