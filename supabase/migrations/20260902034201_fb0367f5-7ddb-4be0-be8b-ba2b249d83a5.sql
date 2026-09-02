-- 1) View pública passa a ser security_invoker (deixa de ser SECURITY DEFINER view)
ALTER VIEW public.v_classifieds_public SET (security_invoker = true);

-- 2) Permissões de coluna: anon lê APENAS campos não sensíveis da tabela base.
--    contact_whatsapp, user_id, lead_id e campos de moderação ficam fora.
GRANT SELECT (
  id, slug, title, description, price, condition, category,
  location_city, location_state, country_code, images,
  published_at, view_count, type, status, sold_at, expires_at
) ON public.classified_listings TO anon;

GRANT SELECT (
  id, slug, title, description, price, condition, category,
  location_city, location_state, country_code, images,
  published_at, view_count, type, status, sold_at, expires_at
) ON public.classified_listings TO authenticated;

-- 3) Política de leitura pública restrita a anúncios de equipamento no ar
DROP POLICY IF EXISTS "classifieds_public_read_active" ON public.classified_listings;
CREATE POLICY "classifieds_public_read_active"
ON public.classified_listings
FOR SELECT
TO anon, authenticated
USING (
  type = 'equipment'
  AND status = 'active'
  AND (expires_at IS NULL OR expires_at > now())
);