-- lovable-cron-fallback-reviewed: 144 runs/day; dados chegam de fontes externas (CRM, loja, WhatsApp) sem webhook de identidade; reconciliação de 10 min mantém grafo e histórico quase em tempo real
-- ============================================================
-- Identity / Customer / Behavior Graph — alimentação contínua
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_store (
  id              BIGSERIAL PRIMARY KEY,
  event_type      TEXT NOT NULL,
  event_source    TEXT NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  person_id       UUID,
  company_id      UUID,
  lead_id         UUID,
  deal_id         UUID,
  source_table    TEXT NOT NULL,
  source_id       TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_store_source
  ON public.event_store (source_table, source_id, event_type);
CREATE INDEX IF NOT EXISTS idx_event_store_person ON public.event_store (person_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_store_lead   ON public.event_store (lead_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_store_type   ON public.event_store (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_store_occurred ON public.event_store (occurred_at DESC);

GRANT SELECT ON public.event_store TO authenticated;
GRANT ALL ON public.event_store TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.event_store_id_seq TO service_role;

ALTER TABLE public.event_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_store_read_team" ON public.event_store;
CREATE POLICY "event_store_read_team" ON public.event_store
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.fn_event_store_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'event_store é append-only: % não permitido', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_store_append_only ON public.event_store;
CREATE TRIGGER trg_event_store_append_only
  BEFORE UPDATE OR DELETE ON public.event_store
  FOR EACH ROW EXECUTE FUNCTION public.fn_event_store_append_only();

CREATE TABLE IF NOT EXISTS public.graph_maintenance_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  report       JSONB NOT NULL DEFAULT '{}'::jsonb,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.graph_maintenance_runs TO authenticated;
GRANT ALL ON public.graph_maintenance_runs TO service_role;
ALTER TABLE public.graph_maintenance_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "graph_runs_read_team" ON public.graph_maintenance_runs;
CREATE POLICY "graph_runs_read_team" ON public.graph_maintenance_runs
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.fn_graph_link_leads(p_limit INT DEFAULT 1000)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r         RECORD;
  v_person  UUID;
  v_company UUID;
  n         INT := 0;
BEGIN
  FOR r IN
    SELECT l.id, l.nome, l.email, l.telefone_normalized, l.pessoa_piperun_id, l.pessoa_cpf
    FROM public.lia_attendances l
    WHERE l.merged_into IS NULL
      AND l.person_id IS NULL
      AND (
        l.pessoa_piperun_id IS NOT NULL
        OR NULLIF(btrim(COALESCE(l.email,'')),'') IS NOT NULL
        OR NULLIF(btrim(COALESCE(l.telefone_normalized,'')),'') IS NOT NULL
      )
    ORDER BY l.created_at DESC NULLS LAST
    LIMIT p_limit
  LOOP
    v_person := NULL; v_company := NULL;

    SELECT ri.person_id, ri.company_id INTO v_person, v_company
    FROM public.resolve_lead_identity(r.id) ri;

    IF v_person IS NULL THEN
      BEGIN
        INSERT INTO public.people (piperun_person_id, email, telefone_normalized, nome, cpf)
        VALUES (
          r.pessoa_piperun_id,
          NULLIF(btrim(COALESCE(r.email,'')),''),
          NULLIF(btrim(COALESCE(r.telefone_normalized,'')),''),
          NULLIF(btrim(COALESCE(r.nome,'')),''),
          NULLIF(regexp_replace(COALESCE(r.pessoa_cpf,''), '\D', '', 'g'), '')
        )
        RETURNING id INTO v_person;
      EXCEPTION WHEN unique_violation THEN
        SELECT p.id INTO v_person FROM public.people p
        WHERE r.pessoa_piperun_id IS NOT NULL AND p.piperun_person_id = r.pessoa_piperun_id
        LIMIT 1;
      END;
    END IF;

    IF v_person IS NOT NULL THEN
      UPDATE public.lia_attendances
      SET person_id = v_person,
          company_id = COALESCE(company_id, v_company)
      WHERE id = r.id AND person_id IS NULL;
      n := n + 1;
    END IF;
  END LOOP;

  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_graph_backfill_identity_keys(p_limit INT DEFAULT 2000)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m INT;
BEGIN
  WITH alvo AS (
    SELECT p.id, p.email, p.telefone_normalized, p.piperun_person_id, p.cpf
    FROM public.people p
    WHERE NOT EXISTS (SELECT 1 FROM public.identity_keys k WHERE k.person_id = p.id)
    ORDER BY p.updated_at DESC NULLS LAST
    LIMIT p_limit
  ), ins AS (
    INSERT INTO public.identity_keys (person_id, type, value, confidence, source, is_primary)
    SELECT alvo.id, t.type, t.value, 'confirmed', 'graph_maintenance', true
    FROM alvo
    CROSS JOIN LATERAL (
      VALUES
        ('email', lower(NULLIF(btrim(COALESCE(alvo.email,'')),''))),
        ('phone', NULLIF(regexp_replace(COALESCE(alvo.telefone_normalized,''), '\D', '', 'g'), '')),
        ('piperun_person_id', NULLIF(alvo.piperun_person_id::text,'')),
        ('cpf', NULLIF(regexp_replace(COALESCE(alvo.cpf,''), '\D', '', 'g'), ''))
    ) AS t(type, value)
    WHERE t.value IS NOT NULL
    ON CONFLICT (type, value) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO m FROM ins;

  RETURN COALESCE(m, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_graph_link_deals(p_limit INT DEFAULT 2000)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  WITH alvo AS (
    SELECT d.id, d.lead_id
    FROM public.deals d
    WHERE d.lead_id IS NOT NULL
      AND (d.person_id IS NULL OR d.company_id IS NULL)
    ORDER BY d.piperun_created_at DESC NULLS LAST
    LIMIT p_limit
  ), res AS (
    SELECT a.id, ri.person_id, ri.company_id
    FROM alvo a
    CROSS JOIN LATERAL public.resolve_lead_identity(a.lead_id) ri
  ), upd AS (
    UPDATE public.deals d
    SET person_id = COALESCE(d.person_id, res.person_id),
        company_id = COALESCE(d.company_id, res.company_id)
    FROM res
    WHERE d.id = res.id
      AND (res.person_id IS NOT NULL OR res.company_id IS NOT NULL)
    RETURNING 1
  )
  SELECT count(*) INTO n FROM upd;
  RETURN COALESCE(n,0);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_graph_link_activities(p_limit INT DEFAULT 5000)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  WITH alvo AS (
    SELECT lal.id, lal.lead_id
    FROM public.lead_activity_log lal
    WHERE lal.lead_id IS NOT NULL
      AND lal.person_id IS NULL
    ORDER BY lal.created_at DESC NULLS LAST
    LIMIT p_limit
  ), res AS (
    SELECT a.id, ri.person_id, ri.company_id
    FROM alvo a
    CROSS JOIN LATERAL public.resolve_lead_identity(a.lead_id) ri
    WHERE ri.person_id IS NOT NULL OR ri.company_id IS NOT NULL
  ), upd AS (
    UPDATE public.lead_activity_log lal
    SET person_id = COALESCE(lal.person_id, res.person_id),
        company_id = COALESCE(lal.company_id, res.company_id),
        identity_resolved_at = now()
    FROM res
    WHERE lal.id = res.id
    RETURNING 1
  )
  SELECT count(*) INTO n FROM upd;
  RETURN COALESCE(n,0);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_event_store_ingest(p_limit INT DEFAULT 5000)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c_lal TIMESTAMPTZ;
  c_lse TIMESTAMPTZ;
  c_dsh TIMESTAMPTZ;
  n_lal INT := 0; n_lse INT := 0; n_dsh INT := 0;
  max_lal TIMESTAMPTZ; max_lse TIMESTAMPTZ; max_dsh TIMESTAMPTZ;
BEGIN
  SELECT COALESCE((SELECT value FROM public.cron_state WHERE key='graph_es_cursor_lal')::timestamptz,
                  now() - interval '90 days') INTO c_lal;
  SELECT COALESCE((SELECT value FROM public.cron_state WHERE key='graph_es_cursor_lse')::timestamptz,
                  now() - interval '90 days') INTO c_lse;
  SELECT COALESCE((SELECT value FROM public.cron_state WHERE key='graph_es_cursor_dsh')::timestamptz,
                  now() - interval '90 days') INTO c_dsh;

  WITH src AS (
    SELECT lal.id, lal.lead_id, lal.person_id, lal.company_id, lal.event_type,
           COALESCE(lal.event_timestamp, lal.created_at) AS occurred_at,
           lal.created_at, lal.source_channel, lal.entity_type, lal.entity_name,
           lal.value_numeric, lal.event_data
    FROM public.lead_activity_log lal
    WHERE lal.created_at > c_lal
    ORDER BY lal.created_at ASC
    LIMIT p_limit
  ), ins AS (
    INSERT INTO public.event_store (event_type, event_source, occurred_at, person_id, company_id,
                                    lead_id, source_table, source_id, payload)
    SELECT COALESCE(src.event_type,'activity'), COALESCE(src.source_channel,'sistema'),
           src.occurred_at, src.person_id, src.company_id, src.lead_id,
           'lead_activity_log', src.id::text,
           jsonb_strip_nulls(jsonb_build_object(
             'entity_type', src.entity_type,
             'entity_name', src.entity_name,
             'value_numeric', src.value_numeric,
             'event_data', src.event_data
           ))
    FROM src
    ON CONFLICT (source_table, source_id, event_type) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM ins), (SELECT max(created_at) FROM src) INTO n_lal, max_lal;

  WITH src AS (
    SELECT e.id, e.lead_id, e.old_stage, e.new_stage, e.cognitive_stage, e.owner_id,
           e.source, e.is_regression, e.changed_at
    FROM public.lead_state_events e
    WHERE e.changed_at > c_lse
    ORDER BY e.changed_at ASC
    LIMIT p_limit
  ), ins AS (
    INSERT INTO public.event_store (event_type, event_source, occurred_at, person_id, company_id,
                                    lead_id, source_table, source_id, payload)
    SELECT 'stage_changed', COALESCE(src.source,'crm'), src.changed_at,
           ri.person_id, ri.company_id, src.lead_id,
           'lead_state_events', src.id::text,
           jsonb_strip_nulls(jsonb_build_object(
             'old_stage', src.old_stage,
             'new_stage', src.new_stage,
             'cognitive_stage', src.cognitive_stage,
             'owner_id', src.owner_id,
             'is_regression', src.is_regression
           ))
    FROM src
    LEFT JOIN LATERAL public.resolve_lead_identity(src.lead_id) ri ON true
    ON CONFLICT (source_table, source_id, event_type) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM ins), (SELECT max(changed_at) FROM src) INTO n_lse, max_lse;

  WITH src AS (
    SELECT h.id, h.lead_id, h.status, h.event_name, h.source, h.created_at
    FROM public.deal_status_history h
    WHERE h.created_at > c_dsh
    ORDER BY h.created_at ASC
    LIMIT p_limit
  ), ins AS (
    INSERT INTO public.event_store (event_type, event_source, occurred_at, person_id, company_id,
                                    lead_id, source_table, source_id, payload)
    SELECT 'deal_status_changed', COALESCE(src.source,'crm'), src.created_at,
           ri.person_id, ri.company_id, src.lead_id,
           'deal_status_history', src.id::text,
           jsonb_strip_nulls(jsonb_build_object('status', src.status, 'event_name', src.event_name))
    FROM src
    LEFT JOIN LATERAL public.resolve_lead_identity(src.lead_id) ri ON true
    ON CONFLICT (source_table, source_id, event_type) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM ins), (SELECT max(created_at) FROM src) INTO n_dsh, max_dsh;

  IF max_lal IS NOT NULL THEN
    INSERT INTO public.cron_state (key, value, updated_at) VALUES ('graph_es_cursor_lal', max_lal::text, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END IF;
  IF max_lse IS NOT NULL THEN
    INSERT INTO public.cron_state (key, value, updated_at) VALUES ('graph_es_cursor_lse', max_lse::text, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END IF;
  IF max_dsh IS NOT NULL THEN
    INSERT INTO public.cron_state (key, value, updated_at) VALUES ('graph_es_cursor_dsh', max_dsh::text, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END IF;

  RETURN jsonb_build_object('activities', n_lal, 'stage_events', n_lse, 'deal_status', n_dsh);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_graph_maintenance(p_batch INT DEFAULT 2000)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run  UUID;
  v_rep  JSONB := '{}'::jsonb;
  v_es   JSONB;
BEGIN
  INSERT INTO public.graph_maintenance_runs (report) VALUES ('{}'::jsonb) RETURNING id INTO v_run;

  v_rep := v_rep || jsonb_build_object('leads_linked',      public.fn_graph_link_leads(p_batch));
  v_rep := v_rep || jsonb_build_object('identity_keys',     public.fn_graph_backfill_identity_keys(p_batch));
  v_rep := v_rep || jsonb_build_object('deals_linked',      public.fn_graph_link_deals(p_batch));
  v_rep := v_rep || jsonb_build_object('activities_linked', public.fn_graph_link_activities(p_batch * 2));

  v_es := public.fn_event_store_ingest(p_batch * 3);
  v_rep := v_rep || jsonb_build_object('event_store', v_es);

  UPDATE public.graph_maintenance_runs
  SET finished_at = now(), report = v_rep
  WHERE id = v_run;

  RETURN v_rep;
EXCEPTION WHEN OTHERS THEN
  UPDATE public.graph_maintenance_runs
  SET finished_at = now(), report = v_rep, error = SQLERRM
  WHERE id = v_run;
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_graph_maintenance(INT) TO service_role;

SELECT cron.unschedule('graph-maintenance-10min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'graph-maintenance-10min');

SELECT cron.schedule(
  'graph-maintenance-10min',
  '4,14,24,34,44,54 * * * *',
  $cron$ SELECT public.fn_graph_maintenance(2000); $cron$
);