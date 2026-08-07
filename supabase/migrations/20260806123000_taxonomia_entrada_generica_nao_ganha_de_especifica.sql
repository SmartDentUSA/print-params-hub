-- Com o desempate por padrão mais específico, as entradas guarda-chuva de
-- categoria ainda podiam vencer uma entrada de produto quando o padrão genérico
-- era mais comprido: "Resina 3D Smart Print Bio Vitality" casava 'resina 3d' (9)
-- da entrada "Resinas 3D" e perdia 'vitality' (8) de "Resina Vitality".
-- Agora as entradas de categoria são marcadas e só valem como fallback.
ALTER TABLE public.product_taxonomy
  ADD COLUMN IF NOT EXISTS is_generic boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.product_taxonomy.is_generic IS
  'Entrada guarda-chuva de categoria: só é usada quando nenhuma entrada de produto casa.';

UPDATE public.product_taxonomy
SET is_generic = true
WHERE product_key IN (
  'resinas_3d','impressora_3d_generica','pos_generica',
  'acess_imp','acess_scanner','acess_fres',
  'pecas_e1','pecas_e2','pecas_e3','pecas_e7',
  'fres_insumos'
);

CREATE OR REPLACE FUNCTION public.painel_match_taxonomy(p_nome text)
 RETURNS TABLE(workflow_stage text, subcategory text, display_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.workflow_stage, t.subcategory, t.display_name
  FROM public.product_taxonomy t
  CROSS JOIN LATERAL (
    SELECT max(length(pat)) AS especificidade
    FROM unnest(t.match_patterns) pat
    WHERE p_nome ILIKE '%' || pat || '%'
  ) m
  WHERE p_nome IS NOT NULL AND m.especificidade IS NOT NULL
  ORDER BY t.is_generic ASC, m.especificidade DESC, length(coalesce(t.display_name,'')) DESC
  LIMIT 1
$function$;
