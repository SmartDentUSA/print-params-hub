
CREATE SCHEMA IF NOT EXISTS copilot_brain;
GRANT USAGE ON SCHEMA copilot_brain TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS copilot_brain.brain_meta (
  section TEXT PRIMARY KEY,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_count BIGINT, duration_ms INT, notes TEXT
);

CREATE TABLE IF NOT EXISTS copilot_brain.brain_overview (
  id INT PRIMARY KEY DEFAULT 1,
  periodo TEXT, receita_mes NUMERIC, deals_ganhos_mes BIGINT, ticket_medio_mes NUMERIC,
  leads_novos_mes BIGINT, leads_canonicos_total BIGINT,
  pipeline_total_value NUMERIC, pipeline_total_deals BIGINT,
  top_vendedor TEXT, top_vendedor_receita NUMERIC,
  top_produto TEXT, top_produto_receita NUMERIC,
  delta_receita_mom_pct NUMERIC, delta_deals_mom_pct NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT brain_overview_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS copilot_brain.brain_sales_month (
  ano INT NOT NULL, mes INT NOT NULL, periodo TEXT NOT NULL,
  receita_total NUMERIC, total_deals BIGINT, ticket_medio NUMERIC,
  top_vendedor TEXT, receita_top NUMERIC,
  delta_receita_pct NUMERIC, delta_deals_pct NUMERIC, delta_ticket_pct NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ano, mes)
);

CREATE TABLE IF NOT EXISTS copilot_brain.brain_sales_ranking (
  ano INT NOT NULL, mes INT NOT NULL, vendedor TEXT NOT NULL,
  total_deals BIGINT, receita_total NUMERIC, ticket_medio NUMERIC, pct_receita NUMERIC,
  leads_recebidos BIGINT, taxa_conversao NUMERIC, ordem INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ano, mes, vendedor)
);

CREATE TABLE IF NOT EXISTS copilot_brain.brain_pipeline (
  band_key TEXT PRIMARY KEY, band_label TEXT, band_display TEXT,
  count_deals BIGINT, total_value NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS copilot_brain.brain_products_sold (
  ano INT NOT NULL, mes INT NOT NULL, produto TEXT NOT NULL,
  qtd_total NUMERIC, receita_total NUMERIC, n_deals BIGINT, ticket_medio NUMERIC, ordem INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ano, mes, produto)
);

CREATE TABLE IF NOT EXISTS copilot_brain.brain_equipment (
  category TEXT NOT NULL, brand TEXT NOT NULL, model TEXT NOT NULL DEFAULT '-',
  lead_count BIGINT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (category, brand, model)
);

