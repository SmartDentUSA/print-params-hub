-- Clone ioconnect form into 52 product-specific forms preserving conditional flow

CREATE OR REPLACE FUNCTION public.clone_ioconnect_form(
  p_slug text,
  p_name text,
  p_title text,
  p_stage text
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_source_id constant uuid := 'f4e0effb-6012-402c-b00b-b57483d371fc';
  v_new_form_id uuid;
  v_id_map jsonb := '{}'::jsonb;
  v_field record;
  v_new_field_id uuid;
  v_new_conditions jsonb;
  v_old_key text;
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM public.smartops_forms WHERE slug = p_slug;
  IF v_existing IS NOT NULL THEN
    RAISE NOTICE 'Skipping % — slug already exists (%)', p_slug, v_existing;
    RETURN v_existing;
  END IF;

  INSERT INTO public.smartops_forms (
    name, slug, description, active, form_purpose, theme_color, success_message,
    success_redirect_url, title, subtitle, hero_image_url, hero_image_alt,
    campaign_identifier, product_catalog_id, workflow_stage_target,
    media_type, video_id, video_thumbnail_url, video_embed_url,
    brand_color_h, brand_color_s, brand_color_l, badge_text, cta_text, trust_text,
    display_mode, show_progress, bg_type, bg_color, bg_color_to, bg_gradient_angle,
    bg_image_url, bg_overlay_opacity, theme_mode, layout_variant,
    font_heading, font_body, button_radius, button_shadow, extra_sections, custom_css,
    tracking_gtm_id, tracking_ga4_id, tracking_meta_pixel_id, tracking_tiktok_pixel_id, tracking_extra_head
  )
  SELECT
    p_name, p_slug, description, active, form_purpose, theme_color, success_message,
    success_redirect_url, p_title, subtitle, hero_image_url, hero_image_alt,
    campaign_identifier, product_catalog_id, p_stage,
    media_type, video_id, video_thumbnail_url, video_embed_url,
    brand_color_h, brand_color_s, brand_color_l, badge_text, cta_text, trust_text,
    display_mode, show_progress, bg_type, bg_color, bg_color_to, bg_gradient_angle,
    bg_image_url, bg_overlay_opacity, theme_mode, layout_variant,
    font_heading, font_body, button_radius, button_shadow, extra_sections, custom_css,
    tracking_gtm_id, tracking_ga4_id, tracking_meta_pixel_id, tracking_tiktok_pixel_id, tracking_extra_head
  FROM public.smartops_forms
  WHERE id = v_source_id
  RETURNING id INTO v_new_form_id;

  FOR v_field IN
    SELECT id FROM public.smartops_form_fields WHERE form_id = v_source_id
  LOOP
    v_id_map := v_id_map || jsonb_build_object(v_field.id::text, gen_random_uuid()::text);
  END LOOP;

  FOR v_field IN
    SELECT * FROM public.smartops_form_fields WHERE form_id = v_source_id ORDER BY order_index
  LOOP
    v_new_field_id := (v_id_map ->> v_field.id::text)::uuid;
    v_new_conditions := v_field.conditions;

    IF v_new_conditions IS NOT NULL THEN
      FOR v_old_key IN SELECT jsonb_object_keys(v_id_map)
      LOOP
        v_new_conditions := replace(v_new_conditions::text, v_old_key, v_id_map ->> v_old_key)::jsonb;
      END LOOP;
    END IF;

    INSERT INTO public.smartops_form_fields (
      id, form_id, label, field_type, db_column, custom_field_name,
      options, required, placeholder, order_index, roi_config,
      workflow_cell_target, conditions, show_when_especialidade
    ) VALUES (
      v_new_field_id, v_new_form_id, v_field.label, v_field.field_type,
      v_field.db_column, v_field.custom_field_name, v_field.options,
      v_field.required, v_field.placeholder, v_field.order_index, v_field.roi_config,
      v_field.workflow_cell_target, v_new_conditions, v_field.show_when_especialidade
    );
  END LOOP;

  RETURN v_new_form_id;
END;
$$;

DO $$
BEGIN
  PERFORM public.clone_ioconnect_form('ios-medit-i600', '# - FORMS - IOS - MEDIT i600', 'IOS - MEDIT i600', '1_captura_digital_scanner_intraoral');
  PERFORM public.clone_ioconnect_form('ios-medit-i700', '# - FORMS - IOS - MEDIT i700', 'IOS - MEDIT i700', '1_captura_digital_scanner_intraoral');
  PERFORM public.clone_ioconnect_form('ios-medit-i700-wireless', '# - FORMS - IOS - MEDIT i700 Wireless', 'IOS - MEDIT i700 Wireless', '1_captura_digital_scanner_intraoral');
  PERFORM public.clone_ioconnect_form('ios-medit-i900', '# - FORMS - IOS - MEDIT i900', 'IOS - MEDIT i900', '1_captura_digital_scanner_intraoral');
  PERFORM public.clone_ioconnect_form('ios-blz-ino100-plus', '# - FORMS - IOS - BLZ INO 100 Plus', 'IOS - BLZ INO 100 Plus', '1_captura_digital_scanner_intraoral');
  PERFORM public.clone_ioconnect_form('ios-blz-ino200', '# - FORMS - IOS - BLZ INO 200', 'IOS - BLZ INO 200', '1_captura_digital_scanner_intraoral');
  PERFORM public.clone_ioconnect_form('ios-blz-leap500', '# - FORMS - IOS - BLZ Leap 500', 'IOS - BLZ Leap 500', '1_captura_digital_scanner_intraoral');
  PERFORM public.clone_ioconnect_form('dds-medit-t100', '# - FORMS - DDS - Medit T100', 'DDS - Medit T100', '1_captura_digital_scanner_bancada');
  PERFORM public.clone_ioconnect_form('dds-blz-ls100', '# - FORMS - DDS - BLZ LS100', 'DDS - BLZ LS100', '1_captura_digital_scanner_bancada');
  PERFORM public.clone_ioconnect_form('blz-dental-dmc', '# - FORMS - BLZ Dental  DMC', 'BLZ Dental  DMC', '1_captura_digital_acessorios');
  PERFORM public.clone_ioconnect_form('io-connect-truabutment', '# - FORMS - ioConnect -TruAbutment', 'ioConnect -TruAbutment', '1_captura_digital_acessorios');
  PERFORM public.clone_ioconnect_form('software-cad-exocad-dentcad', '# - FORMS - Softwares CAD exocad DentCad', 'Softwares CAD exocad DentCad', '2_cad_software');
  PERFORM public.clone_ioconnect_form('software-cad-exocad-exoplan', '# - FORMS - Softwares CAD exocad exoplan', 'Softwares CAD exocad exoplan', '2_cad_software');
  PERFORM public.clone_ioconnect_form('ativacao-exocad-dentalcad-ia', '# - FORMS - Ativação exocad DentalCad I.A.', 'Ativação exocad DentalCad I.A.', '2_cad_l_creditos_ia_cad');
  PERFORM public.clone_ioconnect_form('credito-exocad-dentalcad-ia', '# - FORMS - Crédito exocad DentalCad I.A.', 'Crédito exocad DentalCad I.A.', '2_cad_l_creditos_ia_cad');
  PERFORM public.clone_ioconnect_form('terceirizacao-projetos-cad', '# - FORMS - Terceirização de projetos CAD', 'Terceirização de projetos CAD', '2_cad_servico');
  PERFORM public.clone_ioconnect_form('resina-3d-smartprint-bio-vitality', '# - FORMS - Resina 3D Smart Print Bio Vitality', 'Resina 3D Smart Print Bio Vitality', '3_impressao_3d_resinas');
  PERFORM public.clone_ioconnect_form('resina-3d-smartprint-bio-temp', '# - FORMS - Resina 3D Smart Print Bio Temp', 'Resina 3D Smart Print Bio Temp', '3_impressao_3d_resinas');
  PERFORM public.clone_ioconnect_form('resina-3d-smartprint-bio-bite-splint', '# - FORMS - Resina 3D Smart Print Bio Bite Splint', 'Resina 3D Smart Print Bio Bite Splint', '3_impressao_3d_resinas');
  PERFORM public.clone_ioconnect_form('resina-3d-smartprint-bio-clear-guide', '# - FORMS - Resina 3D Smart Print Bio Clear Guide', 'Resina 3D Smart Print Bio Clear Guide', '3_impressao_3d_resinas');
  PERFORM public.clone_ioconnect_form('resina-3d-smartprint-modelo-plus', '# - FORMS - Resina 3D Smart Print Modelo Plus', 'Resina 3D Smart Print Modelo Plus', '3_impressao_3d_resinas');
  PERFORM public.clone_ioconnect_form('resina-3d-smartprint-modelo-precision', '# - FORMS - Resina 3D Smart Print Modelo Precision', 'Resina 3D Smart Print Modelo Precision', '3_impressao_3d_resinas');
  PERFORM public.clone_ioconnect_form('resina-3d-smartprint-modelo-laqua', '# - FORMS - Resina 3D Smart Print Modelo Láqua', 'Resina 3D Smart Print Modelo Láqua', '3_impressao_3d_resinas');
  PERFORM public.clone_ioconnect_form('resina-3d-smartprint-bio-vitality-all-on-x', '# - FORMS - Resina 3D Smart Print Bio Vitality All-On-X', 'Resina 3D Smart Print Bio Vitality All-On-X', '3_impressao_3d_resinas');
  PERFORM public.clone_ioconnect_form('resina-3d-smartprint-bio-temp-b1', '# - FORMS - Resina 3D Smart Print Bio Temp B1', 'Resina 3D Smart Print Bio Temp B1', '3_impressao_3d_resinas');
  PERFORM public.clone_ioconnect_form('resina-3d-smartprint-bio-bite-splint-clear', '# - FORMS - Resina 3D Smart Print Bio Bite Splint Clear', 'Resina 3D Smart Print Bio Bite Splint Clear', '3_impressao_3d_resinas');
  PERFORM public.clone_ioconnect_form('resina-3d-smartprint-bio-bite-splint-flex', '# - FORMS - Resina 3D Smart Print Bio Bite Splint +Flex', 'Resina 3D Smart Print Bio Bite Splint +Flex', '3_impressao_3d_resinas');
  PERFORM public.clone_ioconnect_form('resina-smart-3d-print-bio-clear-guide', '# - FORMS - Resina Smart 3D Print Bio Clear Guide', 'Resina Smart 3D Print Bio Clear Guide', '3_impressao_3d_resinas');
  PERFORM public.clone_ioconnect_form('resina-3d-smartprint-bio-denture', '# - FORMS - Resina 3D Smart Print Bio Denture', 'Resina 3D Smart Print Bio Denture', '3_impressao_3d_resinas');
  PERFORM public.clone_ioconnect_form('resina-3d-smartprint-bio-go-white', '# - FORMS - Resina 3D Smart Print Bio GOWhite', 'Resina 3D Smart Print Bio GOWhite', '3_impressao_3d_resinas');
  PERFORM public.clone_ioconnect_form('resina-3d-smartprint-bio-direct-aligner', '# - FORMS - Resina 3d Smart Print Bio Direct Aligner', 'Resina 3d Smart Print Bio Direct Aligner', '3_impressao_3d_resinas');
  PERFORM public.clone_ioconnect_form('software-smart-slicer', '# - FORMS - Software Smart Slicer', 'Software Smart Slicer', '3_impressao_3d_software');
  PERFORM public.clone_ioconnect_form('impressora-3d-rayshape-edge-mini', '# - FORMS - Impressora 3D Rayshape Edge Mini', 'Impressora 3D Rayshape Edge Mini', '3_impressao_3d_impressora_odontologica');
  PERFORM public.clone_ioconnect_form('impressora-3d-elegoo-mars-5-ultra', '# - FORMS - Impressora 3D Elegoo Mars 5 Ultra', 'Impressora 3D Elegoo Mars 5 Ultra', '3_impressao_3d_impressora_odontologica');
  PERFORM public.clone_ioconnect_form('equipamento-uv-shapecure-d', '# - FORMS - Equipamento  UV ShapeCure D', 'Equipamento  UV ShapeCure D', '4_pos_impressao_equipamentos');
  PERFORM public.clone_ioconnect_form('equipamento-asiga-cure', '# - FORMS - Equipamento Asiga Cure', 'Equipamento Asiga Cure', '4_pos_impressao_equipamentos');
  PERFORM public.clone_ioconnect_form('equipamento-misturador-de-resinas', '# - FORMS - Equipamento Misturador de Resinas', 'Equipamento Misturador de Resinas', '4_pos_impressao_equipamentos');
  PERFORM public.clone_ioconnect_form('nanoclean-pod', '# - FORMS - NanoClean PoD', 'NanoClean PoD', '4_pos_impressao_limpeza_acabamento');
  PERFORM public.clone_ioconnect_form('nanoclean-caneta', '# - FORMS - NanoClean (Caneta)', 'NanoClean (Caneta)', '4_pos_impressao_limpeza_acabamento');
  PERFORM public.clone_ioconnect_form('glaze-on-splint', '# - FORMS - GlazeON - Splint', 'GlazeON - Splint', '4_pos_impressao_limpeza_acabamento');
  PERFORM public.clone_ioconnect_form('nanoclean-clear', '# - FORMS - NanoClean Clear', 'NanoClean Clear', '4_pos_impressao_limpeza_acabamento');
  PERFORM public.clone_ioconnect_form('caracterizacao-smart-make', '# - FORMS - Caracterização SmartMake', 'Caracterização SmartMake', '5_finalizacao_caracterizacao');
  PERFORM public.clone_ioconnect_form('caracterizacao-smart-gum', '# - FORMS - Caracterização SmartGum', 'Caracterização SmartGum', '5_finalizacao_caracterizacao');
  PERFORM public.clone_ioconnect_form('cimento-unikk', '# - FORMS - Cimento UNIKK', 'Cimento UNIKK', '5_finalizacao_instalacao');
  PERFORM public.clone_ioconnect_form('resina-composta-direta-atos', '# - FORMS - Resina Composta Direta Atos', 'Resina Composta Direta Atos', '5_finalizacao_dentistica_orto');
  PERFORM public.clone_ioconnect_form('resina-composta-atos-academic', '# - FORMS - Resina Composta  Atos Academic', 'Resina Composta  Atos Academic', '5_finalizacao_academic');
  PERFORM public.clone_ioconnect_form('adesivo-ortodontico-smart-orto', '# - FORMS - Adesivo ortodôntico SmartOrto', 'Adesivo ortodôntico SmartOrto', '5_finalizacao_dentistica_orto');
  PERFORM public.clone_ioconnect_form('Curso-presencial', '# - FORMS - Curso presencial', 'Curso presencial', '6_cursos_presecial');
  PERFORM public.clone_ioconnect_form('curso-presencial-imersao-3-dias-chairside', '# - FORMS - Imersão 3 Dias - Chair Side Print Make', 'Imersão 3 Dias - Chair Side Print Make', '6_cursos_presecial');
  PERFORM public.clone_ioconnect_form('print-make-imersao-clinica', '# - FORMS - Imersão clínica', 'Imersão clínica', '6_cursos_online');
  PERFORM public.clone_ioconnect_form('acesso-smart-dent-academy', '# - FORMS - Acesso Smart Dent Academy', 'Acesso Smart Dent Academy', '6_cursos_online');
  PERFORM public.clone_ioconnect_form('acess-grupo-smartdent', '# - FORMS - Acesso Grupo Smart Dent', 'Acesso Grupo Smart Dent', '6_cursos_online');
END;
$$;

DROP FUNCTION public.clone_ioconnect_form(text, text, text, text);