CREATE OR REPLACE FUNCTION public.fn_duplicate_smartops_form(p_form_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
  v_src public.smartops_forms;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado';
  END IF;

  SELECT * INTO v_src FROM public.smartops_forms WHERE id = p_form_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'formulario_nao_encontrado';
  END IF;

  INSERT INTO public.smartops_forms (
    name, slug, active, form_purpose, title, subtitle, description,
    theme_color, success_message, success_redirect_url, display_mode, show_progress,
    hero_image_url, hero_image_alt, campaign_identifier, product_catalog_id,
    workflow_stage_target, media_type, video_id, video_thumbnail_url, video_embed_url,
    brand_color_h, brand_color_s, brand_color_l, badge_text, cta_text, trust_text,
    bg_type, bg_color, bg_color_to, bg_gradient_angle, bg_image_url, bg_overlay_opacity,
    theme_mode, layout_variant, font_heading, font_body, button_radius, button_shadow,
    extra_sections, custom_css,
    tracking_gtm_id, tracking_ga4_id, tracking_meta_pixel_id, tracking_tiktok_pixel_id,
    tracking_extra_head,
    heading_color, body_color, label_color, muted_color, auto_contrast,
    seo_title, seo_description, seo_keywords,
    bio_enabled_form, bio_enabled_landing,
    ig_trigger_keyword, ig_trigger_cta, ig_trigger_dm_message, ig_trigger_enabled,
    forced_seller_team_member_id, event_id, event_consultant_ids,
    event_categories, event_product_buttons
  ) VALUES (
    v_src.name || ' (cópia)',
    v_src.slug || '-copia-' || to_char(now(), 'YYYYMMDDHH24MISS'),
    false, v_src.form_purpose, v_src.title, v_src.subtitle, v_src.description,
    v_src.theme_color, v_src.success_message, v_src.success_redirect_url, v_src.display_mode, v_src.show_progress,
    v_src.hero_image_url, v_src.hero_image_alt, v_src.campaign_identifier, v_src.product_catalog_id,
    v_src.workflow_stage_target, v_src.media_type, v_src.video_id, v_src.video_thumbnail_url, v_src.video_embed_url,
    v_src.brand_color_h, v_src.brand_color_s, v_src.brand_color_l, v_src.badge_text, v_src.cta_text, v_src.trust_text,
    v_src.bg_type, v_src.bg_color, v_src.bg_color_to, v_src.bg_gradient_angle, v_src.bg_image_url, v_src.bg_overlay_opacity,
    v_src.theme_mode, v_src.layout_variant, v_src.font_heading, v_src.font_body, v_src.button_radius, v_src.button_shadow,
    v_src.extra_sections, v_src.custom_css,
    v_src.tracking_gtm_id, v_src.tracking_ga4_id, v_src.tracking_meta_pixel_id, v_src.tracking_tiktok_pixel_id,
    v_src.tracking_extra_head,
    v_src.heading_color, v_src.body_color, v_src.label_color, v_src.muted_color, v_src.auto_contrast,
    v_src.seo_title, v_src.seo_description, v_src.seo_keywords,
    v_src.bio_enabled_form, v_src.bio_enabled_landing,
    v_src.ig_trigger_keyword, v_src.ig_trigger_cta, v_src.ig_trigger_dm_message, false,
    v_src.forced_seller_team_member_id, v_src.event_id, v_src.event_consultant_ids,
    v_src.event_categories, v_src.event_product_buttons
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.smartops_form_fields (
    form_id, label, field_type, db_column, custom_field_name, options, required,
    placeholder, order_index, roi_config, workflow_cell_target, conditions,
    show_when_especialidade
  )
  SELECT v_new_id, f.label, f.field_type, f.db_column, f.custom_field_name, f.options, f.required,
         f.placeholder, f.order_index, f.roi_config, f.workflow_cell_target, f.conditions,
         f.show_when_especialidade
  FROM public.smartops_form_fields f
  WHERE f.form_id = p_form_id
  ORDER BY f.order_index;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_duplicate_smartops_form(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_duplicate_smartops_form(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_duplicate_smartops_form(uuid) TO service_role;