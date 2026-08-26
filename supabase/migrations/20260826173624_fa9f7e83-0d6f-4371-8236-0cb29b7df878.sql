ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS prof_kol_form_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prof_kol_coupon text,
  ADD COLUMN IF NOT EXISTS prof_kol_commissions jsonb NOT NULL DEFAULT '[]'::jsonb;