-- Marcador is_kol e chave de celular mantidos por gatilho (índice não aceita função sobre jsonb variável)
ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS is_kol boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kol_phone_key text;

CREATE OR REPLACE FUNCTION public.fn_trg_lia_kol_flags()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.is_kol := public.fn_lead_is_kol(NEW.prof_kol_form_ids, NEW.prof_kol_commissions, NEW.prof_kol_coupons);
  NEW.kol_phone_key := CASE WHEN NEW.is_kol
    THEN public.fn_kol_lead_phone(NEW.prof_wa_ddi, NEW.prof_wa_number, NEW.wa_phone, NEW.telefone_normalized) END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_lia_kol_flags ON public.lia_attendances;
CREATE TRIGGER trg_lia_kol_flags BEFORE INSERT OR UPDATE OF prof_kol_form_ids, prof_kol_commissions, prof_kol_coupons,
  prof_wa_ddi, prof_wa_number, wa_phone, telefone_normalized ON public.lia_attendances
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_lia_kol_flags();

UPDATE public.lia_attendances SET prof_kol_coupons = prof_kol_coupons
 WHERE public.fn_lead_is_kol(prof_kol_form_ids, prof_kol_commissions, prof_kol_coupons);

-- Trava: celular único entre KOLs ativos
CREATE UNIQUE INDEX IF NOT EXISTS uq_lia_kol_phone_key ON public.lia_attendances(kol_phone_key)
  WHERE is_kol AND merged_into IS NULL AND kol_phone_key IS NOT NULL;

-- Sessões do portal do KOL (OTP por WhatsApp obrigatório por padrão)
CREATE TABLE IF NOT EXISTS public.kol_access_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  phone_key text NOT NULL,
  otp_required boolean NOT NULL DEFAULT true,
  otp_hash text,
  otp_expires_at timestamptz,
  otp_attempts integer NOT NULL DEFAULT 0,
  verified_at timestamptz,
  token_hash text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.kol_access_sessions TO service_role;
ALTER TABLE public.kol_access_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Somente servidor" ON public.kol_access_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_kol_sessions_lead ON public.kol_access_sessions(lead_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kol_sessions_token ON public.kol_access_sessions(token_hash) WHERE token_hash IS NOT NULL;
CREATE TRIGGER trg_kol_sessions_updated BEFORE UPDATE ON public.kol_access_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Desbloquear acesso (equipe)
CREATE OR REPLACE FUNCTION public.fn_kol_unblock(_lead_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.fn_is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.kol_portal_attempts WHERE professional_id = _lead_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.kol_access_sessions SET otp_attempts = 0 WHERE lead_id = _lead_id AND verified_at IS NULL;
  PERFORM public.fn_kol_log(_lead_id, 'kol_portal_login_unblocked', 'kol_portal', NULL, NULL,
    jsonb_build_object('descricao','Acesso ao portal/agenda desbloqueado pela equipe','tentativas_removidas', n,
      'dedupe_key','kol_unblock:'||_lead_id||':'||extract(epoch from clock_timestamp())::text), NULL, 'kol');
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_kol_unblock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_kol_unblock(uuid) TO authenticated;

-- Pré-condição do primeiro contrato: celular válido e único
CREATE OR REPLACE FUNCTION public.fn_kol_contract_ready(_lead_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; dup text;
BEGIN
  IF NOT public.fn_is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT public.fn_kol_lead_phone(prof_wa_ddi, prof_wa_number, wa_phone, telefone_normalized) INTO k
    FROM public.lia_attendances WHERE id = _lead_id AND merged_into IS NULL;
  IF k IS NULL THEN RETURN jsonb_build_object('ok', false, 'motivo', 'Profissional sem celular válido (DDD + número).'); END IF;
  SELECT string_agg(nome, ', ') INTO dup FROM public.lia_attendances a
   WHERE a.merged_into IS NULL AND a.id <> _lead_id
     AND (a.is_kol OR nullif(trim(a.prof_cro),'') IS NOT NULL OR a.prof_photo_url IS NOT NULL)
     AND public.fn_kol_lead_phone(a.prof_wa_ddi, a.prof_wa_number, a.wa_phone, a.telefone_normalized) = k;
  IF dup IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'motivo', 'Celular igual ao de: '||dup); END IF;
  RETURN jsonb_build_object('ok', true, 'phone_key', k);
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_kol_contract_ready(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_kol_contract_ready(uuid) TO authenticated;