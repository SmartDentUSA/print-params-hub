CREATE OR REPLACE FUNCTION public.smart_ops_field_normalize_allowed_fields()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT ARRAY[
    'area_atuacao','especialidade','tem_scanner','equip_scanner','equip_scanner_bancada',
    'scanner_marca','tem_impressora','impressora_modelo','sdr_marca_impressora_param',
    'equip_cad','equip_fresadora','imprime_modelos','imprime_placas','imprime_guias',
    'imprime_resinas_ld','sdr_software_cad_interesse','produto_interesse',
    'produto_interesse_auto','temperatura_lead','real_status','prazo_compra',
    'tipo_local','sdr_completo','uf','piperun_pipeline_name','piperun_stage_name','piperun_status',
    'proprietario_lead_crm','origem_primeiro_contato','form_name',
    'utm_campaign','cidade'
  ]::text[];
$function$;