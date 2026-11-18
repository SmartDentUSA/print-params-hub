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
        WHEN l.event_type LIKE 'social%' OR l.event_type LIKE '%instagram%'
          OR l.event_type LIKE '%zernio%dm%' OR l.event_type LIKE '%_dm_%'   THEN 'social'
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
          WHEN 'social_dm_sent' THEN 'DM enviada'
          WHEN 'social_dm_received' THEN 'DM recebida'
          WHEN 'social_comment_received' THEN 'Comentário recebido'
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
      WITH c AS (
        SELECT c0.*,
               NULLIF(cp.nome, '')                             AS campanha_nome,
               COALESCE(c0.source_campaign_id, c0.campaign_id) AS campanha_id,
               (c0.provider = 'zernio_cloud_api')              AS is_wa,
               COALESCE(NULLIF(c0.mensagem_rendered, ''), NULLIF(c0.content_sent, '')) AS texto
        FROM public.campaign_send_log c0
        LEFT JOIN public.campaigns cp ON cp.id = c0.source_campaign_id
        WHERE c0.lead_id = p_lead_id
      )
      -- SMS
      SELECT
        'sms_sent:' || c.id::text                                   AS item_id,
        'mensagem'                                                  AS category,
        'sms_enviado'                                               AS event_type,
        c.sent_at                                                   AS event_timestamp,
        CASE WHEN c.status = 'failed' THEN 'SMS falhou' ELSE 'SMS enviado' END
          || COALESCE(' · ' || c.campanha_nome, '')                 AS title,
        c.texto                                                     AS description,
        COALESCE(NULLIF(c.provider, ''), 'sms')                     AS source_channel,
        NULL::numeric                                               AS value_numeric,
        'campaign_send'                                             AS entity_type,
        c.id::text                                                  AS entity_id,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'mensagem',
          'kind_label', CASE WHEN c.status = 'failed' THEN 'SMS falhou' ELSE 'SMS enviado' END,
          'icon', '📱',
          'mensagem', c.texto,
          'telefone', c.telefone,
          'status', c.status,
          'provider', c.provider,
          'provider_status', c.provider_status,
          'provider_detalhe', c.provider_detail_message,
          'provider_message_id', c.provider_message_id,
          'erro', c.error_message,
          'campaign_id', c.campanha_id,
          'campanha', c.campanha_nome,
          'fonte', 'campaign_send_log'
        ))                                                          AS event_data
      FROM c
      WHERE c.sent_at IS NOT NULL AND c.email IS NULL AND NOT c.is_wa AND c.texto IS NOT NULL

      UNION ALL
      SELECT
        'sms_delivered:' || c.id::text, 'mensagem', 'sms_entregue', c.delivered_at,
        'SMS entregue' || COALESCE(' · ' || c.campanha_nome, ''),
        c.texto, COALESCE(NULLIF(c.provider, ''), 'sms'), NULL::numeric,
        'campaign_send', c.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'mensagem', 'kind_label', 'SMS entregue', 'icon', '✅',
          'mensagem', c.texto, 'telefone', c.telefone, 'provider', c.provider,
          'provider_status', c.provider_status, 'provider_detalhe', c.provider_detail_message,
          'campaign_id', c.campanha_id, 'campanha', c.campanha_nome, 'fonte', 'campaign_send_log'
        ))
      FROM c
      WHERE c.delivered_at IS NOT NULL AND c.email IS NULL AND NOT c.is_wa

      -- WhatsApp Oficial (API Meta via Zernio)
      UNION ALL
      SELECT
        'wa_sent:' || c.id::text, 'mensagem', 'wa_oficial_enviado', c.sent_at,
        'WhatsApp Oficial enviado' || COALESCE(' · ' || c.campanha_nome, ''),
        c.texto, 'whatsapp_oficial', NULL::numeric, 'campaign_send', c.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'mensagem', 'kind_label', 'WhatsApp Oficial enviado', 'icon', '📲',
          'mensagem', c.texto, 'telefone', c.telefone, 'status', c.provider_status,
          'campaign_id', c.campanha_id, 'campanha', c.campanha_nome, 'fonte', 'campaign_send_log'
        ))
      FROM c
      WHERE c.is_wa AND c.sent_at IS NOT NULL

      UNION ALL
      SELECT
        'wa_delivered:' || c.id::text, 'mensagem', 'wa_oficial_entregue', c.delivered_at,
        'WhatsApp Oficial entregue' || COALESCE(' · ' || c.campanha_nome, ''),
        c.texto, 'whatsapp_oficial', NULL::numeric, 'campaign_send', c.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'mensagem', 'kind_label', 'WhatsApp Oficial entregue', 'icon', '✅',
          'telefone', c.telefone, 'campaign_id', c.campanha_id, 'campanha', c.campanha_nome,
          'fonte', 'campaign_send_log'
        ))
      FROM c
      WHERE c.is_wa AND c.delivered_at IS NOT NULL

      UNION ALL
      SELECT
        'wa_read:' || c.id::text, 'mensagem', 'wa_oficial_lido', c.opened_at,
        'WhatsApp Oficial lido' || COALESCE(' · ' || c.campanha_nome, ''),
        c.texto, 'whatsapp_oficial', NULL::numeric, 'campaign_send', c.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'mensagem', 'kind_label', 'WhatsApp Oficial lido', 'icon', '👀',
          'telefone', c.telefone, 'campaign_id', c.campanha_id, 'campanha', c.campanha_nome,
          'fonte', 'campaign_send_log'
        ))
      FROM c
      WHERE c.is_wa AND c.opened_at IS NOT NULL

      UNION ALL
      SELECT
        'wa_refused:' || c.id::text, 'mensagem', 'wa_oficial_recusado', COALESCE(c.scheduled_at, c.created_at),
        'WhatsApp Oficial não entregue (Meta)' || COALESCE(' · ' || c.campanha_nome, ''),
        c.error_message, 'whatsapp_oficial', NULL::numeric, 'campaign_send', c.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'mensagem', 'kind_label', 'WhatsApp Oficial não entregue', 'icon', '⚠️',
          'telefone', c.telefone, 'erro', c.error_message, 'mensagem', c.texto,
          'campaign_id', c.campanha_id, 'campanha', c.campanha_nome, 'fonte', 'campaign_send_log'
        ))
      FROM c
      -- Só recusas da Meta (código numérico); falhas internas antes do envio não chegaram ao lead.
      WHERE c.is_wa AND c.status = 'failed' AND c.error_message ~ '^[0-9]{5,6} '

      -- E-mail de campanha
      UNION ALL
      SELECT
        'email_sent:' || c.id::text, 'email', 'email_enviado', c.sent_at,
        'E-mail enviado' || COALESCE(' · ' || c.campanha_nome, ''),
        COALESCE(NULLIF(c.subject_snapshot, ''), NULLIF(c.content_sent, '')), 'email', NULL::numeric,
        'campaign_send', c.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'email', 'kind_label', 'E-mail enviado', 'icon', '📧',
          'assunto', c.subject_snapshot, 'email', c.email,
          'mensagem', left(COALESCE(c.content_sent, ''), 4000),
          'campaign_id', c.campanha_id, 'campanha', c.campanha_nome, 'status', c.status,
          'erro', c.error_message, 'fonte', 'campaign_send_log'
        ))
      FROM c
      WHERE c.sent_at IS NOT NULL AND c.email IS NOT NULL

      UNION ALL
      SELECT
        'email_open:' || c.id::text, 'email', 'email_aberto', c.opened_at,
        'E-mail aberto' || COALESCE(' · ' || c.campanha_nome, ''),
        NULLIF(c.subject_snapshot, ''), 'email', NULL::numeric,
        'campaign_send', c.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'email', 'kind_label', 'E-mail aberto', 'icon', '👀',
          'assunto', c.subject_snapshot, 'email', c.email,
          'campaign_id', c.campanha_id, 'campanha', c.campanha_nome, 'fonte', 'campaign_send_log'
        ))
      FROM c
      WHERE c.opened_at IS NOT NULL AND c.email IS NOT NULL

      UNION ALL
      SELECT
        'email_click:' || c.id::text, 'email', 'email_clicado', c.clicked_at,
        'Clique no e-mail' || COALESCE(' · ' || c.campanha_nome, ''),
        NULLIF(c.subject_snapshot, ''), 'email', NULL::numeric,
        'campaign_send', c.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'email', 'kind_label', 'Clique no e-mail', 'icon', '🖱️',
          'assunto', c.subject_snapshot, 'cliques', c.click_count, 'email', c.email,
          'campaign_id', c.campanha_id, 'campanha', c.campanha_nome, 'fonte', 'campaign_send_log'
        ))
      FROM c
      WHERE c.clicked_at IS NOT NULL AND c.email IS NOT NULL

      UNION ALL
      SELECT
        'email_link:' || s.id::text, 'email', 'email_link_aberto', s.first_click_at,
        'Abriu link do e-mail' || COALESCE(' · ' || c.campanha_nome, ''),
        s.destination_url, 'email', s.click_count::numeric,
        'short_link', s.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'email', 'kind_label', 'Abriu link do e-mail', 'icon', '🔗',
          'link', s.destination_url, 'cliques', s.click_count, 'ultimo_clique', s.last_click_at,
          'assunto', c.subject_snapshot, 'campaign_id', c.campanha_id, 'campanha', c.campanha_nome,
          'fonte', 'short_links'
        ))
      FROM public.short_links s
      JOIN c ON c.id = s.send_log_id
      WHERE s.lead_id = p_lead_id AND s.first_click_at IS NOT NULL AND c.email IS NOT NULL

      UNION ALL
      SELECT
        'email_bounce:' || c.id::text, 'email', 'email_bounce', c.bounced_at,
        'E-mail retornado' || COALESCE(' · ' || c.campanha_nome, ''),
        COALESCE(NULLIF(c.bounce_reason, ''), NULLIF(c.subject_snapshot, '')),
        'email', NULL::numeric, 'campaign_send', c.id::text,
        jsonb_strip_nulls(jsonb_build_object(
          'kind', 'email', 'kind_label', 'E-mail retornado', 'icon', '⚠️',
          'motivo', c.bounce_reason, 'email', c.email,
          'campaign_id', c.campanha_id, 'campanha', c.campanha_nome, 'fonte', 'campaign_send_log'
        ))
      FROM c
      WHERE c.bounced_at IS NOT NULL
    ) canais

    UNION ALL

    SELECT
      'seqmail:' || d.id::text,
      'email',
      'email_sequencia',
      COALESCE(d.dispatched_at, d.scheduled_for, d.created_at),
      'E-mail de sequência',
      NULLIF(s.subject_template, ''),
      'email',
      NULL::numeric,
      'email_sequence_dispatch',
      d.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'kind', 'email', 'kind_label', 'E-mail de sequência', 'icon', '📧',
        'assunto', s.subject_template, 'etapa', s.step_order, 'status', d.status,
        'fonte', 'email_sequence_dispatches'
      ))
    FROM public.email_sequence_dispatches d
    LEFT JOIN public.email_sequence_steps s ON s.id = d.step_id
    WHERE d.lead_id = p_lead_id
      AND COALESCE(d.dispatched_at, d.scheduled_for, d.created_at) IS NOT NULL

    UNION ALL

    SELECT
      'lia:' || a.id::text,
      'agente',
      'lia_conversa',
      a.created_at,
      'Conversa com a Dra. LIA',
      NULLIF(a.user_message, ''),
      'dra_lia',
      NULL::numeric,
      'agent_interaction',
      a.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'kind', 'agente', 'kind_label', 'Conversa com a Dra. LIA', 'icon', '🤖',
        'mensagem', left(COALESCE(a.user_message, ''), 4000),
        'resposta', left(COALESCE(a.agent_response, ''), 4000),
        'idioma', a.lang,
        'sessao', a.session_id,
        'similaridade', a.top_similarity,
        'sem_resposta', a.unanswered,
        'feedback', a.feedback,
        'fonte', 'agent_interactions'
      ))
    FROM public.agent_interactions a
    WHERE a.lead_id = p_lead_id AND a.created_at IS NOT NULL

    UNION ALL

    SELECT
      'nps:' || n.id::text,
      'nps',
      'nps_respondido',
      n.created_at,
      'NPS respondido'
        || COALESCE(' — ' || n.score_recomendacao::text || '/10', ''),
      NULLIF(n.comment, ''),
      'nps',
      n.score_recomendacao::numeric,
      'nps_response',
      n.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'kind', 'nps', 'kind_label', 'NPS respondido', 'icon', '⭐',
        'score_satisfacao', n.score_satisfacao,
        'score_treinamentos', n.score_treinamentos,
        'score_recomendacao', n.score_recomendacao,
        'comment', n.comment,
        'course_id', n.course_id,
        'enrollment_id', n.enrollment_id,
        'fonte', 'smartops_nps_responses'
      ))
    FROM public.smartops_nps_responses n
    WHERE n.lead_id = p_lead_id AND n.created_at IS NOT NULL

    UNION ALL

    SELECT
      'view:' || v.id::text,
      'conteudo',
      'page_view',
      COALESCE(v.viewed_at, v.created_at),
      COALESCE(NULLIF(v.extra_data->>'content_title',''), NULLIF(v.page_title, ''), NULLIF(v.page_path, ''), 'Visita'),
      NULLIF(v.page_path, ''),
      COALESCE(NULLIF(v.utm_source, ''), 'site'),
      NULL::numeric,
      'page_view',
      v.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'kind', 'conteudo',
        'kind_label', CASE WHEN v.page_type ILIKE '%knowledge%' OR v.page_type ILIKE 'kb!_%' ESCAPE '!' OR v.page_path ILIKE '%base-conhecimento%'
                           THEN 'Base de Conhecimento' ELSE 'Visita no site' END,
        'icon', '📚',
        'page_type', v.page_type,
        'page_path', v.page_path,
        'utm_source', v.utm_source,
        'utm_campaign', v.utm_campaign,
        'device', v.device_type,
        'fonte', 'lead_page_views',
        'action', v.extra_data->>'action',
        'content_type', v.extra_data->>'content_type',
        'content_slug', v.extra_data->>'content_slug'
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

