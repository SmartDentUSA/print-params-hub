UPDATE public.system_a_catalog SET product_subcategory='1.2 Scanner Bancada' WHERE product_subcategory='1.2 SCANNER BANCADA';
UPDATE public.system_a_catalog SET product_subcategory='2.1 Software' WHERE product_subcategory='2.1 SOFTWARE';
UPDATE public.kol_commission_template_items SET subcategory='1.2 Scanner Bancada' WHERE subcategory='1.2 SCANNER BANCADA';
UPDATE public.kol_commission_template_items SET subcategory='2.1 Software' WHERE subcategory='2.1 SOFTWARE';
INSERT INTO public.kol_commission_templates(name,is_default)
SELECT 'Padrão KOL', true WHERE NOT EXISTS (SELECT 1 FROM public.kol_commission_templates WHERE is_default);