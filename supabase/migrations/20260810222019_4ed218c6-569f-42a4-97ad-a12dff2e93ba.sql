CREATE INDEX IF NOT EXISTS idx_lia_tel_norm_last8 ON public.lia_attendances (right(regexp_replace(coalesce(telefone_normalized,''), '\D', '', 'g'), 8)) WHERE merged_into IS NULL;
CREATE INDEX IF NOT EXISTS idx_lia_tel_raw_last8 ON public.lia_attendances (right(regexp_replace(coalesce(telefone_raw,''), '\D', '', 'g'), 8)) WHERE merged_into IS NULL;
CREATE INDEX IF NOT EXISTS idx_lia_wa_phone_last8 ON public.lia_attendances (right(regexp_replace(coalesce(wa_phone,''), '\D', '', 'g'), 8)) WHERE merged_into IS NULL;

CREATE OR REPLACE FUNCTION public.fn_resolve_wa_inbox_leads(p_keys text[])
RETURNS TABLE (
  conv_key text,
  lead_id uuid,
  nome text,
  telefone text,
  email text,
  matched_by text,
  funil text,
  etapa text,
  vendedor text,
  real_status text,
  is_customer boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH keys AS (
    SELECT DISTINCT k AS conv_key, regexp_replace(k, '\D', '', 'g') AS digits
    FROM unnest(coalesce(p_keys, '{}'::text[])) AS k
    WHERE k IS NOT NULL AND btrim(k) <> ''
  ), k2 AS (
    SELECT conv_key, digits, right(digits, 8) AS l8 FROM keys WHERE length(digits) >= 8
  ), cand AS (
    SELECT k2.conv_key, la.id, 1 AS prio, 'whatsapp_lid'::text AS matched_by
    FROM k2 JOIN lia_attendances la
      ON la.merged_into IS NULL AND la.whatsapp_lid IS NOT NULL
     AND regexp_replace(la.whatsapp_lid, '\D', '', 'g') = k2.digits
    UNION ALL
    SELECT k2.conv_key, la.id, 2, 'telefone'
    FROM k2 JOIN lia_attendances la
      ON la.merged_into IS NULL
     AND right(regexp_replace(coalesce(la.telefone_normalized,''), '\D', '', 'g'), 8) = k2.l8
    UNION ALL
    SELECT k2.conv_key, la.id, 3, 'telefone'
    FROM k2 JOIN lia_attendances la
      ON la.merged_into IS NULL
     AND right(regexp_replace(coalesce(la.telefone_raw,''), '\D', '', 'g'), 8) = k2.l8
    UNION ALL
    SELECT k2.conv_key, la.id, 4, 'telefone_alternativo'
    FROM k2 JOIN lia_attendances la
      ON la.merged_into IS NULL
     AND right(regexp_replace(coalesce(la.wa_phone,''), '\D', '', 'g'), 8) = k2.l8
    UNION ALL
    SELECT k2.conv_key, la.id, 5, 'telefone_alternativo'
    FROM k2 JOIN lia_attendances la
      ON la.merged_into IS NULL
     AND right(regexp_replace(coalesce(la.astron_phone,''), '\D', '', 'g'), 8) = k2.l8
    UNION ALL
    SELECT k2.conv_key, la.id, 6, 'telefone_empresa'
    FROM k2 JOIN lia_attendances la
      ON la.merged_into IS NULL
     AND right(regexp_replace(coalesce(la.empresa_telefone,''), '\D', '', 'g'), 8) = k2.l8
  ), best AS (
    SELECT DISTINCT ON (conv_key) conv_key, id, matched_by
    FROM cand ORDER BY conv_key, prio, id
  )
  SELECT b.conv_key, la.id, la.nome,
         coalesce(la.telefone_normalized, la.telefone_raw), la.email, b.matched_by,
         coalesce(la.piperun_pipeline_name, la.funil_entrada_crm), la.piperun_stage_name,
         la.proprietario_lead_crm, la.real_status,
         coalesce(la.real_status, '') ILIKE 'CLIENTE%'
  FROM best b JOIN lia_attendances la ON la.id = b.id;
$$;

GRANT EXECUTE ON FUNCTION public.fn_resolve_wa_inbox_leads(text[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_backfill_wa_inbox_lead_ids(p_limit integer DEFAULT 5000)
RETURNS TABLE (updated_rows integer, matched_conversations integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keys text[];
  v_updated integer := 0;
  v_convs integer := 0;
BEGIN
  SELECT array_agg(DISTINCT coalesce(phone_normalized, phone)) INTO v_keys
  FROM (
    SELECT phone_normalized, phone FROM whatsapp_inbox
    WHERE lead_id IS NULL AND coalesce(is_group, false) = false
    ORDER BY created_at DESC LIMIT greatest(coalesce(p_limit, 5000), 1)
  ) s;

  IF v_keys IS NULL THEN
    RETURN QUERY SELECT 0, 0; RETURN;
  END IF;

  CREATE TEMP TABLE _wa_match ON COMMIT DROP AS
    SELECT conv_key, lead_id FROM fn_resolve_wa_inbox_leads(v_keys);

  SELECT count(*)::int INTO v_convs FROM _wa_match;

  WITH upd AS (
    UPDATE whatsapp_inbox wi SET lead_id = m.lead_id
      FROM _wa_match m
     WHERE wi.lead_id IS NULL AND coalesce(wi.is_group, false) = false
       AND coalesce(wi.phone_normalized, wi.phone) = m.conv_key
    RETURNING 1
  )
  SELECT count(*)::int INTO v_updated FROM upd;

  RETURN QUERY SELECT v_updated, v_convs;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_backfill_wa_inbox_lead_ids(integer) TO authenticated, service_role;