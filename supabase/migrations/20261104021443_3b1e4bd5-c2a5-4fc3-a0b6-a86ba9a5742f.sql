CREATE TABLE public.smartops_form_slug_aliases (slug text PRIMARY KEY, form_id uuid NOT NULL REFERENCES public.smartops_forms(id) ON DELETE CASCADE);
GRANT SELECT ON public.smartops_form_slug_aliases TO anon, authenticated;
GRANT ALL ON public.smartops_form_slug_aliases TO service_role;
ALTER TABLE public.smartops_form_slug_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read aliases of active forms" ON public.smartops_form_slug_aliases FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.smartops_forms f WHERE f.id=form_id AND f.active=true));
CREATE OR REPLACE FUNCTION public.distribution_event_slug(event_name text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT 'distribuicao-' || trim(both '-' from regexp_replace(lower(translate(event_name,'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñºª','AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+','-','g')) $$;
DO $$ DECLARE r record; target text; BEGIN
FOR r IN SELECT f.id,f.slug,e.name,e.start_date FROM public.smartops_forms f JOIN public.smartops_events e ON e.id=f.event_id WHERE f.form_purpose='distribuicao' ORDER BY f.created_at,f.id LOOP
 target:=public.distribution_event_slug(r.name);
 IF EXISTS(SELECT 1 FROM public.smartops_forms WHERE slug=target AND id<>r.id) THEN target:=target||'-'||coalesce(to_char(r.start_date,'YYYY-MM-DD'),left(r.id::text,8)); END IF;
 IF EXISTS(SELECT 1 FROM public.smartops_forms WHERE slug=target AND id<>r.id) THEN target:=target||'-'||left(r.id::text,8); END IF;
 IF target<>r.slug THEN INSERT INTO public.smartops_form_slug_aliases(slug,form_id) VALUES(r.slug,r.id) ON CONFLICT(slug) DO NOTHING; UPDATE public.smartops_forms SET slug=target WHERE id=r.id; END IF;
END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.fn_clone_distribuicao_form_for_event(p_event_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tpl public.smartops_forms; v_ev public.smartops_events; v_new uuid; v_slug text;
BEGIN
 SELECT * INTO v_ev FROM smartops_events WHERE id=p_event_id; IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT id INTO v_new FROM smartops_forms WHERE event_id=p_event_id AND form_purpose='distribuicao' LIMIT 1; IF v_new IS NOT NULL THEN RETURN v_new; END IF;
 SELECT * INTO v_tpl FROM smartops_forms WHERE slug='distribuicao-cadastro'; IF NOT FOUND THEN RETURN NULL; END IF;
 v_slug:=public.distribution_event_slug(v_ev.name);
 IF EXISTS(SELECT 1 FROM smartops_forms WHERE slug=v_slug) THEN v_slug:=v_slug||'-'||coalesce(to_char(v_ev.start_date,'YYYY-MM-DD'),left(p_event_id::text,8)); END IF;
 IF EXISTS(SELECT 1 FROM smartops_forms WHERE slug=v_slug) THEN v_slug:=v_slug||'-'||left(p_event_id::text,8); END IF;
 INSERT INTO smartops_forms(name,slug,title,subtitle,form_purpose,active,display_mode,success_message,forced_seller_team_member_id,event_id,theme_color)
 VALUES('# - Distribuição - Cadastro - '||v_ev.name,v_slug,v_tpl.title,v_tpl.subtitle,'distribuicao',true,v_tpl.display_mode,v_tpl.success_message,v_tpl.forced_seller_team_member_id,p_event_id,v_tpl.theme_color) RETURNING id INTO v_new;
 INSERT INTO smartops_form_fields(form_id,label,field_type,db_column,custom_field_name,options,required,placeholder,order_index,help_text)
 SELECT v_new,label,field_type,db_column,custom_field_name,options,required,placeholder,order_index,help_text FROM smartops_form_fields WHERE form_id=v_tpl.id;
 RETURN v_new;
END $$;
REVOKE ALL ON FUNCTION public.fn_clone_distribuicao_form_for_event(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_clone_distribuicao_form_for_event(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.fn_distribution_event_metrics() RETURNS TABLE(event_id uuid,total_leads bigint,countries jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public SET statement_timeout='8s' AS $$
WITH forms AS (SELECT id,event_id,name FROM smartops_forms WHERE form_purpose='distribuicao' AND event_id IS NOT NULL AND active=true),
activity AS (
 SELECT f.event_id,a.lead_id,a.event_timestamp AS at,
 (SELECT nullif(trim(r->>'value'),'') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.event_data->'responses')='array' THEN a.event_data->'responses' ELSE '[]'::jsonb END) r WHERE lower(trim(r->>'label')) IN ('país','pais','country') LIMIT 1) country
 FROM lead_activity_log a JOIN forms f ON a.event_data->>'form_id'=f.id::text OR a.event_data->>'form_name'=f.name
 JOIN lia_attendances l ON l.id=a.lead_id AND l.merged_into IS NULL WHERE a.event_type='form_submission'
 UNION ALL
 SELECT f.event_id,l.id,l.created_at,nullif(trim(l.empresa_pais),'') FROM lia_attendances l JOIN forms f ON f.name=l.form_name WHERE l.merged_into IS NULL AND coalesce(l.source,'') NOT IN ('loja_integrada','astron_postback')
), people AS (SELECT DISTINCT ON(event_id,lead_id) event_id,lead_id,country FROM activity ORDER BY event_id,lead_id,(country IS NOT NULL) DESC,at ASC),
groups AS (SELECT event_id,CASE WHEN lower(country) IN ('brasil','brazil','br') THEN 'Brasil' ELSE coalesce(country,'Não informado') END country,count(*) qty FROM people GROUP BY 1,2),
totals AS (SELECT event_id,sum(qty)::bigint total,jsonb_agg(jsonb_build_object('country',country,'leads',qty) ORDER BY country) countries FROM groups GROUP BY event_id)
SELECT DISTINCT f.event_id,coalesce(t.total,0),coalesce(t.countries,'[]'::jsonb) FROM forms f LEFT JOIN totals t ON t.event_id=f.event_id;
$$;
REVOKE ALL ON FUNCTION public.fn_distribution_event_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_distribution_event_metrics() TO anon,authenticated,service_role;
DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('public.fn_form_metrics(integer)'::regprocedure);
 definition:=replace(definition, 'UNION SELECT id, ''p:/f/'' || slug FROM f WHERE slug IS NOT NULL', 'UNION SELECT id, ''p:/f/'' || slug FROM f WHERE slug IS NOT NULL UNION SELECT a.form_id, ''p:/f/'' || a.slug FROM public.smartops_form_slug_aliases a');
 EXECUTE definition;
 IF public.distribution_event_slug('ABO US — Brazilian Dental Association')<>'distribuicao-abo-us-brazilian-dental-association' THEN RAISE EXCEPTION 'event slug regression'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.smartops_form_slug_aliases a JOIN public.smartops_forms f ON f.id=a.form_id WHERE a.slug='distribuicao-66dffadc' AND f.slug='distribuicao-abo-us-brazilian-dental-association') THEN RAISE EXCEPTION 'legacy URL regression'; END IF;
END $$;