CREATE OR REPLACE FUNCTION public.fn_wa_official_apply_recipients(p_session uuid, p_broadcast text, p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n integer;
BEGIN
  WITH r AS (
    SELECT regexp_replace(x->>'phone', '\D', '', 'g') AS phone,
           x->>'status' AS st,
           NULLIF(x->>'sent_at', '')::timestamptz AS sent_at,
           NULLIF(x->>'delivered_at', '')::timestamptz AS delivered_at,
           NULLIF(x->>'read_at', '')::timestamptz AS read_at,
           NULLIF(x->>'message_id', '') AS message_id,
           NULLIF(x->>'error', '') AS error
    FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) x
  )
  UPDATE public.campaign_send_log l SET
    status          = CASE WHEN r.st = 'failed' THEN 'failed' ELSE 'sent' END,
    sent_at         = CASE WHEN r.st = 'failed' THEN NULL ELSE COALESCE(r.sent_at, l.sent_at) END,
    delivered_at    = COALESCE(r.delivered_at, l.delivered_at),
    opened_at       = COALESCE(r.read_at, l.opened_at),
    wa_message_id   = COALESCE(r.message_id, l.wa_message_id),
    provider_status = r.st,
    error_message   = CASE WHEN r.st = 'failed' THEN COALESCE(r.error, l.error_message) ELSE l.error_message END
  FROM r
  WHERE l.campaign_id = p_session
    AND l.provider_message_id = p_broadcast
    AND l.telefone = r.phone
    AND r.st IN ('sent','delivered','read','failed')
    AND (l.provider_status IS DISTINCT FROM r.st
         OR l.delivered_at IS DISTINCT FROM COALESCE(r.delivered_at, l.delivered_at)
         OR l.opened_at IS DISTINCT FROM COALESCE(r.read_at, l.opened_at)
         OR l.sent_at IS DISTINCT FROM CASE WHEN r.st = 'failed' THEN NULL ELSE COALESCE(r.sent_at, l.sent_at) END);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_wa_official_apply_recipients(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_wa_official_apply_recipients(uuid, text, jsonb) TO service_role;