CREATE TABLE IF NOT EXISTS copilot_brain.brain_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL, title TEXT NOT NULL, detail TEXT,
  metric_value NUMERIC, ref_period TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE copilot_brain.brain_meta           ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_brain.brain_overview       ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_brain.brain_sales_month    ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_brain.brain_sales_ranking  ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_brain.brain_pipeline       ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_brain.brain_products_sold  ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_brain.brain_equipment      ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_brain.brain_alerts         ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['brain_meta','brain_overview','brain_sales_month','brain_sales_ranking',
    'brain_pipeline','brain_products_sold','brain_equipment','brain_alerts'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "brain_read_auth" ON copilot_brain.%I', t);
    EXECUTE format('CREATE POLICY "brain_read_auth" ON copilot_brain.%I FOR SELECT TO authenticated USING (true)', t);
  END LOOP;
END $$;

GRANT SELECT ON ALL TABLES IN SCHEMA copilot_brain TO authenticated;
GRANT ALL    ON ALL TABLES IN SCHEMA copilot_brain TO service_role;

CREATE OR REPLACE FUNCTION copilot_brain.fn_log_meta(_section TEXT, _rows BIGINT, _ms INT)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = copilot_brain, public AS $$
  INSERT INTO copilot_brain.brain_meta(section, updated_at, row_count, duration_ms)
  VALUES (_section, now(), _rows, _ms)
  ON CONFLICT (section) DO UPDATE
    SET updated_at = EXCLUDED.updated_at, row_count = EXCLUDED.row_count, duration_ms = EXCLUDED.duration_ms;
$$;

CREATE OR REPLACE FUNCTION copilot_brain.refresh_sales_month(_months INT DEFAULT 24)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = copilot_brain, public AS $$
DECLARE _start TIMESTAMPTZ := clock_timestamp(); _y INT; _m INT; _i INT;
        _cur RECORD; _prev RECORD; _dr NUMERIC; _dd NUMERIC; _dt NUMERIC; _rows BIGINT := 0;
BEGIN
  FOR _i IN 0.._months-1 LOOP
    _y := EXTRACT(YEAR  FROM (date_trunc('month', now()) - (_i || ' months')::interval))::int;
    _m := EXTRACT(MONTH FROM (date_trunc('month', now()) - (_i || ' months')::interval))::int;
    SELECT * INTO _cur  FROM public.fn_total_vendas_mes(_y, _m);
    SELECT * INTO _prev FROM public.fn_total_vendas_mes(
      CASE WHEN _m=1 THEN _y-1 ELSE _y END, CASE WHEN _m=1 THEN 12 ELSE _m-1 END);
    _dr := CASE WHEN COALESCE(_prev.receita_total,0)=0 THEN NULL
           ELSE ROUND(((COALESCE(_cur.receita_total,0)-_prev.receita_total)/_prev.receita_total*100)::numeric,1) END;
    _dd := CASE WHEN COALESCE(_prev.total_deals,0)=0 THEN NULL
           ELSE ROUND(((COALESCE(_cur.total_deals,0)-_prev.total_deals)::numeric/_prev.total_deals*100),1) END;
    _dt := CASE WHEN COALESCE(_prev.ticket_medio,0)=0 THEN NULL
           ELSE ROUND(((COALESCE(_cur.ticket_medio,0)-_prev.ticket_medio)/_prev.ticket_medio*100)::numeric,1) END;
    INSERT INTO copilot_brain.brain_sales_month
      VALUES (_y,_m,lpad(_m::text,2,'0')||'/'||_y,
        COALESCE(_cur.receita_total,0),COALESCE(_cur.total_deals,0),COALESCE(_cur.ticket_medio,0),
        _cur.top_vendedor,_cur.receita_top,_dr,_dd,_dt,now())
    ON CONFLICT (ano,mes) DO UPDATE
      SET receita_total=EXCLUDED.receita_total, total_deals=EXCLUDED.total_deals,
          ticket_medio=EXCLUDED.ticket_medio, top_vendedor=EXCLUDED.top_vendedor,
          receita_top=EXCLUDED.receita_top, delta_receita_pct=EXCLUDED.delta_receita_pct,
          delta_deals_pct=EXCLUDED.delta_deals_pct, delta_ticket_pct=EXCLUDED.delta_ticket_pct,
          updated_at=now();
    _rows := _rows + 1;
  END LOOP;
  PERFORM copilot_brain.fn_log_meta('brain_sales_month',_rows,EXTRACT(MILLISECONDS FROM clock_timestamp()-_start)::int);
END $$;

CREATE OR REPLACE FUNCTION copilot_brain.refresh_sales_ranking(_months INT DEFAULT 12)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = copilot_brain, public AS $$
DECLARE _start TIMESTAMPTZ := clock_timestamp(); _y INT; _m INT; _i INT; _rows BIGINT := 0;
BEGIN
  FOR _i IN 0.._months-1 LOOP
    _y := EXTRACT(YEAR  FROM (date_trunc('month', now()) - (_i || ' months')::interval))::int;
    _m := EXTRACT(MONTH FROM (date_trunc('month', now()) - (_i || ' months')::interval))::int;
    DELETE FROM copilot_brain.brain_sales_ranking WHERE ano=_y AND mes=_m;
    INSERT INTO copilot_brain.brain_sales_ranking
    SELECT _y,_m,r.vendedor,r.total_deals,r.receita_total,r.ticket_medio,r.pct_receita,
           r.leads_recebidos,LEAST(r.taxa_conversao,100),
           ROW_NUMBER() OVER (ORDER BY r.receita_total DESC NULLS LAST), now()
    FROM public.fn_resumo_vendas_mes(_y,_m) r;
    GET DIAGNOSTICS _rows = ROW_COUNT;
  END LOOP;
  PERFORM copilot_brain.fn_log_meta('brain_sales_ranking',_rows,EXTRACT(MILLISECONDS FROM clock_timestamp()-_start)::int);
END $$;

CREATE OR REPLACE FUNCTION copilot_brain.refresh_pipeline()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = copilot_brain, public AS $$
DECLARE _start TIMESTAMPTZ := clock_timestamp();
BEGIN
  DELETE FROM copilot_brain.brain_pipeline;
  WITH stage_map AS (
    SELECT * FROM (VALUES
      ('em_processo','Em Processo','< 60'),
      ('boas_chances','Boas Chances','60-80'),
      ('comprometido','Comprometido','90'),
      ('conquistado','Conquistado','100')
    ) AS m(band_key,label,display)
  ),
  classified AS (
    SELECT
      CASE
        WHEN d.stage_name IN ('Sem contato','Sem Contato','Contato Inicial','Contato Feito',
              'Distribuidor de leads','Etapa 00 - Novos','Etapa 01 - Reativação','Etapa 02 - Reativação',
              'Etapa 03 - Reativção','Etapa 04 - Reativação','Ebook Message Helper','ioConnect') THEN 'em_processo'
        WHEN d.stage_name IN ('Em Contato','Apresentação/Visita','Apresentação/Visita - Estag',
              'Astron Testes','Distirbuidor - Fresadora') THEN 'boas_chances'
        WHEN d.stage_name IN ('Negociação','Proposta enviada','Proposta Enviada - Estag',
              'Fechamento','Fechamento - Estag') THEN 'comprometido'
        WHEN d.stage_name IN ('Etapa 1','Em espera','Treinamento Agendado','Equipamentos Entregues',
              'Pedir Faturamento') THEN 'conquistado'
        ELSE 'em_processo'
      END AS band_key, d.value
    FROM public.deals d
    WHERE d.status='aberta' AND COALESCE(d.is_deleted,false)=false AND d.stage_name IS NOT NULL
  )
  INSERT INTO copilot_brain.brain_pipeline(band_key,band_label,band_display,count_deals,total_value,updated_at)
  SELECT m.band_key, m.label, m.display,
         COALESCE(COUNT(c.band_key),0), COALESCE(ROUND(SUM(c.value)::numeric,2),0), now()
  FROM stage_map m LEFT JOIN classified c ON c.band_key = m.band_key
  GROUP BY m.band_key, m.label, m.display;
  PERFORM copilot_brain.fn_log_meta('brain_pipeline',4,EXTRACT(MILLISECONDS FROM clock_timestamp()-_start)::int);
END $$;

CREATE OR REPLACE FUNCTION copilot_brain.refresh_products_sold(_months INT DEFAULT 12)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = copilot_brain, public AS $$
DECLARE _start TIMESTAMPTZ := clock_timestamp(); _y INT; _m INT; _i INT; _rows BIGINT := 0;
BEGIN
  FOR _i IN 0.._months-1 LOOP
    _y := EXTRACT(YEAR  FROM (date_trunc('month', now()) - (_i || ' months')::interval))::int;
    _m := EXTRACT(MONTH FROM (date_trunc('month', now()) - (_i || ' months')::interval))::int;
    DELETE FROM copilot_brain.brain_products_sold WHERE ano=_y AND mes=_m;
    INSERT INTO copilot_brain.brain_products_sold
    SELECT _y,_m,p.produto,p.qtd_total,p.receita_total,p.n_deals,p.ticket_medio,
           ROW_NUMBER() OVER (ORDER BY p.receita_total DESC NULLS LAST), now()
    FROM public.fn_itens_propostas_ganhas_mes(_y,_m) p;
    GET DIAGNOSTICS _rows = ROW_COUNT;
  END LOOP;
  PERFORM copilot_brain.fn_log_meta('brain_products_sold',_rows,EXTRACT(MILLISECONDS FROM clock_timestamp()-_start)::int);
END $$;

CREATE OR REPLACE FUNCTION copilot_brain.refresh_equipment()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = copilot_brain, public AS $$
DECLARE _start TIMESTAMPTZ := clock_timestamp(); _rows BIGINT := 0;
BEGIN
  DELETE FROM copilot_brain.brain_equipment;
  INSERT INTO copilot_brain.brain_equipment(category,brand,model,lead_count,updated_at)
  SELECT 'scanner', COALESCE(brand,'Outros'), COALESCE(NULLIF(trim(model),''),'-'), lead_count, now()
  FROM public.query_scanner_brand_distribution()
  ON CONFLICT (category,brand,model) DO UPDATE SET lead_count=EXCLUDED.lead_count, updated_at=now();
  INSERT INTO copilot_brain.brain_equipment(category,brand,model,lead_count,updated_at)
  SELECT 'printer', COALESCE(brand,'Outros'), COALESCE(NULLIF(trim(model),''),'-'), lead_count, now()
  FROM public.query_printer_brand_distribution()
  ON CONFLICT (category,brand,model) DO UPDATE SET lead_count=EXCLUDED.lead_count, updated_at=now();
  SELECT count(*) INTO _rows FROM copilot_brain.brain_equipment;
  PERFORM copilot_brain.fn_log_meta('brain_equipment',_rows,EXTRACT(MILLISECONDS FROM clock_timestamp()-_start)::int);
END $$;

CREATE OR REPLACE FUNCTION copilot_brain.refresh_overview()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = copilot_brain, public AS $$
DECLARE _start TIMESTAMPTZ := clock_timestamp();
  _y INT := EXTRACT(YEAR FROM now())::int; _m INT := EXTRACT(MONTH FROM now())::int;
  _cur RECORD; _prev RECORD; _ln BIGINT; _lt BIGINT; _pipe RECORD; _tp RECORD;
  _dr NUMERIC; _dd NUMERIC;
BEGIN
  SELECT * INTO _cur  FROM public.fn_total_vendas_mes(_y,_m);
  SELECT * INTO _prev FROM public.fn_total_vendas_mes(
    CASE WHEN _m=1 THEN _y-1 ELSE _y END, CASE WHEN _m=1 THEN 12 ELSE _m-1 END);
  SELECT COUNT(*) INTO _ln FROM public.lia_attendances WHERE merged_into IS NULL AND created_at >= date_trunc('month', now());
  SELECT COUNT(*) INTO _lt FROM public.lia_attendances WHERE merged_into IS NULL;
  SELECT COALESCE(SUM(count_deals),0) AS c, COALESCE(SUM(total_value),0) AS v INTO _pipe FROM copilot_brain.brain_pipeline;
  SELECT produto, receita_total INTO _tp FROM copilot_brain.brain_products_sold
    WHERE ano=_y AND mes=_m ORDER BY receita_total DESC NULLS LAST LIMIT 1;
  _dr := CASE WHEN COALESCE(_prev.receita_total,0)=0 THEN NULL
         ELSE ROUND(((COALESCE(_cur.receita_total,0)-_prev.receita_total)/_prev.receita_total*100)::numeric,1) END;
  _dd := CASE WHEN COALESCE(_prev.total_deals,0)=0 THEN NULL
         ELSE ROUND(((COALESCE(_cur.total_deals,0)-_prev.total_deals)::numeric/_prev.total_deals*100),1) END;
  INSERT INTO copilot_brain.brain_overview VALUES
    (1, lpad(_m::text,2,'0')||'/'||_y, COALESCE(_cur.receita_total,0),COALESCE(_cur.total_deals,0),
     COALESCE(_cur.ticket_medio,0), _ln, _lt, _pipe.v, _pipe.c,
     _cur.top_vendedor, _cur.receita_top, _tp.produto, _tp.receita_total, _dr, _dd, now())
  ON CONFLICT (id) DO UPDATE SET
    periodo=EXCLUDED.periodo, receita_mes=EXCLUDED.receita_mes, deals_ganhos_mes=EXCLUDED.deals_ganhos_mes,
    ticket_medio_mes=EXCLUDED.ticket_medio_mes, leads_novos_mes=EXCLUDED.leads_novos_mes,
    leads_canonicos_total=EXCLUDED.leads_canonicos_total, pipeline_total_value=EXCLUDED.pipeline_total_value,
    pipeline_total_deals=EXCLUDED.pipeline_total_deals, top_vendedor=EXCLUDED.top_vendedor,
    top_vendedor_receita=EXCLUDED.top_vendedor_receita, top_produto=EXCLUDED.top_produto,
    top_produto_receita=EXCLUDED.top_produto_receita, delta_receita_mom_pct=EXCLUDED.delta_receita_mom_pct,
    delta_deals_mom_pct=EXCLUDED.delta_deals_mom_pct, updated_at=now();
  PERFORM copilot_brain.fn_log_meta('brain_overview',1,EXTRACT(MILLISECONDS FROM clock_timestamp()-_start)::int);
END $$;

CREATE OR REPLACE FUNCTION copilot_brain.refresh_alerts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = copilot_brain, public AS $$
DECLARE _start TIMESTAMPTZ := clock_timestamp(); _ov RECORD; _rows BIGINT := 0;
BEGIN
  DELETE FROM copilot_brain.brain_alerts;
  SELECT * INTO _ov FROM copilot_brain.brain_overview WHERE id=1;
  IF _ov IS NULL THEN
    PERFORM copilot_brain.fn_log_meta('brain_alerts',0,EXTRACT(MILLISECONDS FROM clock_timestamp()-_start)::int);
    RETURN;
  END IF;
  IF _ov.delta_receita_mom_pct IS NOT NULL AND _ov.delta_receita_mom_pct < -30 THEN
    INSERT INTO copilot_brain.brain_alerts(severity,title,detail,metric_value,ref_period)
    VALUES ('critical','Queda de receita vs mês anterior',
      'Receita do mês está '||_ov.delta_receita_mom_pct||'% vs mês anterior.',
      _ov.delta_receita_mom_pct, _ov.periodo);
    _rows := _rows + 1;
  END IF;
  IF _ov.pipeline_total_deals > 0 AND _ov.deals_ganhos_mes < 5 THEN
    INSERT INTO copilot_brain.brain_alerts(severity,title,detail,metric_value,ref_period)
    VALUES ('warn','Baixa conversão do mês',
      'Apenas '||_ov.deals_ganhos_mes||' deals ganhos com pipeline ativo de '||_ov.pipeline_total_deals||' deals.',
      _ov.deals_ganhos_mes, _ov.periodo);
    _rows := _rows + 1;
  END IF;
  PERFORM copilot_brain.fn_log_meta('brain_alerts',_rows,EXTRACT(MILLISECONDS FROM clock_timestamp()-_start)::int);
END $$;

CREATE OR REPLACE FUNCTION copilot_brain.refresh_all()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = copilot_brain, public AS $$
DECLARE _t TIMESTAMPTZ := clock_timestamp();
BEGIN
  PERFORM copilot_brain.refresh_pipeline();
  PERFORM copilot_brain.refresh_sales_month(24);
  PERFORM copilot_brain.refresh_sales_ranking(12);
  PERFORM copilot_brain.refresh_products_sold(12);
  PERFORM copilot_brain.refresh_equipment();
  PERFORM copilot_brain.refresh_overview();
  PERFORM copilot_brain.refresh_alerts();
  RETURN jsonb_build_object('ok',true,'duration_ms',EXTRACT(MILLISECONDS FROM clock_timestamp()-_t)::int);
END $$;

GRANT EXECUTE ON FUNCTION copilot_brain.refresh_all()              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION copilot_brain.refresh_overview()         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION copilot_brain.refresh_pipeline()         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION copilot_brain.refresh_sales_month(int)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION copilot_brain.refresh_sales_ranking(int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION copilot_brain.refresh_products_sold(int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION copilot_brain.refresh_equipment()        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION copilot_brain.refresh_alerts()           TO authenticated, service_role;

SELECT copilot_brain.refresh_all();
