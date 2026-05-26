UPDATE public.lia_attendances SET ultima_etapa_comercial = 'c1' WHERE ultima_etapa_comercial = 'contato_feito';
UPDATE public.lia_attendances SET ultima_etapa_comercial = 'sdr_nutricao' WHERE ultima_etapa_comercial = 'em_contato';
UPDATE public.deals SET stage_name = 'C1' WHERE stage_id = 99294 AND stage_name IN ('Contato Feito','Contato feito');
UPDATE public.deals SET stage_name = 'SDR / Nutrição' WHERE stage_id = 379942 AND stage_name IN ('Em Contato','Em contato');