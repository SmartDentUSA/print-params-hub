-- ============================================================
-- TAREFA 1 — colunas novas em classified_listings
-- ============================================================
ALTER TABLE public.classified_listings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wa_click_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderated_by uuid,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS auto_approval_revoked boolean NOT NULL DEFAULT false;

-- 1b) índices
CREATE UNIQUE INDEX IF NOT EXISTS classified_listings_slug_key
  ON public.classified_listings (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_classified_listings_status_type_pub
  ON public.classified_listings (status, type, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_classified_listings_category
  ON public.classified_listings (category);
CREATE INDEX IF NOT EXISTS idx_classified_listings_state
  ON public.classified_listings (location_state);
CREATE INDEX IF NOT EXISTS idx_classified_listings_price
  ON public.classified_listings (price);
CREATE INDEX IF NOT EXISTS idx_classified_listings_user
  ON public.classified_listings (user_id);
CREATE INDEX IF NOT EXISTS idx_classified_listings_lead
  ON public.classified_listings (lead_id);

-- 1c) trigger updated_at
DROP TRIGGER IF EXISTS trg_classified_listings_updated_at ON public.classified_listings;
CREATE TRIGGER trg_classified_listings_updated_at
  BEFORE UPDATE ON public.classified_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 1d) denúncias
-- ============================================================
CREATE TABLE IF NOT EXISTS public.classified_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.classified_listings(id) ON DELETE CASCADE,
  reporter_user_id uuid,
  reason text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
CREATE INDEX IF NOT EXISTS idx_classified_reports_listing
  ON public.classified_reports (listing_id) WHERE resolved_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classified_reports TO authenticated;
GRANT ALL ON public.classified_reports TO service_role;
ALTER TABLE public.classified_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access reports" ON public.classified_reports
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Users can report listings" ON public.classified_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_user_id = auth.uid());

-- ocultação automática acima de 3 denúncias abertas
CREATE OR REPLACE FUNCTION public.fn_classified_autohide_on_reports()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_open int;
BEGIN
  SELECT count(*) INTO v_open FROM public.classified_reports
   WHERE listing_id = NEW.listing_id AND resolved_at IS NULL;
  IF v_open > 3 THEN
    UPDATE public.classified_listings
       SET status = 'pending',
           moderation_reason = coalesce(moderation_reason, 'Oculto automaticamente: ' || v_open || ' denúncias abertas')
     WHERE id = NEW.listing_id AND status = 'active';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_classified_autohide ON public.classified_reports;
CREATE TRIGGER trg_classified_autohide
  AFTER INSERT ON public.classified_reports
  FOR EACH ROW EXECUTE FUNCTION public.fn_classified_autohide_on_reports();

