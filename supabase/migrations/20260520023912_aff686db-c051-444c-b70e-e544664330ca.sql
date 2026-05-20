CREATE TABLE IF NOT EXISTS public.sitemap_resubmit_state (
  id integer PRIMARY KEY DEFAULT 1,
  needs_resubmit boolean NOT NULL DEFAULT true,
  last_marked_at timestamptz NOT NULL DEFAULT now(),
  last_submitted_at timestamptz,
  CONSTRAINT sitemap_resubmit_singleton CHECK (id = 1)
);

INSERT INTO public.sitemap_resubmit_state (id, needs_resubmit)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.sitemap_resubmit_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage sitemap state" ON public.sitemap_resubmit_state;
CREATE POLICY "Admins manage sitemap state"
  ON public.sitemap_resubmit_state
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.mark_sitemap_dirty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sitemap_resubmit_state (id, needs_resubmit, last_marked_at)
    VALUES (1, true, now())
    ON CONFLICT (id) DO UPDATE SET needs_resubmit = true, last_marked_at = now();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_sitemap_dirty_brands ON public.brands;
CREATE TRIGGER trg_mark_sitemap_dirty_brands
  AFTER INSERT OR UPDATE OR DELETE ON public.brands
  FOR EACH STATEMENT EXECUTE FUNCTION public.mark_sitemap_dirty();

DROP TRIGGER IF EXISTS trg_mark_sitemap_dirty_models ON public.models;
CREATE TRIGGER trg_mark_sitemap_dirty_models
  AFTER INSERT OR UPDATE OR DELETE ON public.models
  FOR EACH STATEMENT EXECUTE FUNCTION public.mark_sitemap_dirty();

DROP TRIGGER IF EXISTS trg_mark_sitemap_dirty_parameter_sets ON public.parameter_sets;
CREATE TRIGGER trg_mark_sitemap_dirty_parameter_sets
  AFTER INSERT OR UPDATE OR DELETE ON public.parameter_sets
  FOR EACH STATEMENT EXECUTE FUNCTION public.mark_sitemap_dirty();