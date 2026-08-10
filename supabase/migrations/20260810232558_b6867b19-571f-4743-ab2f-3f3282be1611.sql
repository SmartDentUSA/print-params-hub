ALTER TABLE public.social_contacts
  ADD COLUMN IF NOT EXISTS platform_user_id text,
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS zernio_contact_id text;

UPDATE public.social_contacts
SET zernio_contact_id = NULLIF(custom_fields->>'zernio_contact_id',''),
    platform_user_id = COALESCE(
      NULLIF(custom_fields->>'platformIdentifier',''),
      CASE WHEN NULLIF(custom_fields->>'zernio_contact_id','') IS NULL THEN ig_user_id END
    );

UPDATE public.social_contacts
SET platform_user_id = regexp_replace(platform_user_id, '\D', '', 'g')
WHERE channel = 'whatsapp' AND platform_user_id IS NOT NULL;

UPDATE public.social_contacts
SET phone_e164 = '+' || platform_user_id
WHERE channel = 'whatsapp'
  AND platform_user_id IS NOT NULL
  AND length(platform_user_id) BETWEEN 10 AND 15;

WITH dup AS (
  SELECT c.ig_user_id AS canon_id,
         s.custom_fields AS scan_cf, s.lead_id AS scan_lead, c.custom_fields AS canon_cf
  FROM public.social_contacts s
  JOIN public.social_contacts c
    ON c.channel = s.channel
   AND c.platform_user_id = s.platform_user_id
   AND c.zernio_contact_id IS NOT NULL
  WHERE s.zernio_contact_id IS NULL AND s.platform_user_id IS NOT NULL
)
UPDATE public.social_contacts t
SET lead_id = COALESCE(t.lead_id, d.scan_lead),
    custom_fields = COALESCE(d.canon_cf, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'dm_email', d.scan_cf->>'dm_email',
      'dm_phone', d.scan_cf->>'dm_phone',
      'lead_matched_by', d.scan_cf->>'lead_matched_by'
    ))
FROM dup d
WHERE t.ig_user_id = d.canon_id;

-- Consolida o lead vinculado na linha que será mantida
WITH ranked AS (
  SELECT ig_user_id, channel, platform_user_id, lead_id,
         row_number() OVER (
           PARTITION BY channel, platform_user_id
           ORDER BY (lead_id IS NOT NULL) DESC, (zernio_contact_id IS NOT NULL) DESC,
                    last_seen_at DESC NULLS LAST, created_at DESC NULLS LAST
         ) AS rn
  FROM public.social_contacts
  WHERE platform_user_id IS NOT NULL
),
keepers AS (SELECT * FROM ranked WHERE rn = 1),
losers  AS (SELECT * FROM ranked WHERE rn > 1)
UPDATE public.social_contacts t
SET lead_id = l.lead_id
FROM keepers k
JOIN losers l ON l.channel = k.channel AND l.platform_user_id = k.platform_user_id
WHERE t.ig_user_id = k.ig_user_id AND t.lead_id IS NULL AND l.lead_id IS NOT NULL;

DELETE FROM public.social_contacts
WHERE ig_user_id IN (
  SELECT ig_user_id FROM (
    SELECT ig_user_id,
           row_number() OVER (
             PARTITION BY channel, platform_user_id
             ORDER BY (lead_id IS NOT NULL) DESC, (zernio_contact_id IS NOT NULL) DESC,
                      last_seen_at DESC NULLS LAST, created_at DESC NULLS LAST
           ) AS rn
    FROM public.social_contacts
    WHERE platform_user_id IS NOT NULL
  ) r WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS social_contacts_platform_identity_uidx
  ON public.social_contacts (channel, platform_user_id)
  WHERE platform_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS social_contacts_phone_e164_idx
  ON public.social_contacts (phone_e164) WHERE phone_e164 IS NOT NULL;

ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS instagram_user_id text,
  ADD COLUMN IF NOT EXISTS facebook_psid text,
  ADD COLUMN IF NOT EXISTS tiktok_user_id text;

CREATE INDEX IF NOT EXISTS lia_attendances_instagram_user_id_idx
  ON public.lia_attendances (instagram_user_id) WHERE instagram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lia_attendances_facebook_psid_idx
  ON public.lia_attendances (facebook_psid) WHERE facebook_psid IS NOT NULL;
CREATE INDEX IF NOT EXISTS lia_attendances_tiktok_user_id_idx
  ON public.lia_attendances (tiktok_user_id) WHERE tiktok_user_id IS NOT NULL;

UPDATE public.lia_attendances l
SET instagram_user_id = s.platform_user_id
FROM public.social_contacts s
WHERE s.lead_id = l.id AND s.channel = 'instagram'
  AND s.platform_user_id IS NOT NULL AND l.instagram_user_id IS NULL;

UPDATE public.lia_attendances l
SET facebook_psid = s.platform_user_id
FROM public.social_contacts s
WHERE s.lead_id = l.id AND s.channel = 'facebook'
  AND s.platform_user_id IS NOT NULL AND l.facebook_psid IS NULL;

CREATE OR REPLACE FUNCTION public.fn_find_lead_by_social_id(
  _channel text,
  _platform_user_id text
)
RETURNS TABLE (lead_id uuid, nome text, matched_by text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := NULLIF(trim(coalesce(_platform_user_id, '')), '');
  v_digits text;
BEGIN
  IF v_id IS NULL THEN RETURN; END IF;

  IF lower(coalesce(_channel,'')) = 'whatsapp' THEN
    v_digits := right(regexp_replace(v_id, '\D', '', 'g'), 8);
    IF length(v_digits) < 8 THEN RETURN; END IF;
    RETURN QUERY
      SELECT l.id, l.nome, 'whatsapp_phone'::text
      FROM public.lia_attendances l
      WHERE l.merged_into IS NULL
        AND right(regexp_replace(coalesce(l.telefone_normalized, l.telefone, ''), '\D', '', 'g'), 8) = v_digits
      ORDER BY l.updated_at DESC NULLS LAST
      LIMIT 1;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT l.id, l.nome,
           CASE
             WHEN l.instagram_user_id = v_id THEN 'instagram_id'
             WHEN l.facebook_psid = v_id THEN 'facebook_id'
             ELSE 'tiktok_id'
           END::text
    FROM public.lia_attendances l
    WHERE l.merged_into IS NULL
      AND (l.instagram_user_id = v_id OR l.facebook_psid = v_id OR l.tiktok_user_id = v_id)
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_find_lead_by_social_id(text, text) TO authenticated, service_role;