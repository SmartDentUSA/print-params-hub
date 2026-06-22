
DROP FUNCTION IF EXISTS public.fn_relatorio_mes_vendedor_detalhe(integer, integer);

CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_vendedor_detalhe(p_ano integer, p_mes integer)
 RETURNS TABLE(vendedor text, total_criados integer, abertas integer, ganhas integer, perdidas integer, estagnados integer, estagnados_pct numeric, avg_dias_etapa_vendas numeric, cs_count integer, cs_lead_time_dias numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH mes AS (SELECT to_char(make_date(p_ano, p_mes, 1), 'YYYY-MM') AS mes_ref),
  deals_filt AS (
    SELECT d.* FROM deals d
    WHERE COALESCE(d.is_deleted, false) = false
      AND d.owner_name IS NOT NULL AND d.owner_name !~ '^[0-9]+$' AND d.owner_name <> ''
      AND d.pipeline_name IN ('Funil de vendas','Funil Estagnados')
  ),
  criados AS (
    SELECT d.owner_name AS vendedor, COUNT(*)::int AS qty
    FROM deals_filt d, mes
    WHERE to_char(COALESCE(d.piperun_created_at, d.created_at) AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
    GROUP BY 1
  ),
  abertas_snap AS (
    SELECT d.owner_name AS vendedor, COUNT(*)::int AS qty
    FROM deals_filt d
    WHERE d.status = 'aberta'
    GROUP BY 1
  ),
  ganhas_mes AS (
    SELECT d.owner_name AS vendedor, COUNT(*)::int AS qty
    FROM deals_filt d, mes
    WHERE d.status='ganha' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
    GROUP BY 1
  ),
  perdidas_mes AS (
    SELECT d.owner_name AS vendedor, COUNT(*)::int AS qty
    FROM deals_filt d, mes
    WHERE d.status='perdida' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
    GROUP BY 1
  ),
  estagnados_coorte AS (
    SELECT d.owner_name AS vendedor, COUNT(*)::int AS qty
    FROM deals_filt d, mes
    WHERE to_char(COALESCE(d.piperun_created_at, d.created_at) AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
      AND d.pipeline_name = 'Funil Estagnados'
    GROUP BY 1
  ),
  dias_etapa AS (
    SELECT d.owner_name AS vendedor,
           AVG(EXTRACT(EPOCH FROM (now() - d.last_stage_updated_at))/86400)::numeric AS avg_dias
    FROM deals d
    WHERE COALESCE(d.is_deleted,false)=false
      AND d.status='aberta'
      AND d.pipeline_name='Funil de vendas'
      AND d.last_stage_updated_at IS NOT NULL
      AND d.owner_name IS NOT NULL AND d.owner_name !~ '^[0-9]+$' AND d.owner_name <> ''
    GROUP BY 1
  ),
  cs_mes AS (
    SELECT pst.owner_name AS vendedor,
           COUNT(*)::int AS qty,
           AVG(EXTRACT(EPOCH FROM (pst.transitioned_at - d.piperun_created_at))/86400)::numeric AS avg_lt
    FROM piperun_stage_transitions pst
    JOIN deals d ON d.piperun_deal_id::text = pst.deal_id
    , mes
    WHERE pst.pipeline_name = 'CS Onboarding'
      AND to_char(pst.transitioned_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
      AND pst.owner_name IS NOT NULL AND pst.owner_name !~ '^[0-9]+$' AND pst.owner_name <> ''
    GROUP BY 1
  ),
  all_vendors AS (
    SELECT vendedor FROM criados
    UNION SELECT vendedor FROM abertas_snap
    UNION SELECT vendedor FROM ganhas_mes
    UNION SELECT vendedor FROM perdidas_mes
    UNION SELECT vendedor FROM estagnados_coorte
    UNION SELECT vendedor FROM cs_mes
  )
  SELECT
    av.vendedor,
    COALESCE(c.qty,0)  AS total_criados,
    COALESCE(a.qty,0)  AS abertas,
    COALESCE(g.qty,0)  AS ganhas,
    COALESCE(p.qty,0)  AS perdidas,
    COALESCE(e.qty,0)  AS estagnados,
    CASE WHEN COALESCE(c.qty,0) > 0
         THEN ROUND( (COALESCE(e.qty,0)::numeric / c.qty::numeric) * 100, 1)
         ELSE 0 END AS estagnados_pct,
    ROUND(COALESCE(de.avg_dias,0), 1) AS avg_dias_etapa_vendas,
    COALESCE(cs.qty,0) AS cs_count,
    ROUND(COALESCE(cs.avg_lt,0), 1) AS cs_lead_time_dias
  FROM all_vendors av
  LEFT JOIN criados            c  ON c.vendedor  = av.vendedor
  LEFT JOIN abertas_snap       a  ON a.vendedor  = av.vendedor
  LEFT JOIN ganhas_mes         g  ON g.vendedor  = av.vendedor
  LEFT JOIN perdidas_mes       p  ON p.vendedor  = av.vendedor
  LEFT JOIN estagnados_coorte  e  ON e.vendedor  = av.vendedor
  LEFT JOIN dias_etapa         de ON de.vendedor = av.vendedor
  LEFT JOIN cs_mes             cs ON cs.vendedor = av.vendedor
  ORDER BY (COALESCE(g.qty,0) + COALESCE(a.qty,0)) DESC, av.vendedor;
$function$;
