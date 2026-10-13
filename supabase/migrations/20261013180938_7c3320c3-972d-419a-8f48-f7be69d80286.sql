-- 1) Uma única fn_normalize_phone: a versão de gatilho vira fn_trg_lia_normalize_telefone
CREATE OR REPLACE FUNCTION public.fn_trg_lia_normalize_telefone()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.telefone_normalized IS NOT NULL AND NEW.telefone_normalized NOT LIKE '+%' THEN
    NEW.telefone_normalized := '+' || regexp_replace(NEW.telefone_normalized, '\D', '', 'g');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trig_normalize_phone ON public.lia_attendances;
CREATE TRIGGER trig_normalize_phone BEFORE INSERT OR UPDATE ON public.lia_attendances
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_lia_normalize_telefone();
DROP FUNCTION public.fn_normalize_phone();

-- 2) Marcador oficial de KOL (mesma regra da ficha: cupom com código, formulário ou regra de comissão)
CREATE OR REPLACE FUNCTION public.fn_lead_is_kol(_forms jsonb, _rules jsonb, _coupons jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  select coalesce(jsonb_typeof(_forms)='array' and jsonb_array_length(_forms) > 0, false)
      or coalesce(jsonb_typeof(_rules)='array' and jsonb_array_length(_rules) > 0, false)
      or coalesce(jsonb_typeof(_coupons)='array' and exists (
           select 1 from jsonb_array_elements(_coupons) c where coalesce(trim(c->>'code'),'') <> ''), false)
$$;

-- 3) Slug público por palestrante e trava OTP pronta para a Fase 1
ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS prof_public_slug text,
  ADD COLUMN IF NOT EXISTS prof_otp_required boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lia_prof_public_slug ON public.lia_attendances(prof_public_slug) WHERE prof_public_slug IS NOT NULL;
UPDATE public.lia_attendances SET prof_public_slug = substr(md5(gen_random_uuid()::text), 1, 12)
 WHERE merged_into IS NULL AND prof_public_slug IS NULL
   AND (prof_photo_url IS NOT NULL OR nullif(trim(prof_cro),'') IS NOT NULL);

-- 4) Tentativas de acesso pelo celular (rate limit da agenda)
CREATE TABLE IF NOT EXISTS public.kol_portal_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid,
  ip_hash text,
  success boolean NOT NULL DEFAULT false,
  blocked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.kol_portal_attempts TO service_role;
ALTER TABLE public.kol_portal_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kol_attempts_pid ON public.kol_portal_attempts(professional_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kol_attempts_ip ON public.kol_portal_attempts(ip_hash, created_at DESC);

-- 5) Pendências de celular passam a usar o marcador oficial is_kol
DROP FUNCTION IF EXISTS public.fn_kol_phone_pending();
CREATE FUNCTION public.fn_kol_phone_pending()
 RETURNS TABLE(lead_id uuid, nome text, prof_cro text, prof_wa_ddi text, prof_wa_number text, wa_phone text, telefone_normalized text, phone_key text, problema text, duplicado_com text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  with p as (
    select a.id, a.nome, a.prof_cro, a.prof_wa_ddi, a.prof_wa_number, a.wa_phone, a.telefone_normalized,
      public.fn_kol_lead_phone(a.prof_wa_ddi, a.prof_wa_number, a.wa_phone, a.telefone_normalized) k
    from public.lia_attendances a
    where a.merged_into is null
      and public.fn_lead_is_kol(a.prof_kol_form_ids, a.prof_kol_commissions, a.prof_kol_coupons)
  )
  select p.id, p.nome, p.prof_cro, p.prof_wa_ddi, p.prof_wa_number, p.wa_phone, p.telefone_normalized, p.k,
    case when p.k is null then 'sem_celular' else 'duplicado' end,
    (select string_agg(o.nome, ', ') from p o where o.k = p.k and o.id <> p.id)
  from p
  where public.fn_is_internal_staff(auth.uid())
    and (p.k is null or exists (select 1 from p o where o.k = p.k and o.id <> p.id))
  order by 9, 2
$function$;
GRANT EXECUTE ON FUNCTION public.fn_kol_phone_pending() TO authenticated;