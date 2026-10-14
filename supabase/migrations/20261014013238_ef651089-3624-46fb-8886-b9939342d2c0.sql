DROP INDEX IF EXISTS public.kol_commission_template_items_key;
ALTER TABLE public.kol_commission_template_items DROP CONSTRAINT IF EXISTS kol_commission_template_items_key;
CREATE UNIQUE INDEX kol_commission_template_items_key ON public.kol_commission_template_items
  (template_id, channel, kind, COALESCE(category,''), COALESCE(subcategory,''), COALESCE(product_id,''));