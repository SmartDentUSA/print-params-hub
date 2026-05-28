-- Fix: agregar antes de inserir para evitar duplicatas (category,brand,model)
CREATE OR REPLACE FUNCTION copilot_brain.refresh_equipment()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = copilot_brain, public AS $$
DECLARE _start TIMESTAMPTZ := clock_timestamp(); _rows BIGINT := 0;
BEGIN
  DELETE FROM copilot_brain.brain_equipment;
  INSERT INTO copilot_brain.brain_equipment(category,brand,model,lead_count,updated_at)
  SELECT 'scanner',
         COALESCE(brand,'Outros'),
         COALESCE(NULLIF(trim(model),''),'-'),
         SUM(lead_count)::bigint,
         now()
  FROM public.query_scanner_brand_distribution()
  GROUP BY 1,2,3;

  INSERT INTO copilot_brain.brain_equipment(category,brand,model,lead_count,updated_at)
  SELECT 'printer',
         COALESCE(brand,'Outros'),
         COALESCE(NULLIF(trim(model),''),'-'),
         SUM(lead_count)::bigint,
         now()
  FROM public.query_printer_brand_distribution()
  GROUP BY 1,2,3;

  SELECT count(*) INTO _rows FROM copilot_brain.brain_equipment;
  PERFORM copilot_brain.fn_log_meta('brain_equipment',_rows,EXTRACT(MILLISECONDS FROM clock_timestamp()-_start)::int);
END $$;

-- Executa o refresh agora
DO $$
DECLARE r jsonb;
BEGIN
  r := public.refresh_copilot_brain(true);
  RAISE NOTICE 'refresh result: %', r;
END $$;

-- Agenda cron a cada 5 min
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname='copilot-brain-refresh-5min';
SELECT cron.schedule('copilot-brain-refresh-5min','*/5 * * * *',
                     $$ SELECT public.refresh_copilot_brain(false); $$);

-- Sanity-check de drift a cada hora
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname='copilot-brain-drift-hourly';
SELECT cron.schedule('copilot-brain-drift-hourly','7 * * * *',
                     $$ SELECT public.check_copilot_brain_drift(); $$);