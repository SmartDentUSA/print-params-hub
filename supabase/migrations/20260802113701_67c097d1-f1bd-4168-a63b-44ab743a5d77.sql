INSERT INTO public.product_taxonomy (product_key, display_name, brand, subcategory, workflow_stage, opportunity_type, is_smartdent, is_competitor, base_value_brl, match_patterns)
VALUES
  ('resinas_3d', 'Resinas 3D', 'SmartDent', 'resinas', 'etapa_3_impressao', 'recompra', true, false, 900, ARRAY['resina','resinas','resina 3d','resinas 3d']),
  ('curso_imersao', 'Curso de Imersão', 'SmartDent', 'cursos', 'etapa_6_cursos', 'cross_sell', true, false, 3500, ARRAY['imersao','curso imersao','imersão','treinamento imersao'])
ON CONFLICT (product_key) DO NOTHING;