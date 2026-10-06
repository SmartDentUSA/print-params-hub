CREATE OR REPLACE FUNCTION public.fn_email_audience_options()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '20s' AS $$
  SELECT jsonb_build_object(
    'columns', (SELECT jsonb_agg(jsonb_build_object('name', column_name, 'type', data_type) ORDER BY column_name) FROM information_schema.columns WHERE table_schema='public' AND table_name='lia_attendances'),
    'pipelines', (SELECT jsonb_agg(DISTINCT jsonb_build_object('pipeline', pipeline_name, 'stage', stage_name)) FROM (SELECT DISTINCT pipeline_name, stage_name FROM deals WHERE pipeline_name IS NOT NULL AND stage_name IS NOT NULL AND coalesce(is_deleted,false)=false LIMIT 400) p),
    'origins', (SELECT jsonb_agg(o) FROM (SELECT origem_primeiro_contato o FROM lia_attendances WHERE merged_into IS NULL AND origem_primeiro_contato IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 150) x),
    'forms', (SELECT jsonb_agg(f) FROM (SELECT form_name f FROM lia_attendances WHERE merged_into IS NULL AND form_name IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 300) y),
    'campaigns', (SELECT jsonb_agg(c) FROM (SELECT utm_campaign c FROM lia_attendances WHERE merged_into IS NULL AND utm_campaign IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 200) z)
  )
$$;
REVOKE ALL ON FUNCTION public.fn_email_audience_options() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_email_audience_options() TO authenticated, service_role;