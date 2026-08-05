CREATE OR REPLACE FUNCTION public.fn_lead_timeline_unified(
  p_lead_id uuid,
  p_limit integer DEFAULT 300,
  p_categories text[] DEFAULT NULL
)
RETURNS TABLE (
  item_id text,
  category text,
  event_type text,
  event_timestamp timestamptz,
  title text,
  description text,
  source_channel text,
  value_numeric numeric,
  entity_type text,
  entity_id text,
  event_data jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH unified AS (
    -- 1) Trilha canônica de eventos
    SELECT
      'lal:' || l.id::text                                        AS item_id,
      CASE
        WHEN l.event_type LIKE 'crm_%' OR l.event_type LIKE 'deal_%'
          OR l.event_type LIKE 'piperun%' OR l.event_type LIKE '%deal%'    THEN 'crm'
        WHEN l.event_type LIKE 'nps%' OR l.event_type LIKE '%_nps'         THEN 'nps'
        WHEN l.event_type LIKE '%support%' OR l.event_type LIKE '%ticket%'
          OR l.event_type LIKE '%chamado%'                                 THEN 'suporte'
        WHEN l.event_type LIKE '%ecommerce%' OR l.event_type LIKE '%order%'
          OR l.event_type LIKE '%compra%' OR l.event_type LIKE '%payment%'
          OR l.event_type LIKE '%pagamento%'                               THEN 'compra'
        WHEN l.event_type LIKE '%whatsapp%' OR l.event_type LIKE '%sms%'
          OR l.event_type LIKE '%message%' OR l.event_type LIKE 'lia_%'    THEN 'mensagem'
        WHEN l.event_type LIKE '%email%'                                   THEN 'email'
        WHEN l.event_type LIKE 'form_%' OR l.event_type LIKE 'meta_%'
          OR l.event_type LIKE 'zernio%'                                   THEN 'formulario'
        WHEN l.event_type LIKE 'astron%' OR l.event_type LIKE '%course%'
          OR l.event_type LIKE '%treinamento%' OR l.event_type LIKE '%turma%' THEN 'curso'
        ELSE 'sistema'
      END                                                          AS category,
      l.event_type,
      l.event_timestamp,
      COALESCE(
        NULLIF(l.event_data->>'kind_label', ''),
        NULLIF(l.entity_name, ''),
        replace(l.event_type, '_', ' ')
      )                                                            AS title,
      COALESCE(
        NULLIF(l.event_data->>'title', ''),
        NULLIF(l.event_data->>'comment', ''),
        NULLIF(l.event_data->>'etapa', ''),
        NULLIF(l.event_data->>'funil', ''),
        NULLIF(l.event_data->>'status', '')
      )                                                            AS description,
      l.source_channel,
      l.value_numeric,
      l.entity_type,
      l.entity_id::text                                            AS entity_id,
      COALESCE(l.event_data, '{}'::jsonb)                          AS event_data
    FROM public.lead_activity_log l
    WHERE l.lead_id = p_lead_id

    UNION ALL

    -- 2) Mensagens WhatsApp / SMS registradas
    SELECT
      'msg:' || m.id::text,
      'mensagem',
      COALESCE('msg_' || NULLIF(m.tipo, ''), 'mensagem_enviada'),
      COALESCE(m.data_envio, m.created_at),
      COALESCE(NULLIF(replace(m.tipo, '_', ' '), ''), 'Mensagem'),
      NULLIF(m.mensagem_preview, ''),
      COALESCE(NULLIF(m.evolution_instance, ''), 'whatsapp'),
      NULL::numeric,
      'message_log',
      m.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'kind', 'mensagem',
        'kind_label', 'Mensagem',
        'icon', '💬',
        'status', m.status,
        'telefone', m.whatsapp_number,
        'instancia', m.evolution_instance,
        'erro', m.error_details,
        'fonte', 'message_logs'
      ))
    FROM public.message_logs m
    WHERE m.lead_id = p_lead_id
      AND COALESCE(m.data_envio, m.created_at) IS NOT NULL

    UNION ALL

    -- 3) E-mail de campanha: envio, abertura, clique, bounce
    SELECT * FROM (
      SELECT
        'email_sent:' || c.id::text                                 AS item_id,
        'email'                                                     AS category,
        'email_enviado'                                             AS event_type,
        c.sent_at                                                   AS event_timestamp,
        'E-mail enviado'                                            AS title,
        NULLIF(c.subject_snapshot, '')                              AS description,
        'email'                                                     AS source_channel,
        NULL::numeric                                               AS value_numeric,
        'campaign_send'                                             AS entity_type,
        c.id::text                                                  AS entity_id,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'email', 'kind_label', 'E-mail', 'icon', '📧',
          'assunto', c.subject_snapshot, 'email', c.email,
          'campaign_id', c.campaign_id, 'status', c.status, 'fonte', 'campaign_send_log'
        ))                                                          AS event_data
      FROM public.campaign_send_log c
      WHERE c.lead_id = p_lead_id AND c.sent_at IS NOT NULL

      UNION ALL
      SELECT
        'email_open:' || c.id::text, 'email', 'email_aberto', c.opened_at,
        'E-mail aberto', NULLIF(c.subject_snapshot, ''), 'email', NULL::numeric,
        'campaign_send', c.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'email', 'kind_label', 'E-mail aberto', 'icon', '👀',
          'assunto', c.subject_snapshot, 'email', c.email,
          'campaign_id', c.campaign_id, 'fonte', 'campaign_send_log'
        ))
      FROM public.campaign_send_log c
      WHERE c.lead_id = p_lead_id AND c.opened_at IS NOT NULL

      UNION ALL
      SELECT
        'email_click:' || c.id::text, 'email', 'email_clicado', c.clicked_at,
        'Clique no e-mail', NULLIF(c.subject_snapshot, ''), 'email', NULL::numeric,
        'campaign_send', c.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'email', 'kind_label', 'Clique no e-mail', 'icon', '🖱️',
          'assunto', c.subject_snapshot, 'cliques', c.click_count,
          'campaign_id', c.campaign_id, 'fonte', 'campaign_send_log'
        ))
      FROM public.campaign_send_log c
      WHERE c.lead_id = p_lead_id AND c.clicked_at IS NOT NULL

      UNION ALL
      SELECT
        'email_bounce:' || c.id::text, 'email', 'email_bounce', c.bounced_at,
        'E-mail retornado', COALESCE(NULLIF(c.bounce_reason, ''), NULLIF(c.subject_snapshot, '')),
        'email', NULL::numeric, 'campaign_send', c.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'email', 'kind_label', 'E-mail retornado', 'icon', '⚠️',
          'motivo', c.bounce_reason, 'campaign_id', c.campaign_id, 'fonte', 'campaign_send_log'
        ))
      FROM public.campaign_send_log c
      WHERE c.lead_id = p_lead_id AND c.bounced_at IS NOT NULL
    ) emails

    UNION ALL

    -- 4) Visitas em páginas / base de conhecimento
    SELECT
      'view:' || v.id::text,
      'conteudo',
      'page_view',
      COALESCE(v.viewed_at, v.created_at),
      COALESCE(NULLIF(v.page_title, ''), NULLIF(v.page_path, ''), 'Visita'),
      NULLIF(v.page_path, ''),
      COALESCE(NULLIF(v.utm_source, ''), 'site'),
      NULL::numeric,
      'page_view',
      v.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'kind', 'conteudo',
        'kind_label', CASE WHEN v.page_type ILIKE '%knowledge%' OR v.page_path ILIKE '%base-conhecimento%'
                           THEN 'Base de Conhecimento' ELSE 'Visita no site' END,
        'icon', '📚',
        'page_type', v.page_type,
        'page_path', v.page_path,
        'utm_source', v.utm_source,
        'utm_campaign', v.utm_campaign,
        'device', v.device_type,
        'fonte', 'lead_page_views'
      ))
    FROM public.lead_page_views v
    WHERE v.lead_id = p_lead_id
      AND COALESCE(v.viewed_at, v.created_at) IS NOT NULL
  )
  SELECT
    u.item_id, u.category, u.event_type, u.event_timestamp, u.title, u.description,
    u.source_channel, u.value_numeric, u.entity_type, u.entity_id, u.event_data
  FROM unified u
  WHERE p_categories IS NULL OR u.category = ANY(p_categories)
  ORDER BY u.event_timestamp DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 300), 1), 2000);
$$;

GRANT EXECUTE ON FUNCTION public.fn_lead_timeline_unified(uuid, integer, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_lead_timeline_unified(uuid, integer, text[]) TO service_role;