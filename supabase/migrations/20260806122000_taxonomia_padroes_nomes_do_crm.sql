-- Os nomes de produto do CRM não são os mesmos do Omie, e a taxonomia só conhecia
-- os do Omie. Com o Top Produtos passando a ler o CRM, itens relevantes caíam em
-- "nao_classificado" (que o grid nem exibe). Em 6 meses:
--   "A50 - Ryzen 7 - RTX4050 - 32 GB RAM" -> R$ 492.900,11 (é o notebook; no Omie
--      vem como "NOTE AVELL A50 ...", que casava por 'avell')
--   "MODEL PLUS - 1 KG"                   -> R$  90.861,05 (resina; no Omie vem
--      como "RESINA SMART PRINT MODEL PLUS - 1 Kg", que casava por 'resina')
-- Só estes dois casos são inequívocos e apenas acrescentam padrões a entradas que
-- já existem — não criam produto nem mudam etapa/subcategoria de nada.
--
-- Continuam sem classificação (nomes do CRM que precisam de decisão de negócio):
--   KIT STARTER, KIT CHAIRSIDE, KIT COMPLEMENTAR - MAKE,
--   Ativação DentalCAD Ultimate Lab Bundle - RMS, Ponteira BLZ,
--   Placas De Acetato, Reposição Teflon - Miicraft, líquidos de pigmentação de
--   zircônia, NANO CLEAN - 9GR.
UPDATE public.product_taxonomy
SET match_patterns = array(
      SELECT DISTINCT unnest(match_patterns || ARRAY['a50 - ryzen','rtx4050','a50 ion'])
    )
WHERE display_name = 'Notebook CAD' AND subcategory = 'notebook';

UPDATE public.product_taxonomy
SET match_patterns = array(
      SELECT DISTINCT unnest(match_patterns || ARRAY['model plus','modelo precision','modelo dlp'])
    )
WHERE display_name = 'Resinas 3D' AND subcategory = 'resinas';
