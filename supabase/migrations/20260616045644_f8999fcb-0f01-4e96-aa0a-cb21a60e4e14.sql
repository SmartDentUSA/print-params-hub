-- DISTRIBUTORS: allow anonymous read of active rows (same pattern as resins/knowledge_contents)
DROP POLICY IF EXISTS "Authenticated can read distributors" ON public.distributors;
DROP POLICY IF EXISTS "Public can read active distributors" ON public.distributors;

CREATE POLICY "Public can read active distributors"
  ON public.distributors
  FOR SELECT
  TO public
  USING (active = true);

GRANT SELECT ON public.distributors TO anon;
GRANT SELECT ON public.distributors TO authenticated;

-- SMARTOPS_EVENTS: policy já existe para public; só garantir GRANT ao anon
GRANT SELECT ON public.smartops_events TO anon;
GRANT SELECT ON public.smartops_events TO authenticated;