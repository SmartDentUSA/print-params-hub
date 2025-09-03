-- Adicionar constraint única para modelos
ALTER TABLE public.models ADD CONSTRAINT models_brand_id_slug_unique UNIQUE (brand_id, slug);

-- Habilitar realtime para todas as tabelas
ALTER TABLE public.brands REPLICA IDENTITY FULL;
ALTER TABLE public.models REPLICA IDENTITY FULL;
ALTER TABLE public.resins REPLICA IDENTITY FULL;
ALTER TABLE public.parameter_sets REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.brands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.models;
ALTER PUBLICATION supabase_realtime ADD TABLE public.resins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parameter_sets;