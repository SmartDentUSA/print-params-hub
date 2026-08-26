ALTER TABLE public.lia_attendances ADD COLUMN IF NOT EXISTS prof_kol_coupons jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.lia_attendances
SET prof_kol_coupons = jsonb_build_array(jsonb_build_object('code', upper(trim(prof_kol_coupon)), 'active_from', NULL, 'active_to', NULL))
WHERE prof_kol_coupon IS NOT NULL
  AND trim(prof_kol_coupon) <> ''
  AND (prof_kol_coupons IS NULL OR prof_kol_coupons = '[]'::jsonb);