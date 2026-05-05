
-- ============================================================
-- 1. agent_sessions: remove public ALL policy
-- ============================================================
DROP POLICY IF EXISTS "Allow public manage sessions" ON public.agent_sessions;

CREATE POLICY "Service role manages sessions"
  ON public.agent_sessions FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- ============================================================
-- 2. campaign_send_log: drop public read
-- ============================================================
DROP POLICY IF EXISTS "public_read_csl" ON public.campaign_send_log;

CREATE POLICY "Admins read campaign send log"
  ON public.campaign_send_log FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));

-- ============================================================
-- 3. deal_items: lock down to service role
-- ============================================================
DROP POLICY IF EXISTS "deal_items_service_only" ON public.deal_items;

CREATE POLICY "deal_items_service_only"
  ON public.deal_items FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins read deal items"
  ON public.deal_items FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));

-- ============================================================
-- 4. companies: lock down to service role
-- ============================================================
DROP POLICY IF EXISTS "companies_service" ON public.companies;

CREATE POLICY "companies_service"
  ON public.companies FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins read companies"
  ON public.companies FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));

-- ============================================================
-- 5. people: lock down to service role
-- ============================================================
DROP POLICY IF EXISTS "people_service" ON public.people;

CREATE POLICY "people_service"
  ON public.people FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins read people"
  ON public.people FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));

-- ============================================================
-- 6. person_company_relationship: lock down to service role
-- ============================================================
DROP POLICY IF EXISTS "pcr_service" ON public.person_company_relationship;

CREATE POLICY "pcr_service"
  ON public.person_company_relationship FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins read pcr"
  ON public.person_company_relationship FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));

-- ============================================================
-- 7. upsell_predictions: lock down to service role
-- ============================================================
DROP POLICY IF EXISTS "upsell_service_only" ON public.upsell_predictions;

CREATE POLICY "upsell_service_only"
  ON public.upsell_predictions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins read upsell"
  ON public.upsell_predictions FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));

-- ============================================================
-- 8. omie_notas_servico: drop anon read
-- ============================================================
DROP POLICY IF EXISTS "anon_read" ON public.omie_notas_servico;
DROP POLICY IF EXISTS "authenticated_read" ON public.omie_notas_servico;

CREATE POLICY "Admins read omie notas"
  ON public.omie_notas_servico FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));

-- ============================================================
-- 9. omie_snapshot_mensal: drop anon read
-- ============================================================
DROP POLICY IF EXISTS "anon_read_snapshot" ON public.omie_snapshot_mensal;
DROP POLICY IF EXISTS "authenticated_read" ON public.omie_snapshot_mensal;

CREATE POLICY "Admins read omie snapshot"
  ON public.omie_snapshot_mensal FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));

-- ============================================================
-- 10. dh_leads_staging: enable RLS
-- ============================================================
ALTER TABLE public.dh_leads_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dh_leads_staging_service"
  ON public.dh_leads_staging FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins read dh_leads_staging"
  ON public.dh_leads_staging FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));

-- ============================================================
-- 11. campaign_sessions: enable RLS
-- ============================================================
ALTER TABLE public.campaign_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_sessions_service"
  ON public.campaign_sessions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins read campaign_sessions"
  ON public.campaign_sessions FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));

-- ============================================================
-- 12. involve_me_sync_control: enable RLS
-- ============================================================
ALTER TABLE public.involve_me_sync_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "involve_me_sync_service"
  ON public.involve_me_sync_control FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins read involve_me_sync"
  ON public.involve_me_sync_control FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));

-- ============================================================
-- 13. Storage: knowledge-images bucket — restrict writes to admins
-- ============================================================
DROP POLICY IF EXISTS "Upload Autenticado de Imagens" ON storage.objects;
DROP POLICY IF EXISTS "Gerenciamento de Imagens" ON storage.objects;
DROP POLICY IF EXISTS "Deletar Imagens" ON storage.objects;

CREATE POLICY "Admins upload knowledge images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'knowledge-images' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins update knowledge images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'knowledge-images' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins delete knowledge images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'knowledge-images' AND public.is_admin(auth.uid()));
