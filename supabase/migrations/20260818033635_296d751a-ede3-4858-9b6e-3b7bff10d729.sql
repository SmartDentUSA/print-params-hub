CREATE OR REPLACE FUNCTION public.fn_push_audience(p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(subscription_id uuid, lead_id uuid, endpoint text, p256dh text, auth text, nome text, cidade text, produto_interesse text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.id, l.id, s.endpoint, s.p256dh, s.auth, l.nome, l.cidade,
         COALESCE(l.produto_interesse, l.produto_interesse_auto)
  FROM public.push_subscriptions s
  JOIN public.lia_attendances l ON l.id = s.lead_id
  WHERE s.enabled
    AND l.merged_into IS NULL
    AND (p_filters->>'online_only' IS NULL
         OR p_filters->>'online_only' NOT IN ('1','true','yes')
         OR s.last_seen_at >= now() - interval '30 minutes'
         OR EXISTS (
              SELECT 1 FROM public.client_access_invites ci
              WHERE ci.lead_id = l.id
                AND ci.last_seen_at >= now() - interval '30 minutes'
            ))
    AND (p_filters->>'platform' IS NULL OR s.platform = p_filters->>'platform')
    AND (p_filters->>'produto_interesse' IS NULL
         OR COALESCE(l.produto_interesse,'') ILIKE '%'||(p_filters->>'produto_interesse')||'%'
         OR COALESCE(l.produto_interesse_auto,'') ILIKE '%'||(p_filters->>'produto_interesse')||'%')
    AND (p_filters->>'temperatura_lead' IS NULL OR l.temperatura_lead = p_filters->>'temperatura_lead')
    AND (p_filters->>'piperun_stage_name' IS NULL OR l.piperun_stage_name = p_filters->>'piperun_stage_name')
    AND (p_filters->>'piperun_pipeline_name' IS NULL OR l.piperun_pipeline_name = p_filters->>'piperun_pipeline_name')
    AND (p_filters->>'especialidade' IS NULL OR l.especialidade = p_filters->>'especialidade')
    AND (p_filters->>'area_atuacao' IS NULL OR l.area_atuacao = p_filters->>'area_atuacao')
    AND (p_filters->>'uf' IS NULL OR l.uf = p_filters->>'uf')
    AND (p_filters->>'cidade' IS NULL OR COALESCE(l.cidade,'') ILIKE '%'||(p_filters->>'cidade')||'%')
    AND (p_filters->>'proprietario_lead_crm' IS NULL OR l.proprietario_lead_crm = p_filters->>'proprietario_lead_crm')
    AND (p_filters->>'real_status' IS NULL OR l.real_status = p_filters->>'real_status')
    AND (p_filters->>'origem_primeiro_contato' IS NULL OR l.origem_primeiro_contato = p_filters->>'origem_primeiro_contato')
    AND (p_filters->>'form_name' IS NULL OR l.form_name = p_filters->>'form_name')
    AND (p_filters->>'tem_scanner' IS NULL
         OR (p_filters->>'tem_scanner' = 'yes' AND lower(COALESCE(l.tem_scanner,'')) IN ('sim','true','yes','1'))
         OR (p_filters->>'tem_scanner' = 'no' AND lower(COALESCE(l.tem_scanner,'')) NOT IN ('sim','true','yes','1')))
    AND (p_filters->>'tem_printer' IS NULL
         OR (p_filters->>'tem_printer' = 'yes' AND lower(COALESCE(l.tem_impressora,'')) IN ('sim','true','yes','1'))
         OR (p_filters->>'tem_printer' = 'no' AND lower(COALESCE(l.tem_impressora,'')) NOT IN ('sim','true','yes','1')))
    AND (p_filters->>'cliente_filter' IS NULL
         OR (p_filters->>'cliente_filter' = 'clientes' AND COALESCE(l.total_deals_all,0) > 0)
         OR (p_filters->>'cliente_filter' = 'leads' AND COALESCE(l.total_deals_all,0) = 0))
    AND (p_filters->>'recencia_dias' IS NULL
         OR l.updated_at >= now() - ((p_filters->>'recencia_dias')::int || ' days')::interval)
    AND (p_filters->>'ltv_min' IS NULL OR COALESCE(l.ltv_total,0) >= (p_filters->>'ltv_min')::numeric)
    AND (p_filters->>'score_min' IS NULL OR COALESCE(l.intelligence_score_total,0) >= (p_filters->>'score_min')::numeric)
    AND COALESCE(l.do_not_contact, false) IS FALSE
$function$;