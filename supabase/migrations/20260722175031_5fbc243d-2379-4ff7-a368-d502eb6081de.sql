CREATE OR REPLACE FUNCTION public.smart_ops_field_normalize_distinct(p_field text)
RETURNS TABLE(value text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text[] := ARRAY[
    'area_atuacao','especialidade','tem_scanner','equip_scanner','scanner_modelo',
    'marca_scanner','tem_impressora','impressora_modelo','marca_impressora',
    'tem_cad','tem_fresadora','imprime_modelos','imprime_placas','imprime_guias',
    'imprime_resinas_ld','sdr_software_cad_interesse','produto_interesse',
    'produto_interesse_auto','temperatura','real_status','prazo_compra',
    'tipo_local','sdr_completo','uf','funil_crm','etapa_crm','status_piperun',
    'proprietario_lead_crm','origem_primeiro_contato','form_name',
    'utm_campaign','cidade'
  ];
BEGIN
  IF NOT (p_field = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'field % not allowed', p_field;
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT NULLIF(%I::text, '''') AS value, COUNT(*)::bigint AS count
     FROM public.lia_attendances
     WHERE merged_into IS NULL
     GROUP BY 1
     ORDER BY 2 DESC
     LIMIT 500',
    p_field
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.smart_ops_field_normalize_distinct(text) TO authenticated, service_role;