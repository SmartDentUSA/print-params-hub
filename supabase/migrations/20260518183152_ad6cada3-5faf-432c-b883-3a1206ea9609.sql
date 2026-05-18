-- 1. Cognitive insights table (1:1 with lia_attendances)
CREATE TABLE IF NOT EXISTS public.lia_cognitive_insights (
    lead_id UUID PRIMARY KEY REFERENCES public.lia_attendances(id) ON DELETE CASCADE,
    cognitive_summary TEXT,
    cognitive_score INT,
    cognitive_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lia_cognitive_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lci_admin_read" ON public.lia_cognitive_insights;
CREATE POLICY "lci_admin_read"
  ON public.lia_cognitive_insights
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "lci_service_all" ON public.lia_cognitive_insights;
CREATE POLICY "lci_service_all"
  ON public.lia_cognitive_insights
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lia_cognitive_insights_updated_at
  ON public.lia_cognitive_insights(cognitive_updated_at DESC);

-- updated_at trigger (reuse global function if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pronamespace = 'public'::regnamespace) THEN
    DROP TRIGGER IF EXISTS trg_lci_updated_at ON public.lia_cognitive_insights;
    CREATE TRIGGER trg_lci_updated_at
      BEFORE UPDATE ON public.lia_cognitive_insights
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 2. Enriched view consumed by Copilot / Hero Card
CREATE OR REPLACE VIEW public.vw_lia_attendances_enriched AS
SELECT
    a.*,
    c.cognitive_summary AS insight_cognitive_summary,
    c.cognitive_score   AS insight_cognitive_score,
    c.cognitive_updated_at AS insight_updated_at,
    c.payload           AS cognitive_payload
FROM public.lia_attendances a
LEFT JOIN public.lia_cognitive_insights c ON a.id = c.lead_id;

-- 3. Backfill from legacy columns (only when target column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lia_attendances'
      AND column_name = 'cognitive_summary'
  ) THEN
    EXECUTE $bf$
      INSERT INTO public.lia_cognitive_insights (lead_id, cognitive_summary, cognitive_updated_at)
      SELECT id, cognitive_summary,
             COALESCE(cognitive_updated_at, updated_at, NOW())
      FROM public.lia_attendances
      WHERE cognitive_summary IS NOT NULL
        AND merged_into IS NULL
      ON CONFLICT (lead_id) DO NOTHING;
    $bf$;
  END IF;
END$$;

-- 4. Advisory lock RPC for cognitive-lead-analysis
CREATE OR REPLACE FUNCTION public.try_lock_cognitive_analysis(target_lead_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_xact_lock(hashtext('cog:' || target_lead_id::text));
$$;

REVOKE ALL ON FUNCTION public.try_lock_cognitive_analysis(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_lock_cognitive_analysis(UUID) TO service_role, authenticated;