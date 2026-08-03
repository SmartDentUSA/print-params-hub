CREATE OR REPLACE FUNCTION public.fn_relatorio_mes_kpis(p_ano integer, p_mes integer)
 RETURNS TABLE(receita_won numeric, receita_meta numeric, deals_ganhos integer, deals_criados integer, taxa_conversao numeric, ticket_medio numeric, funil_ativo integer, perdidas_mes integer, enviados_estagnados integer, clientes_unicos integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH mes AS (SELECT to_char(make_date(p_ano, p_mes, 1), 'YYYY-MM') AS mes_ref),
  deals_filt AS (
    SELECT d.* FROM deals d
    WHERE COALESCE(d.is_deleted, false) = false
      AND COALESCE(d.pipeline_name, '') <> ALL (ARRAY[
        'Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao',
        'Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'])
  ),
  ganhos AS (
    SELECT COUNT(*)::int AS qty,
           COALESCE(SUM(value),0)::numeric AS total,
           COUNT(DISTINCT person_id)::int AS unicos
    FROM deals_filt d, mes
    WHERE d.status='ganha' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
  ),
  criados AS (
    SELECT COUNT(*)::int AS qty FROM deals_filt d, mes
    WHERE to_char(COALESCE(d.piperun_created_at, d.created_at) AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
  ),
  abertos AS (
    -- Snapshot atual: apenas oportunidades abertas no Funil de Vendas
    SELECT COUNT(*)::int AS qty FROM deals_filt d
    WHERE d.status = 'aberta' AND d.pipeline_name ILIKE '%vendas%'
  ),
  perdidas AS (
    SELECT COUNT(*)::int AS qty FROM deals_filt d, mes
    WHERE d.status='perdida' AND d.closed_at IS NOT NULL
      AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
  ),
  estagn AS (
    SELECT COUNT(*)::int AS qty FROM deals_filt d, mes
    WHERE to_char(COALESCE(d.piperun_created_at, d.created_at) AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = mes.mes_ref
      AND d.stage_name ILIKE '%estagnad%'
  )
  SELECT
    g.total,
    0::numeric,
    g.qty,
    c.qty,
    CASE WHEN c.qty>0 THEN (g.qty::numeric / c.qty::numeric)*100 ELSE 0 END,
    CASE WHEN g.qty>0 THEN g.total / g.qty ELSE 0 END,
    a.qty,
    p.qty,
    e.qty,
    g.unicos
  FROM ganhos g, criados c, abertos a, perdidas p, estagn e;
$function$;