
SET lock_timeout = '5s';

-- ═══ 1. Resolver de identidade (pessoa/empresa) a partir do lead ═══
CREATE OR REPLACE FUNCTION public.resolve_lead_identity(p_lead_id uuid)
RETURNS TABLE(person_id uuid, company_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead   record;
  v_person uuid;
  v_company uuid;
  v_cnpj   text;
BEGIN
  IF p_lead_id IS NULL THEN RETURN; END IF;

  -- CDP Integrity: sempre resolver contra o lead canônico
  SELECT l.id, l.email, l.telefone_normalized, l.pessoa_piperun_id, l.empresa_piperun_id, l.empresa_cnpj
    INTO v_lead
  FROM public.lia_attendances l
  WHERE l.id = COALESCE(
    (SELECT x.merged_into FROM public.lia_attendances x WHERE x.id = p_lead_id),
    p_lead_id
  );

  IF v_lead.id IS NULL THEN RETURN; END IF;

  -- Pessoa: piperun_person_id > email > telefone
  IF v_lead.pessoa_piperun_id IS NOT NULL THEN
    SELECT p.id, p.primary_company_id INTO v_person, v_company
    FROM public.people p
    WHERE p.piperun_person_id = v_lead.pessoa_piperun_id::text LIMIT 1;
  END IF;

  IF v_person IS NULL AND NULLIF(btrim(COALESCE(v_lead.email, '')), '') IS NOT NULL THEN
    SELECT p.id, p.primary_company_id INTO v_person, v_company
    FROM public.people p
    WHERE lower(p.email) = lower(btrim(v_lead.email)) LIMIT 1;
  END IF;

  IF v_person IS NULL AND NULLIF(btrim(COALESCE(v_lead.telefone_normalized, '')), '') IS NOT NULL THEN
    SELECT p.id, p.primary_company_id INTO v_person, v_company
    FROM public.people p
    WHERE p.telefone_normalized = v_lead.telefone_normalized LIMIT 1;
  END IF;

  -- Empresa: piperun_company_id > cnpj > primary_company_id da pessoa
  IF v_lead.empresa_piperun_id IS NOT NULL THEN
    SELECT c.id INTO v_company
    FROM public.companies c
    WHERE c.piperun_company_id = v_lead.empresa_piperun_id::text LIMIT 1;
  END IF;

  IF v_company IS NULL THEN
    v_cnpj := NULLIF(regexp_replace(COALESCE(v_lead.empresa_cnpj, ''), '\D', '', 'g'), '');
    IF v_cnpj IS NOT NULL THEN
      SELECT c.id INTO v_company
      FROM public.companies c
      WHERE regexp_replace(COALESCE(c.cnpj, ''), '\D', '', 'g') = v_cnpj LIMIT 1;
    END IF;
  END IF;

  person_id := v_person;
  company_id := v_company;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_lead_identity(uuid) FROM anon;

-- Trigger: preenche person_id/company_id em TODO evento novo
CREATE OR REPLACE FUNCTION public.fn_lal_fill_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r record;
BEGIN
  IF NEW.lead_id IS NOT NULL AND (NEW.person_id IS NULL OR NEW.company_id IS NULL) THEN
    SELECT * INTO r FROM public.resolve_lead_identity(NEW.lead_id);
    NEW.person_id := COALESCE(NEW.person_id, r.person_id);
    NEW.company_id := COALESCE(NEW.company_id, r.company_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lal_fill_identity ON public.lead_activity_log;
CREATE TRIGGER trg_lal_fill_identity
BEFORE INSERT ON public.lead_activity_log
FOR EACH ROW EXECUTE FUNCTION public.fn_lal_fill_identity();

-- ═══ 2. Evento field_enriched ═══
CREATE OR REPLACE FUNCTION public.fn_log_field_enriched()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fields  text[] := ARRAY[
    'area_atuacao','especialidade','produto_interesse','tem_scanner','tem_impressora',
    'scanner_marca','impressora_modelo','software_cad',
    'equip_scanner','equip_scanner_bancada','equip_impressora','equip_cad',
    'equip_pos_impressao','equip_fresadora','equip_notebook',
    'empresa_cnpj','email','telefone_normalized'
  ];
  f          text;
  v_old      text;
  v_new      text;
  v_changed  jsonb := '{}'::jsonb;
  v_names    text[] := '{}';
  o          jsonb := to_jsonb(OLD);
  n          jsonb := to_jsonb(NEW);
BEGIN
  IF NEW.merged_into IS NOT NULL THEN RETURN NEW; END IF;

  FOREACH f IN ARRAY v_fields LOOP
    v_old := NULLIF(btrim(COALESCE(o ->> f, '')), '');
    v_new := NULLIF(btrim(COALESCE(n ->> f, '')), '');
    IF v_old IS NULL AND v_new IS NOT NULL THEN
      v_changed := v_changed || jsonb_build_object(f, v_new);
      v_names := v_names || f;
    END IF;
  END LOOP;

  IF array_length(v_names, 1) IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.lead_activity_log (
    lead_id, event_type, entity_type, entity_name, event_data, source_channel, event_timestamp
  ) VALUES (
    NEW.id, 'field_enriched', 'lead',
    array_to_string(v_names, ', '),
    jsonb_build_object(
      'fields', v_names,
      'values', v_changed,
      'source', COALESCE(NEW.source, 'sistema'),
      'form_name', NEW.form_name
    ),
    COALESCE(NEW.source, 'sistema'), now()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_field_enriched ON public.lia_attendances;
CREATE TRIGGER trg_log_field_enriched
AFTER UPDATE ON public.lia_attendances
FOR EACH ROW EXECUTE FUNCTION public.fn_log_field_enriched();

-- ═══ 3. Evento whatsapp_message_received ═══
CREATE OR REPLACE FUNCTION public.fn_log_inbound_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_wa boolean;
BEGIN
  IF NEW.lead_id IS NULL OR NULLIF(btrim(COALESCE(NEW.user_message, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;

  -- session_id só com dígitos = sessão WhatsApp (convenção do projeto)
  v_is_wa := COALESCE(NEW.session_id, '') ~ '^\d{10,15}$';

  INSERT INTO public.lead_activity_log (
    lead_id, event_type, entity_type, entity_id, entity_name,
    event_data, source_channel, event_timestamp
  ) VALUES (
    NEW.lead_id,
    CASE WHEN v_is_wa THEN 'whatsapp_message_received' ELSE 'chat_message_received' END,
    'message', NEW.id::text, 'Mensagem do lead',
    jsonb_build_object(
      'session_id', NEW.session_id,
      'preview', left(NEW.user_message, 280),
      'lang', NEW.lang,
      'unanswered', NEW.unanswered
    ),
    CASE WHEN v_is_wa THEN 'whatsapp' ELSE 'webchat' END,
    COALESCE(NEW.created_at, now())
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_inbound_message ON public.agent_interactions;
CREATE TRIGGER trg_log_inbound_message
AFTER INSERT ON public.agent_interactions
FOR EACH ROW EXECUTE FUNCTION public.fn_log_inbound_message();

-- ═══ 4. Backfill em lotes de person_id/company_id no histórico ═══
CREATE OR REPLACE FUNCTION public.backfill_activity_identity(p_limit integer DEFAULT 5000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated integer := 0;
  v_scanned integer := 0;
BEGIN
  WITH batch AS (
    SELECT id, lead_id
    FROM public.lead_activity_log
    WHERE person_id IS NULL AND lead_id IS NOT NULL
    ORDER BY event_timestamp DESC
    LIMIT GREATEST(1, LEAST(p_limit, 20000))
  ),
  resolved AS (
    SELECT b.id, r.person_id, r.company_id
    FROM batch b
    CROSS JOIN LATERAL public.resolve_lead_identity(b.lead_id) r
  ),
  upd AS (
    UPDATE public.lead_activity_log lal
    SET person_id = COALESCE(lal.person_id, resolved.person_id),
        company_id = COALESCE(lal.company_id, resolved.company_id)
    FROM resolved
    WHERE lal.id = resolved.id
      AND (resolved.person_id IS NOT NULL OR resolved.company_id IS NOT NULL)
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM batch), (SELECT count(*) FROM upd)
    INTO v_scanned, v_updated;

  RETURN jsonb_build_object('scanned', v_scanned, 'updated', v_updated);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.backfill_activity_identity(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.backfill_activity_identity(integer) FROM authenticated;

-- ═══ 5. Índices de apoio (por último, para minimizar contenção de lock) ═══
CREATE INDEX IF NOT EXISTS idx_people_piperun_person_id ON public.people(piperun_person_id) WHERE piperun_person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_email_lower ON public.people(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_phone ON public.people(telefone_normalized) WHERE telefone_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_piperun_company_id ON public.companies(piperun_company_id) WHERE piperun_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON public.companies(cnpj) WHERE cnpj IS NOT NULL;
