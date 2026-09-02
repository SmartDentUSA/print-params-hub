-- 1) Denormaliza dados de exibição do anunciante no próprio anúncio
ALTER TABLE public.classified_listings
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS is_cliente boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.fn_classified_fill_seller()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(TRIM(la.nome), ''), 'Anunciante Smart Dent')
      INTO NEW.seller_name
      FROM public.lia_attendances la
     WHERE la.id = NEW.lead_id;
    NEW.is_cliente := COALESCE(public.fn_is_cliente(NEW.lead_id), false);
  END IF;
  NEW.seller_name := COALESCE(NEW.seller_name, 'Anunciante Smart Dent');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_classified_fill_seller ON public.classified_listings;
CREATE TRIGGER trg_classified_fill_seller
BEFORE INSERT OR UPDATE OF lead_id, status ON public.classified_listings
FOR EACH ROW EXECUTE FUNCTION public.fn_classified_fill_seller();

UPDATE public.classified_listings cl
   SET seller_name = COALESCE(NULLIF(TRIM(la.nome), ''), 'Anunciante Smart Dent'),
       is_cliente  = COALESCE(public.fn_is_cliente(cl.lead_id), false)
  FROM public.lia_attendances la
 WHERE la.id = cl.lead_id;

-- 2) View pública: lê SOMENTE a tabela de anúncios, sem privilégio elevado
DROP VIEW IF EXISTS public.v_classifieds_public;
CREATE VIEW public.v_classifieds_public
WITH (security_invoker = true) AS
SELECT cl.id, cl.slug, cl.title, cl.description, cl.price, cl.condition, cl.category,
       cl.location_city, cl.location_state, cl.images, cl.published_at, cl.view_count,
       COALESCE(cl.seller_name, 'Anunciante Smart Dent') AS seller_name,
       cl.is_cliente
  FROM public.classified_listings cl
 WHERE cl.status = 'active' AND cl.type = 'equipment';

GRANT SELECT ON public.v_classifieds_public TO anon, authenticated;
GRANT SELECT (seller_name, is_cliente) ON public.classified_listings TO anon, authenticated;

-- 3) Anunciante vê os próprios anúncios (com telefone) via função segura
CREATE OR REPLACE FUNCTION public.fn_my_classifieds()
RETURNS TABLE (
  id uuid, slug text, title text, description text, price numeric, condition text,
  category text, location_city text, location_state text, images jsonb, status text,
  moderation_reason text, view_count integer, wa_click_count integer,
  expires_at timestamptz, contact_whatsapp text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cl.id, cl.slug, cl.title, cl.description, cl.price, cl.condition,
         cl.category, cl.location_city, cl.location_state, cl.images, cl.status,
         cl.moderation_reason, cl.view_count, cl.wa_click_count,
         cl.expires_at, cl.contact_whatsapp, cl.created_at
    FROM public.classified_listings cl
   WHERE cl.user_id = auth.uid()
   ORDER BY cl.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.fn_my_classifieds() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_my_classifieds() TO authenticated;