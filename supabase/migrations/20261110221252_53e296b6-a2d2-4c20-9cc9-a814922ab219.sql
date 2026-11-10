CREATE OR REPLACE FUNCTION public.fn_cognitive_timeline_candidates(p_limit integer DEFAULT 20)
RETURNS TABLE(lead_id uuid, last_signal_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sig AS (
    SELECT l.lead_id, max(l.created_at) AS last_signal_at
    FROM public.lead_activity_log l
    WHERE l.event_timestamp >= now() - interval '3 days'
      AND l.created_at >= now() - interval '6 hours'
      AND l.created_at <= now() - interval '1 minute'
      AND l.lead_id IS NOT NULL
      AND l.event_type = ANY (ARRAY[
        'crm_activity','crm_proposal','crm_deal_won','crm_deal_lost','crm_deal_created','deal_created',
        'form_submission','meta_ads_lead_entry','whatsapp_message_received','social_dm_received',
        'ecommerce_order_created','ecommerce_order_paid','ecommerce_order_invoiced',
        'reuniao_agendada','reuniao_analisada','crm_etapa_movida_reuniao',
        'deal_reativado_via_formulario','deal_reconversion_created','certificado_emitido',
        'support_ticket_created','support_ticket_resolved'
      ])
    GROUP BY l.lead_id
  )
  SELECT s.lead_id, s.last_signal_at
  FROM sig s
  JOIN public.lia_attendances a ON a.id = s.lead_id AND a.merged_into IS NULL
  WHERE a.cognitive_updated_at IS NULL OR a.cognitive_updated_at < s.last_signal_at
  ORDER BY s.last_signal_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
$$;

REVOKE ALL ON FUNCTION public.fn_cognitive_timeline_candidates(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cognitive_timeline_candidates(integer) TO service_role;