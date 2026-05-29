CREATE OR REPLACE FUNCTION copilot_brain.refresh_products_sold(_months integer DEFAULT 12)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'copilot_brain', 'public'
AS $function$
DECLARE _start TIMESTAMPTZ := clock_timestamp(); _y INT; _m INT; _i INT; _rows BIGINT := 0;
BEGIN
  FOR _i IN 0.._months-1 LOOP
    _y := EXTRACT(YEAR  FROM (date_trunc('month', now()) - (_i || ' months')::interval))::int;
    _m := EXTRACT(MONTH FROM (date_trunc('month', now()) - (_i || ' months')::interval))::int;
    DELETE FROM copilot_brain.brain_products_sold WHERE ano=_y AND mes=_m;
    INSERT INTO copilot_brain.brain_products_sold(ano,mes,produto,qtd_total,receita_total,n_deals,ticket_medio,ordem,updated_at)
    SELECT _y,_m,
           p.produto,
           p.qtd_faturada,
           p.receita_omie,
           p.nfs,
           p.ticket_medio,
           ROW_NUMBER() OVER (ORDER BY p.receita_omie DESC NULLS LAST),
           now()
    FROM public.fn_mix_produtos_mes(_y,_m) p;
    GET DIAGNOSTICS _rows = ROW_COUNT;
  END LOOP;
  PERFORM copilot_brain.fn_log_meta('brain_products_sold',_rows,EXTRACT(MILLISECONDS FROM clock_timestamp()-_start)::int);
END $function$;

-- Refresh imediato para popular com a nova fonte
SELECT copilot_brain.refresh_products_sold(12);
SELECT copilot_brain.refresh_overview();