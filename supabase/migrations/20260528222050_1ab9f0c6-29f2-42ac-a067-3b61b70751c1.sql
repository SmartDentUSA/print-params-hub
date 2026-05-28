CREATE OR REPLACE FUNCTION public.refresh_copilot_brain(p_force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, copilot_brain
AS $$
DECLARE
  _start timestamptz := clock_timestamp();
  _got_lock boolean;
  _last_refresh timestamptz;
  _age_sec int;
BEGIN
  _got_lock := pg_try_advisory_lock(737373);
  IF NOT _got_lock THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked_by_other_process');
  END IF;

  SELECT max(updated_at) INTO _last_refresh FROM copilot_brain.brain_meta;
  _age_sec := COALESCE(EXTRACT(EPOCH FROM (now() - _last_refresh))::int, 999999);
  IF NOT p_force AND _age_sec < 60 THEN
    PERFORM pg_advisory_unlock(737373);
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'age_seconds', _age_sec);
  END IF;

  BEGIN
    PERFORM copilot_brain.refresh_all();
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(737373);
    INSERT INTO public.system_health_logs(function_name, severity, error_type, details)
    VALUES ('copilot_brain_refresh', 'error', 'refresh_failed',
            jsonb_build_object('error', SQLERRM, 'state', SQLSTATE));
    RAISE;
  END;

  PERFORM pg_advisory_unlock(737373);

  INSERT INTO public.system_health_logs(function_name, severity, error_type, details)
  VALUES ('copilot_brain_refresh', 'info', 'ok',
    jsonb_build_object(
      'duration_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - _start))::int,
      'previous_age_seconds', _age_sec
    ));

  RETURN jsonb_build_object(
    'ok', true,
    'duration_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - _start))::int,
    'previous_age_seconds', _age_sec
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_copilot_brain_drift()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, copilot_brain
AS $$
DECLARE
  _brain_receita numeric; _live_receita numeric;
  _brain_deals bigint; _live_deals bigint;
  _last_refresh timestamptz; _diff_pct numeric; _result jsonb;
BEGIN
  SELECT receita_mes, deals_ganhos_mes, updated_at
    INTO _brain_receita, _brain_deals, _last_refresh
  FROM copilot_brain.brain_overview WHERE id = 1;

  SELECT COALESCE(sum(d.value), 0), count(*)
    INTO _live_receita, _live_deals
  FROM public.deals d
  WHERE d.status = 'ganha' AND d.closed_at IS NOT NULL
    AND COALESCE(d.is_deleted, false) = false
    AND COALESCE(d.pipeline_name, '') <> ALL (ARRAY[
      'Funil Atos','Funil E-book','Tulip-Teste-Nv-Automação','Tulip-Teste-Nv-Automacao',
      'Exportação','Ganhos Aleatórios','Ganhos Aleatórios (CS)','Ganhos Aleatorios'])
    AND to_char(d.closed_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') =
        to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM');

  _diff_pct := CASE WHEN _live_receita > 0
                    THEN abs(_live_receita - _brain_receita) / _live_receita * 100
                    ELSE 0 END;

  _result := jsonb_build_object(
    'brain_receita', _brain_receita, 'live_receita', _live_receita,
    'brain_deals', _brain_deals, 'live_deals', _live_deals,
    'diff_pct', round(_diff_pct, 2),
    'last_refresh', _last_refresh,
    'age_minutes', round(EXTRACT(EPOCH FROM (now() - _last_refresh))/60)
  );

  INSERT INTO public.system_health_logs(function_name, severity, error_type, details)
  VALUES ('copilot_brain_drift',
          CASE WHEN _diff_pct > 5 OR (now() - _last_refresh) > interval '30 minutes'
               THEN 'error' ELSE 'info' END,
          'drift_check', _result);

  IF _diff_pct > 5 OR (now() - _last_refresh) > interval '30 minutes' THEN
    INSERT INTO copilot_brain.brain_alerts(severity, title, detail, metric_value, ref_period)
    VALUES ('critical', 'Cérebro defasado vs CRM',
            format('Diff %s%% — Cérebro: R$ %s vs CRM ao vivo: R$ %s. Última atualização há %s min.',
                   round(_diff_pct,1),
                   to_char(_brain_receita,'FM999G999G990D00'),
                   to_char(_live_receita,'FM999G999G990D00'),
                   round(EXTRACT(EPOCH FROM (now()-_last_refresh))/60)),
            _diff_pct,
            to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM'));
  END IF;

  RETURN _result;
END;
$$;