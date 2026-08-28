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

  IF NOT (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'author'::app_role)
    OR public.fn_is_team_member()
  ) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;

  SELECT * INTO v_src FROM public.smartops_forms WHERE id = p_form_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'formulario_nao_encontrado';
  END IF;

  INSERT INTO public.smartops_forms (
    name, slug, form_purpose, title, subtitle, description,
    theme_color, success_message, success_redirect_url, display_mode, active
  ) VALUES (
    v_src.name || ' (cópia)',
    v_src.slug || '-copia-' || to_char(now(), 'YYYYMMDDHH24MISS'),
    v_src.form_purpose, v_src.title, v_src.subtitle, v_src.description,
    v_src.theme_color, v_src.success_message, v_src.success_redirect_url,
    v_src.display_mode, false
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.smartops_form_fields (
    form_id, label, field_type, db_column, required, placeholder, order_index, options
  )
  SELECT v_new_id, f.label, f.field_type, f.db_column, f.required, f.placeholder, f.order_index, f.options
  FROM public.smartops_form_fields f
  WHERE f.form_id = p_form_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_duplicate_smartops_form(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_duplicate_smartops_form(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_duplicate_smartops_form(uuid) TO service_role;