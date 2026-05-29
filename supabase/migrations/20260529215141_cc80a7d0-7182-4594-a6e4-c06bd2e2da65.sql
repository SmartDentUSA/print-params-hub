CREATE OR REPLACE FUNCTION copilot_brain.refresh_products_sold(_months integer DEFAULT 12)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'copilot_brain', 'public'
AS $function$
DECLARE
  _start TIMESTAMPTZ := clock_timestamp();
  _y INT; _m INT; _i INT; _rows BIGINT := 0;
  EXCLUDED_PIPELINES TEXT[] := ARRAY['Funil Atos','E-book','Tulip','Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','CS Onboarding'];
BEGIN
  FOR _i IN 0.._months-1 LOOP
    _y := EXTRACT(YEAR  FROM (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') - (_i || ' months')::interval))::int;
    _m := EXTRACT(MONTH FROM (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') - (_i || ' months')::interval))::int;

    DELETE FROM copilot_brain.brain_products_sold WHERE ano=_y AND mes=_m;

    WITH won_deals AS (
      SELECT
        snap->>'deal_id' AS deal_id,
        snap
      FROM public.lia_attendances la,
           LATERAL jsonb_array_elements(COALESCE(la.piperun_deals_history,'[]'::jsonb)) snap
      WHERE la.merged_into IS NULL
        AND snap->>'status' = 'ganha'
        AND COALESCE(snap->>'closed_at','') ~ '^\d{4}-\d{2}-\d{2}'
        AND ((snap->>'closed_at')::timestamptz AT TIME ZONE 'America/Sao_Paulo') >= make_date(_y,_m,1)
        AND ((snap->>'closed_at')::timestamptz AT TIME ZONE 'America/Sao_Paulo') <  (make_date(_y,_m,1) + INTERVAL '1 month')
        AND COALESCE(snap->>'pipeline_name','') <> ALL(EXCLUDED_PIPELINES)
    ),
    items AS (
      SELECT
        wd.deal_id,
        TRIM(COALESCE(NULLIF(it->>'nome',''), it->>'name', it->>'product_name','')) AS produto_raw,
        COALESCE(NULLIF(it->>'qtd','')::numeric, NULLIF(it->>'quantity','')::numeric, 1) AS qtd,
        COALESCE(NULLIF(it->>'total','')::numeric, NULLIF(it->>'total_value','')::numeric,
                 (COALESCE(NULLIF(it->>'unit','')::numeric, NULLIF(it->>'unit_value','')::numeric,0)
                  * COALESCE(NULLIF(it->>'qtd','')::numeric, NULLIF(it->>'quantity','')::numeric,1))) AS total
      FROM won_deals wd,
           LATERAL jsonb_array_elements(COALESCE(wd.snap->'proposals','[]'::jsonb)) prop,
           LATERAL jsonb_array_elements(COALESCE(prop->'items','[]'::jsonb)) it
      WHERE COALESCE(prop->>'status','') NOT IN ('cancelada','rejeitada')
    ),
    normalized AS (
      SELECT
        COALESCE(pa.nome_canonico, i.produto_raw) AS produto,
        i.deal_id, i.qtd, i.total
      FROM items i
      LEFT JOIN public.produto_aliases pa
        ON pa.ativo = true
       AND LOWER(TRIM(pa.nome_variante)) = LOWER(TRIM(i.produto_raw))
      WHERE i.produto_raw <> ''
    ),
    agg AS (
      SELECT produto,
             SUM(qtd)                          AS qtd_total,
             ROUND(SUM(total)::numeric, 2)     AS receita_total,
             COUNT(DISTINCT deal_id)           AS n_deals,
             ROUND((SUM(total) / NULLIF(COUNT(DISTINCT deal_id),0))::numeric, 2) AS ticket_medio
      FROM normalized
      GROUP BY produto
    )
    INSERT INTO copilot_brain.brain_products_sold(ano,mes,produto,qtd_total,receita_total,n_deals,ticket_medio,ordem,updated_at)
    SELECT _y,_m, produto, qtd_total, receita_total, n_deals, ticket_medio,
           ROW_NUMBER() OVER (ORDER BY receita_total DESC NULLS LAST),
           now()
    FROM agg;

    GET DIAGNOSTICS _rows = ROW_COUNT;
  END LOOP;

  PERFORM copilot_brain.fn_log_meta('brain_products_sold', _rows, EXTRACT(MILLISECONDS FROM clock_timestamp()-_start)::int);
END $function$;

SELECT copilot_brain.refresh_products_sold(12);
SELECT copilot_brain.refresh_overview();