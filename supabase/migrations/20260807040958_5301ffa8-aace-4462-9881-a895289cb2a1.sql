CREATE OR REPLACE FUNCTION public.fn_lead_timeline_unified(p_lead_id uuid, p_limit integer DEFAULT 300, p_categories text[] DEFAULT NULL::text[])
 RETURNS TABLE(item_id text, category text, event_type text, event_timestamp timestamp with time zone, title text, description text, source_channel text, value_numeric numeric, entity_type text, entity_id text, event_data jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH unified AS (
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
        CASE l.event_type
          WHEN 'sms_delivered' THEN 'SMS entregue'
          WHEN 'sms_delivery_failed' THEN 'Falha na entrega do SMS'
          WHEN 'sms_enviado' THEN 'SMS enviado'
          WHEN 'sms_envio_falhou' THEN 'SMS falhou'
          ELSE NULL
        END,
        NULLIF(l.entity_name, ''),
        replace(l.event_type, '_', ' ')
      )                                                            AS title,
      COALESCE(
        NULLIF(l.event_data->>'mensagem', ''),
        NULLIF(l.event_data->>'texto', ''),
        NULLIF(l.event_data->>'message', ''),
        NULLIF(l.event_data->>'content', ''),
        NULLIF(l.event_data->>'title', ''),
        NULLIF(l.event_data->>'comment', ''),
        NULLIF(l.event_data->>'etapa', ''),
        NULLIF(l.event_data->>'funil', ''),
        NULLIF(l.event_data->>'descricao_detalhe', ''),
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

    SELECT
      'msg:' || m.id::text,
      'mensagem',
      COALESCE('msg_' || NULLIF(m.tipo, ''), 'mensagem_enviada'),
      COALESCE(m.data_envio, m.created_at),
      CASE
        WHEN m.tipo ILIKE '%sms%' THEN 'SMS enviado'
        WHEN m.tipo ILIKE '%nps%' THEN 'Convite NPS enviado'
        WHEN m.tipo ILIKE '%whats%' OR m.tipo ILIKE '%evolution%' THEN 'WhatsApp enviado'
        ELSE COALESCE(NULLIF(replace(m.tipo, '_', ' '), ''), 'Mensagem')
      END,
      NULLIF(m.mensagem_preview, ''),
      COALESCE(NULLIF(m.evolution_instance, ''), CASE WHEN m.tipo ILIKE '%sms%' THEN 'sms' ELSE 'whatsapp' END),
      NULL::numeric,
      'message_log',
      m.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'kind', 'mensagem',
        'kind_label', CASE
          WHEN m.tipo ILIKE '%sms%' THEN 'SMS enviado'
          WHEN m.tipo ILIKE '%nps%' THEN 'Convite NPS enviado'
          WHEN m.tipo ILIKE '%whats%' OR m.tipo ILIKE '%evolution%' THEN 'WhatsApp enviado'
          ELSE 'Mensagem' END,
        'icon', CASE WHEN m.tipo ILIKE '%sms%' THEN '📱' ELSE '💬' END,
        'mensagem', m.mensagem_preview,
        'status', m.status,
        'telefone', m.whatsapp_number,
        'instancia', m.evolution_instance,
        'erro', m.error_details,
        'fonte', 'message_logs'
      ))
    FROM public.message_logs m
    WHERE m.lead_id = p_lead_id
      AND COALESCE(m.data_envio, m.created_at) IS NOT NULL
      -- Evita duplicidade: SMS de campanha já entram pelo campaign_send_log (texto completo).
      AND NOT (
        m.tipo ILIKE '%sms%'
        AND EXISTS (
          SELECT 1 FROM public.campaign_send_log c
          WHERE c.lead_id = m.lead_id
            AND c.email IS NULL
            AND c.sent_at IS NOT NULL
            AND abs(extract(epoch FROM (c.sent_at - COALESCE(m.data_envio, m.created_at)))) < 900
        )
      )

    UNION ALL

    SELECT * FROM (
      SELECT
        'sms_sent:' || c.id::text                                   AS item_id,
        'mensagem'                                                  AS category,
        'sms_enviado'                                               AS event_type,
        c.sent_at                                                   AS event_timestamp,
        CASE WHEN c.status = 'failed' THEN 'SMS falhou' ELSE 'SMS enviado' END AS title,
        COALESCE(NULLIF(c.mensagem_rendered, ''), NULLIF(c.content_sent, '')) AS description,
        COALESCE(NULLIF(c.provider, ''), 'sms')                     AS source_channel,
        NULL::numeric                                               AS value_numeric,
        'campaign_send'                                             AS entity_type,
        c.id::text                                                  AS entity_id,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'mensagem',
          'kind_label', CASE WHEN c.status = 'failed' THEN 'SMS falhou' ELSE 'SMS enviado' END,
          'icon', '📱',
          'mensagem', COALESCE(NULLIF(c.mensagem_rendered, ''), NULLIF(c.content_sent, '')),
          'telefone', c.telefone,
          'status', c.status,
          'provider', c.provider,
          'provider_status', c.provider_status,
          'provider_detalhe', c.provider_detail_message,
          'provider_message_id', c.provider_message_id,
          'erro', c.error_message,
          'campaign_id', c.campaign_id,
          'fonte', 'campaign_send_log'
        ))                                                          AS event_data
      FROM public.campaign_send_log c
      WHERE c.lead_id = p_lead_id
        AND c.sent_at IS NOT NULL
        AND c.email IS NULL
        AND COALESCE(NULLIF(c.mensagem_rendered, ''), NULLIF(c.content_sent, '')) IS NOT NULL

      UNION ALL
      SELECT
        'sms_delivered:' || c.id::text, 'mensagem', 'sms_entregue', c.delivered_at,
        'SMS entregue',
        COALESCE(NULLIF(c.mensagem_rendered, ''), NULLIF(c.content_sent, '')),
        COALESCE(NULLIF(c.provider, ''), 'sms'), NULL::numeric,
        'campaign_send', c.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'mensagem', 'kind_label', 'SMS entregue', 'icon', '✅',
          'mensagem', COALESCE(NULLIF(c.mensagem_rendered, ''), NULLIF(c.content_sent, '')),
          'telefone', c.telefone, 'provider', c.provider,
          'provider_status', c.provider_status,
          'provider_detalhe', c.provider_detail_message,
          'campaign_id', c.campaign_id, 'fonte', 'campaign_send_log'
        ))
      FROM public.campaign_send_log c
      WHERE c.lead_id = p_lead_id AND c.delivered_at IS NOT NULL AND c.email IS NULL

      UNION ALL
      SELECT
        'email_sent:' || c.id::text, 'email', 'email_enviado', c.sent_at,
        'E-mail enviado', NULLIF(c.subject_snapshot, ''), 'email', NULL::numeric,
        'campaign_send', c.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'email', 'kind_label', 'E-mail enviado', 'icon', '📧',
          'assunto', c.subject_snapshot, 'email', c.email,
          'campaign_id', c.campaign_id, 'status', c.status,
          'erro', c.error_message, 'fonte', 'campaign_send_log'
        ))
      FROM public.campaign_send_log c
      WHERE c.lead_id = p_lead_id AND c.sent_at IS NOT NULL AND c.email IS NOT NULL

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
          'assunto', c.subject_snapshot, 'cliques', c.click_count, 'email', c.email,
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
          'motivo', c.bounce_reason, 'email', c.email,
          'campaign_id', c.campaign_id, 'fonte', 'campaign_send_log'
        ))
      FROM public.campaign_send_log c
      WHERE c.lead_id = p_lead_id AND c.bounced_at IS NOT NULL
    ) canais

    UNION ALL

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
$function$;