-- ============================================================
-- 1e) buscas salvas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.classified_saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.lia_attendances(id) ON DELETE SET NULL,
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  notify_whatsapp boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_notified_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_classified_saved_searches_user
  ON public.classified_saved_searches (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classified_saved_searches TO authenticated;
GRANT ALL ON public.classified_saved_searches TO service_role;
ALTER TABLE public.classified_saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access saved searches" ON public.classified_saved_searches
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Users manage own saved searches" ON public.classified_saved_searches
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- TAREFA 2 — regra única de cliente
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_is_cliente(p_lead uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_lead IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.deals d
     WHERE d.lead_id = p_lead
       AND coalesce(d.is_deleted, false) = false
       AND d.pipeline_id = 83896
       AND ( d.status = 'ganha'
             OR jsonb_array_length(coalesce(d.proposals, '[]'::jsonb)) > 0 )
  );
$$;
GRANT EXECUTE ON FUNCTION public.fn_is_cliente(uuid) TO anon, authenticated, service_role;

-- ============================================================
-- TAREFA 4 — vitrine pública (sem colunas sensíveis) + policies
-- ============================================================
DROP VIEW IF EXISTS public.v_classifieds_public;
CREATE VIEW public.v_classifieds_public
WITH (security_invoker = false) AS
SELECT
  cl.id,
  cl.slug,
  cl.title,
  cl.description,
  cl.price,
  cl.condition,
  cl.category,
  cl.location_city,
  cl.location_state,
  cl.images,
  cl.published_at,
  cl.view_count,
  coalesce(nullif(trim(la.nome), ''), 'Anunciante Smart Dent') AS seller_name,
  public.fn_is_cliente(cl.lead_id) AS is_cliente
FROM public.classified_listings cl
LEFT JOIN public.lia_attendances la ON la.id = cl.lead_id
WHERE cl.status = 'active'
  AND cl.type = 'equipment';

GRANT SELECT ON public.v_classifieds_public TO anon, authenticated;

-- privilégios de coluna: usuário nunca escreve campos de servidor
REVOKE ALL ON public.classified_listings FROM anon, authenticated;
GRANT ALL ON public.classified_listings TO service_role;
GRANT SELECT ON public.classified_listings TO authenticated;
GRANT INSERT (lead_id, user_id, type, title, description, price, condition, category,
              location_city, location_state, country_code, images, contact_whatsapp)
  ON public.classified_listings TO authenticated;
GRANT UPDATE (title, description, price, condition, category, location_city,
              location_state, images, contact_whatsapp, status, sold_at)
  ON public.classified_listings TO authenticated;

-- policies (mantém "Admins full access" intacta)
DROP POLICY IF EXISTS "Owners can read own listings" ON public.classified_listings;
CREATE POLICY "Owners can read own listings" ON public.classified_listings
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can insert own listings" ON public.classified_listings;
CREATE POLICY "Owners can insert own listings" ON public.classified_listings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can update own listings" ON public.classified_listings;
CREATE POLICY "Owners can update own listings" ON public.classified_listings
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- guarda no banco: dono não muda status para 'active' nem toca campos de servidor
CREATE OR REPLACE FUNCTION public.fn_classified_guard_owner_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role'
     OR is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- dono só pode mover status entre 'sold' e 'paused-like' seguros
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('sold', 'removed') THEN
    RAISE EXCEPTION 'Alteração de status não permitida (%)', NEW.status;
  END IF;

  NEW.plan := OLD.plan;
  NEW.stripe_payment_id := OLD.stripe_payment_id;
  NEW.published_at := OLD.published_at;
  NEW.expires_at := OLD.expires_at;
  NEW.wa_dispatched_at := OLD.wa_dispatched_at;
  NEW.wa_groups_reached := OLD.wa_groups_reached;
  NEW.auto_approved := OLD.auto_approved;
  NEW.auto_approval_revoked := OLD.auto_approval_revoked;
  NEW.moderation_reason := OLD.moderation_reason;
  NEW.moderated_by := OLD.moderated_by;
  NEW.moderated_at := OLD.moderated_at;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.view_count := OLD.view_count;
  NEW.wa_click_count := OLD.wa_click_count;
  NEW.lead_id := OLD.lead_id;
  NEW.user_id := OLD.user_id;
  NEW.academy_bonus_granted := OLD.academy_bonus_granted;
  IF NEW.status = 'sold' AND NEW.sold_at IS NULL THEN
    NEW.sold_at := now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_classified_guard_owner_update ON public.classified_listings;
CREATE TRIGGER trg_classified_guard_owner_update
  BEFORE UPDATE ON public.classified_listings
  FOR EACH ROW EXECUTE FUNCTION public.fn_classified_guard_owner_update();

-- insert do dono sempre nasce pendente; promoção é só via service role
CREATE OR REPLACE FUNCTION public.fn_classified_guard_owner_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  NEW.status := 'pending';
  NEW.plan := 'free';
  NEW.published_at := NULL;
  NEW.expires_at := NULL;
  NEW.auto_approved := false;
  NEW.view_count := 0;
  NEW.wa_click_count := 0;
  NEW.wa_groups_reached := 0;
  NEW.stripe_payment_id := NULL;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_classified_guard_owner_insert ON public.classified_listings;
CREATE TRIGGER trg_classified_guard_owner_insert
  BEFORE INSERT ON public.classified_listings
  FOR EACH ROW EXECUTE FUNCTION public.fn_classified_guard_owner_insert();

-- ============================================================
-- TAREFA 5 — RPCs de contador (não devolvem dados)
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_listing_view(p_listing uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.classified_listings
     SET view_count = view_count + 1
   WHERE id = p_listing AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.increment_wa_click(p_listing uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.classified_listings
     SET wa_click_count = wa_click_count + 1
   WHERE id = p_listing AND status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.increment_listing_view(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_wa_click(uuid) TO anon, authenticated, service_role;