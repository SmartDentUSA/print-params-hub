ALTER TABLE public.smartops_forms DROP CONSTRAINT smartops_forms_form_purpose_check;
ALTER TABLE public.smartops_forms ADD CONSTRAINT smartops_forms_form_purpose_check CHECK (form_purpose = ANY (ARRAY['nps','sdr','roi','cs','captacao','evento','sdr_captacao','cm_update_deal','cs_update_deals','st_update_deals','feira_evento','credenciamento','distribuicao','insercao_crm','kol_expansao']::text[]));

CREATE OR REPLACE FUNCTION public.fn_event_form_slug(p_suffix text, p_event_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE v_ev public.smartops_events; v_base text; v_slug text;
BEGIN
  SELECT * INTO v_ev FROM smartops_events WHERE id = p_event_id;
  v_base := substr(public.distribution_event_slug(coalesce(v_ev.name, 'evento')), length('distribuicao-') + 1);
  v_slug := left(v_base, 70) || '-' || p_suffix;
  IF EXISTS (SELECT 1 FROM smartops_forms WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || coalesce(to_char(v_ev.start_date, 'YYYY'), left(p_event_id::text, 8));
  END IF;
  IF EXISTS (SELECT 1 FROM smartops_forms WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || left(p_event_id::text, 8);
  END IF;
  RETURN v_slug;
END $$;

-- Copies every field of a template form into a new form, giving each question a new ID
-- and remapping conditions.show_if.rules[].field_id to the copies.
CREATE OR REPLACE FUNCTION public.fn_copy_form_fields_remapped(p_from uuid, p_to uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; v_map jsonb := '{}'::jsonb; v_new uuid; k text;
BEGIN
  FOR r IN SELECT * FROM smartops_form_fields WHERE form_id = p_from ORDER BY order_index LOOP
    v_new := gen_random_uuid();
    v_map := v_map || jsonb_build_object(r.id::text, v_new::text);
    INSERT INTO smartops_form_fields(id, form_id, label, field_type, db_column, custom_field_name, options, required, placeholder, order_index, roi_config, workflow_cell_target, conditions, show_when_especialidade, help_text)
    VALUES (v_new, p_to, r.label, r.field_type, r.db_column, r.custom_field_name, r.options, r.required, r.placeholder, r.order_index, r.roi_config, r.workflow_cell_target, r.conditions, r.show_when_especialidade, r.help_text);
  END LOOP;
  FOR k IN SELECT jsonb_object_keys(v_map) LOOP
    UPDATE smartops_form_fields SET conditions = replace(conditions::text, k, v_map->>k)::jsonb
    WHERE form_id = p_to AND conditions IS NOT NULL AND conditions::text LIKE '%' || k || '%';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_clone_lead_form_for_event(p_event_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tpl public.smartops_forms; v_ev public.smartops_events; v_new uuid;
BEGIN
  SELECT * INTO v_ev FROM smartops_events WHERE id = p_event_id; IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT id INTO v_new FROM smartops_forms WHERE event_id = p_event_id AND form_purpose = 'feira_evento' LIMIT 1;
  IF v_new IS NOT NULL THEN RETURN v_new; END IF;
  SELECT * INTO v_tpl FROM smartops_forms WHERE slug = 'cipro-cadastro-de-leads'; IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO smartops_forms(name, slug, title, subtitle, form_purpose, active, display_mode, success_message, event_id, theme_color, theme_mode,
    event_categories, event_consultant_ids, tracking_ga4_id, tracking_gtm_id, tracking_meta_pixel_id, tracking_tiktok_pixel_id,
    brand_color_h, brand_color_s, brand_color_l, bg_type, bg_color, bg_color_to, layout_variant, show_progress, font_body, font_heading)
  VALUES ('# - [' || v_ev.name || '] - Cadastro de leads', public.fn_event_form_slug('cadastro-de-leads', p_event_id), v_tpl.title, v_tpl.subtitle,
    'feira_evento', true, v_tpl.display_mode, v_tpl.success_message, p_event_id, v_tpl.theme_color, v_tpl.theme_mode,
    v_tpl.event_categories, v_tpl.event_consultant_ids, v_tpl.tracking_ga4_id, v_tpl.tracking_gtm_id, v_tpl.tracking_meta_pixel_id, v_tpl.tracking_tiktok_pixel_id,
    v_tpl.brand_color_h, v_tpl.brand_color_s, v_tpl.brand_color_l, v_tpl.bg_type, v_tpl.bg_color, v_tpl.bg_color_to, v_tpl.layout_variant, v_tpl.show_progress, v_tpl.font_body, v_tpl.font_heading)
  RETURNING id INTO v_new;
  PERFORM public.fn_copy_form_fields_remapped(v_tpl.id, v_new);
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.fn_clone_kol_expansao_form_for_event(p_event_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tpl public.smartops_forms; v_ev public.smartops_events; v_new uuid;
BEGIN
  SELECT * INTO v_ev FROM smartops_events WHERE id = p_event_id; IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT id INTO v_new FROM smartops_forms WHERE event_id = p_event_id AND form_purpose = 'kol_expansao' LIMIT 1;
  IF v_new IS NOT NULL THEN RETURN v_new; END IF;
  SELECT * INTO v_tpl FROM smartops_forms WHERE slug = 'kol-expansao-modelo'; IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO smartops_forms(name, slug, title, subtitle, description, form_purpose, active, display_mode, success_message, event_id, theme_color, theme_mode,
    tracking_ga4_id, tracking_gtm_id, tracking_meta_pixel_id, tracking_tiktok_pixel_id, show_progress)
  VALUES ('# - [KOLEXPANSÃO] - ' || v_ev.name, public.fn_event_form_slug('kol', p_event_id), v_tpl.title, v_tpl.subtitle, v_tpl.description,
    'kol_expansao', true, v_tpl.display_mode, v_tpl.success_message, p_event_id, v_tpl.theme_color, v_tpl.theme_mode,
    v_tpl.tracking_ga4_id, v_tpl.tracking_gtm_id, v_tpl.tracking_meta_pixel_id, v_tpl.tracking_tiktok_pixel_id, v_tpl.show_progress)
  RETURNING id INTO v_new;
  PERFORM public.fn_copy_form_fields_remapped(v_tpl.id, v_new);
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.trg_event_clone_distribuicao_form()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.fn_clone_distribuicao_form_for_event(NEW.id);
  IF coalesce(NEW.event_type, '') <> 'campanha_promocional' THEN
    PERFORM public.fn_clone_lead_form_for_event(NEW.id);
    PERFORM public.fn_clone_kol_expansao_form_for_event(NEW.id);
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.fn_copy_form_fields_remapped(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_clone_lead_form_for_event(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_clone_kol_expansao_form_for_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_clone_lead_form_for_event(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_clone_kol_expansao_form_for_event(uuid) TO service_role;