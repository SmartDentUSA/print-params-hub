ALTER TABLE public.kol_contestations
  ADD COLUMN IF NOT EXISTS decision text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_by uuid,
  ADD COLUMN IF NOT EXISTS due_at timestamptz;
UPDATE public.kol_contestations SET due_at = created_at + interval '30 days' WHERE due_at IS NULL;
ALTER TABLE public.kol_contestations ALTER COLUMN due_at SET DEFAULT (now() + interval '30 days');

DROP POLICY IF EXISTS "Admins read KOL contestations" ON public.kol_contestations;
DROP POLICY IF EXISTS "Admins answer KOL contestations" ON public.kol_contestations;
CREATE POLICY "Staff read KOL contestations" ON public.kol_contestations FOR SELECT TO authenticated USING (public.fn_is_internal_staff(auth.uid()));

CREATE OR REPLACE VIEW public.v_kol_contracts_reportable WITH (security_invoker = true) AS
  SELECT c.* FROM public.kol_contracts c
  JOIN public.lia_attendances l ON l.id = c.lead_id
  WHERE coalesce(c.is_test,false) = false AND coalesce(l.is_test,false) = false AND l.merged_into IS NULL;
CREATE OR REPLACE VIEW public.v_kol_leads_reportable WITH (security_invoker = true) AS
  SELECT l.id, l.nome, l.prof_display_name, l.prof_kol_commissions, l.prof_kol_form_ids, l.prof_kol_coupons
  FROM public.lia_attendances l
  WHERE l.is_kol = true AND coalesce(l.is_test,false) = false AND l.merged_into IS NULL;
GRANT SELECT ON public.v_kol_contracts_reportable, public.v_kol_leads_reportable TO authenticated, service_role;