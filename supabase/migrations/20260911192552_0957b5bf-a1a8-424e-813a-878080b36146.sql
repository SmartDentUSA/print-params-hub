CREATE TABLE IF NOT EXISTS public.graph_link_skips (
  entity_table   TEXT NOT NULL,
  entity_id      UUID NOT NULL,
  attempts       INT NOT NULL DEFAULT 1,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_table, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_graph_link_skips_recent
  ON public.graph_link_skips (entity_table, last_attempt_at DESC);

GRANT SELECT ON public.graph_link_skips TO authenticated;
GRANT ALL ON public.graph_link_skips TO service_role;
ALTER TABLE public.graph_link_skips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "graph_link_skips_read_team" ON public.graph_link_skips;
CREATE POLICY "graph_link_skips_read_team" ON public.graph_link_skips
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.fn_graph_link_deals(p_limit INT DEFAULT 2000)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _gd (id UUID PRIMARY KEY, person_id UUID, company_id UUID) ON COMMIT DROP;
  DELETE FROM _gd;

  INSERT INTO _gd (id, person_id, company_id)
  SELECT a.id, ri.person_id, ri.company_id
  FROM (
    SELECT d.id, d.lead_id
    FROM public.deals d
    WHERE d.lead_id IS NOT NULL
      AND (d.person_id IS NULL OR d.company_id IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM public.graph_link_skips s
        WHERE s.entity_table = 'deals' AND s.entity_id = d.id
          AND s.last_attempt_at > now() - interval '24 hours'
      )
    ORDER BY d.piperun_created_at DESC NULLS LAST
    LIMIT p_limit
  ) a
  CROSS JOIN LATERAL public.resolve_lead_identity(a.lead_id) ri;

  WITH upd AS (
    UPDATE public.deals d
    SET person_id = COALESCE(d.person_id, g.person_id),
        company_id = COALESCE(d.company_id, g.company_id)
    FROM _gd g
    WHERE d.id = g.id
      AND (g.person_id IS NOT NULL OR g.company_id IS NOT NULL)
    RETURNING 1
  )
  SELECT count(*) INTO n FROM upd;

  INSERT INTO public.graph_link_skips (entity_table, entity_id)
  SELECT 'deals', g.id FROM _gd g
  ON CONFLICT (entity_table, entity_id)
  DO UPDATE SET attempts = public.graph_link_skips.attempts + 1, last_attempt_at = now();

  RETURN COALESCE(n,0);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_graph_link_activities(p_limit INT DEFAULT 5000)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _ga (id UUID PRIMARY KEY, person_id UUID, company_id UUID) ON COMMIT DROP;
  DELETE FROM _ga;

  INSERT INTO _ga (id, person_id, company_id)
  SELECT a.id, ri.person_id, ri.company_id
  FROM (
    SELECT lal.id, lal.lead_id
    FROM public.lead_activity_log lal
    WHERE lal.lead_id IS NOT NULL
      AND lal.person_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.graph_link_skips s
        WHERE s.entity_table = 'lead_activity_log' AND s.entity_id = lal.id
          AND s.last_attempt_at > now() - interval '24 hours'
      )
    ORDER BY lal.created_at DESC NULLS LAST
    LIMIT p_limit
  ) a
  CROSS JOIN LATERAL public.resolve_lead_identity(a.lead_id) ri;

  WITH upd AS (
    UPDATE public.lead_activity_log lal
    SET person_id = COALESCE(lal.person_id, g.person_id),
        company_id = COALESCE(lal.company_id, g.company_id),
        identity_resolved_at = now()
    FROM _ga g
    WHERE lal.id = g.id
      AND (g.person_id IS NOT NULL OR g.company_id IS NOT NULL)
    RETURNING 1
  )
  SELECT count(*) INTO n FROM upd;

  INSERT INTO public.graph_link_skips (entity_table, entity_id)
  SELECT 'lead_activity_log', g.id FROM _ga g
  ON CONFLICT (entity_table, entity_id)
  DO UPDATE SET attempts = public.graph_link_skips.attempts + 1, last_attempt_at = now();

  RETURN COALESCE(n,0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_graph_link_deals(INT) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_graph_link_activities(INT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_graph_link_deals(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_graph_link_activities(INT) TO service_role;