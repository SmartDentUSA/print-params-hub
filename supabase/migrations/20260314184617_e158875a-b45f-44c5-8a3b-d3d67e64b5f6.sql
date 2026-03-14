CREATE OR REPLACE FUNCTION public.fn_get_lead_context(p_lead_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'lead_id', la.id,
    'email', p.email,
    'nome', p.nome,
    'original_source', la.original_source,
    'ultima_atividade', (SELECT MAX(event_timestamp) FROM public.lead_activity_log WHERE lead_id = p_lead_id),
    'total_interacoes', (SELECT COUNT(*) FROM public.lead_activity_log WHERE lead_id = p_lead_id),
    'cursos_completados', COALESCE((SELECT array_agg(DISTINCT course_name) FROM public.lead_course_progress WHERE lead_id = p_lead_id AND status = 'completed'), '{}'),
    'produtos_comprados', COALESCE((SELECT array_agg(DISTINCT product_name ORDER BY product_name) FROM public.lead_product_history WHERE lead_id = p_lead_id AND purchased_at IS NOT NULL), '{}'),
    'equipamentos_mencionados', COALESCE((SELECT array_agg(DISTINCT equipment_mentioned) FROM public.lead_form_submissions WHERE lead_id = p_lead_id AND equipment_mentioned IS NOT NULL), '{}'),
    'produtos_mencionados', COALESCE((SELECT array_agg(DISTINCT product_mentioned) FROM public.lead_form_submissions WHERE lead_id = p_lead_id AND product_mentioned IS NOT NULL), '{}'),
    'valor_total_gasto', (SELECT SUM(total_purchased_value) FROM public.lead_product_history WHERE lead_id = p_lead_id AND purchased_at IS NOT NULL),
    'dias_entre_compras_media', (SELECT AVG(avg_days_between_purchases) FROM public.lead_product_history WHERE lead_id = p_lead_id AND purchased_at IS NOT NULL),
    'carrinhos_abandonados', (SELECT COUNT(*) FROM public.lead_cart_history WHERE lead_id = p_lead_id AND status = 'abandoned'),
    'ultimo_carrinho_abandonado', (SELECT MAX(total_value) FROM public.lead_cart_history WHERE lead_id = p_lead_id AND status = 'abandoned'),
    'num_contatos_sdr', (SELECT COUNT(*) FROM public.lead_sdr_interactions WHERE lead_id = p_lead_id),
    'ultimo_contato_sdr', (SELECT MAX(contacted_at) FROM public.lead_sdr_interactions WHERE lead_id = p_lead_id),
    'ultimo_sdr_notes', (SELECT notes FROM public.lead_sdr_interactions WHERE lead_id = p_lead_id ORDER BY contacted_at DESC LIMIT 1)
  ) INTO v_result
  FROM public.lia_attendances la
  JOIN public.people p ON la.person_id = p.id
  WHERE la.id = p_lead_id;
  
  RETURN v_result;
END;
$function$;