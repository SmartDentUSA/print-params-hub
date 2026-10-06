
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS youtube_url text;

CREATE TABLE public.email_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  source text NOT NULL DEFAULT 'leads',
  definition jsonb NOT NULL DEFAULT '{"match":"all","rules":[]}'::jsonb,
  last_count integer,
  last_counted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_audiences TO authenticated;
GRANT ALL ON public.email_audiences TO service_role;
ALTER TABLE public.email_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manages audiences" ON public.email_audiences FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.email_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  origin_type text NOT NULL DEFAULT 'audience',
  audience_id uuid REFERENCES public.email_audiences(id) ON DELETE SET NULL,
  trigger_type text,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  exit_rules jsonb NOT NULL DEFAULT '{"deal_won":true,"new_form":false,"stage_change":false}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  activated_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_flows TO authenticated;
GRANT ALL ON public.email_flows TO service_role;
ALTER TABLE public.email_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manages flows" ON public.email_flows FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.email_flow_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.email_flows(id) ON DELETE CASCADE,
  contact_type text NOT NULL DEFAULT 'lead',
  lead_id uuid,
  distributor_id uuid,
  nome text,
  email text,
  phone text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL,
  current_node_id text,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  exit_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flow_id, dedupe_key)
);
CREATE INDEX email_flow_enr_due_idx ON public.email_flow_enrollments (next_run_at) WHERE status = 'active';
CREATE INDEX email_flow_enr_lead_idx ON public.email_flow_enrollments (lead_id);
GRANT SELECT, UPDATE, DELETE ON public.email_flow_enrollments TO authenticated;
GRANT ALL ON public.email_flow_enrollments TO service_role;
ALTER TABLE public.email_flow_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team reads enrollments" ON public.email_flow_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "team updates enrollments" ON public.email_flow_enrollments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team deletes enrollments" ON public.email_flow_enrollments FOR DELETE TO authenticated USING (true);

CREATE TABLE public.email_flow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.email_flows(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.email_flow_enrollments(id) ON DELETE CASCADE,
  node_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_flow_events_enr_idx ON public.email_flow_events (enrollment_id, event_type);
CREATE INDEX email_flow_events_flow_idx ON public.email_flow_events (flow_id, created_at DESC);
GRANT SELECT ON public.email_flow_events TO authenticated;
GRANT ALL ON public.email_flow_events TO service_role;
ALTER TABLE public.email_flow_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team reads flow events" ON public.email_flow_events FOR SELECT TO authenticated USING (true);

CREATE TABLE public.email_flow_runner_state (
  id integer PRIMARY KEY,
  locked_until timestamptz,
  paused_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.email_flow_runner_state (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT ON public.email_flow_runner_state TO authenticated;
GRANT ALL ON public.email_flow_runner_state TO service_role;
ALTER TABLE public.email_flow_runner_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team reads runner state" ON public.email_flow_runner_state FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_email_audiences_upd BEFORE UPDATE ON public.email_audiences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_email_flows_upd BEFORE UPDATE ON public.email_flows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_email_flow_enr_upd BEFORE UPDATE ON public.email_flow_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ───────────── Audience SQL builder (parametrized via format/%L/%I) ─────────────
CREATE OR REPLACE FUNCTION public.fn_audience_where(_def jsonb)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r jsonb; t text; parts text[] := '{}'; c text; joiner text;
  src text := coalesce(_def->>'source','leads');
  vals text[]; op text; col text; v text;
  date_from text; date_to text;
BEGIN
  joiner := CASE WHEN coalesce(_def->>'match','all') = 'any' THEN ' OR ' ELSE ' AND ' END;
  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(_def->'rules','[]'::jsonb)) LOOP
    t := r->>'type'; c := NULL;
    date_from := nullif(r->>'from',''); date_to := nullif(r->>'to','');
    vals := ARRAY(SELECT jsonb_array_elements_text(coalesce(r->'values','[]'::jsonb)));
    IF src = 'distributors' THEN
      IF t = 'dist_country' AND array_length(vals,1) > 0 THEN c := format('d.pais = ANY(%L::text[])', vals);
      ELSIF t = 'dist_state' AND array_length(vals,1) > 0 THEN c := format('d.estado = ANY(%L::text[])', vals);
      ELSIF t = 'dist_active' THEN c := format('coalesce(d.active,false) = %L::boolean', coalesce(r->>'value','true'));
      ELSIF t = 'dist_tipo' AND array_length(vals,1) > 0 THEN c := format('d.tipo = ANY(%L::text[])', vals);
      END IF;
    ELSE
      IF t = 'created_between' THEN
        c := 'true' || coalesce(format(' AND l.created_at >= %L::timestamptz', date_from),'') || coalesce(format(' AND l.created_at < (%L::date + 1)', date_to),'');
      ELSIF t = 'form' AND array_length(vals,1) > 0 THEN
        c := format('(l.form_name = ANY(%1$L::text[]) OR EXISTS (SELECT 1 FROM lead_form_submissions s WHERE s.lead_id = l.id AND (s.form_data->>''form_name'') = ANY(%1$L::text[])%2$s%3$s))',
          vals, coalesce(format(' AND s.submitted_at >= %L::timestamptz', date_from),''), coalesce(format(' AND s.submitted_at < (%L::date + 1)', date_to),''));
      ELSIF t = 'campaign' AND array_length(vals,1) > 0 THEN
        c := format('l.utm_campaign ILIKE ANY(%L::text[])', ARRAY(SELECT '%'||x||'%' FROM unnest(vals) x));
      ELSIF t = 'pipeline' THEN
        c := 'EXISTS (SELECT 1 FROM deals dd WHERE dd.lead_id = l.id AND coalesce(dd.is_deleted,false) = false'
          || coalesce(format(' AND dd.pipeline_name = %L', nullif(r->>'pipeline',''))
          ,'') || coalesce(format(' AND dd.stage_name = %L', nullif(r->>'stage','')),'')
          || coalesce(format(' AND dd.status = %L', nullif(r->>'status','')),'') || ')';
      ELSIF t = 'stage_entered' THEN
        c := 'EXISTS (SELECT 1 FROM piperun_stage_transitions st WHERE st.lead_id = l.id'
          || coalesce(format(' AND st.pipeline_name = %L', nullif(r->>'pipeline','')),'')
          || coalesce(format(' AND st.stage_to_name = %L', nullif(r->>'stage','')),'')
          || coalesce(format(' AND st.transitioned_at >= %L::timestamptz', date_from),'')
          || coalesce(format(' AND st.transitioned_at < (%L::date + 1)', date_to),'') || ')';
      ELSIF t = 'training' THEN
        c := 'EXISTS (SELECT 1 FROM smartops_course_enrollments ce WHERE ce.lead_id = l.id'
          || coalesce(format(' AND ce.course_id = %L::uuid', nullif(r->>'course_id','')),'')
          || coalesce(format(' AND ce.turma_id = %L::uuid', nullif(r->>'turma_id','')),'')
          || coalesce(format(' AND ce.status = %L', nullif(r->>'status','')),'') || ')';
      ELSIF t = 'origin' AND array_length(vals,1) > 0 THEN
        c := format('l.origem_primeiro_contato = ANY(%L::text[])', vals);
      ELSIF t = 'equipment_won' THEN
        c := format('EXISTS (SELECT 1 FROM deal_items di JOIN deals dw ON dw.lead_id = di.lead_id AND dw.piperun_deal_id::text = di.deal_id::text AND dw.status = ''ganha'' WHERE di.lead_id = l.id AND (coalesce(di.product_name, di.nome_produto, '''') || '' '' || coalesce(di.product_category,'''') || '' '' || coalesce(di.product_subcategory,'''')) ILIKE ANY(%L::text[]))',
          ARRAY(SELECT '%'||x||'%' FROM unnest(CASE WHEN array_length(vals,1) > 0 THEN vals ELSE ARRAY[coalesce(r->>'category','scanner')] END) x));
      ELSIF t = 'resin_buyer' THEN
        c := 'EXISTS (SELECT 1 FROM deal_items di JOIN deals dw ON dw.lead_id = di.lead_id AND dw.piperun_deal_id::text = di.deal_id::text AND dw.status = ''ganha'' WHERE di.lead_id = l.id AND (coalesce(di.product_category,'''') ILIKE ''%resin%'' OR coalesce(di.product_name, di.nome_produto, '''') ILIKE ''%resina%'')'
          || CASE WHEN array_length(vals,1) > 0 THEN format(' AND coalesce(di.product_name, di.nome_produto, '''') ILIKE ANY(%L::text[])', ARRAY(SELECT '%'||x||'%' FROM unnest(vals) x)) ELSE '' END || ')';
      ELSIF t = 'field' THEN
        col := r->>'column'; op := coalesce(r->>'op','eq'); v := r->>'value';
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lia_attendances' AND column_name = col) THEN
          RAISE EXCEPTION 'Campo inválido: %', col;
        END IF;
        c := CASE op
          WHEN 'eq' THEN format('l.%I::text = %L', col, v)
          WHEN 'neq' THEN format('l.%I::text IS DISTINCT FROM %L', col, v)
          WHEN 'contains' THEN format('l.%I::text ILIKE %L', col, '%'||coalesce(v,'')||'%')
          WHEN 'not_contains' THEN format('coalesce(l.%I::text,'''') NOT ILIKE %L', col, '%'||coalesce(v,'')||'%')
          WHEN 'gt' THEN format('l.%I > %L', col, v)
          WHEN 'gte' THEN format('l.%I >= %L', col, v)
          WHEN 'lt' THEN format('l.%I < %L', col, v)
          WHEN 'lte' THEN format('l.%I <= %L', col, v)
          WHEN 'is_null' THEN format('l.%I IS NULL', col)
          WHEN 'not_null' THEN format('l.%I IS NOT NULL', col)
          WHEN 'is_true' THEN format('l.%I::text = ''true''', col)
          WHEN 'is_false' THEN format('coalesce(l.%I::text,''false'') = ''false''', col)
          ELSE NULL END;
      END IF;
    END IF;
    IF c IS NOT NULL THEN parts := parts || ('(' || c || ')'); END IF;
  END LOOP;
  IF array_length(parts,1) IS NULL THEN RETURN 'true'; END IF;
  RETURN '(' || array_to_string(parts, joiner) || ')';
END $$;

CREATE OR REPLACE FUNCTION public.fn_audience_resolve(_def jsonb, _limit integer DEFAULT 20, _offset integer DEFAULT 0)
RETURNS TABLE(contact_type text, contact_id uuid, nome text, email text, phone text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '25s' AS $$
DECLARE w text := public.fn_audience_where(_def);
BEGIN
  IF auth.role() NOT IN ('authenticated','service_role') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF coalesce(_def->>'source','leads') = 'distributors' THEN
    RETURN QUERY EXECUTE format('SELECT ''distributor''::text, d.id, coalesce(d.nome_fantasia, d.razao_social, d.owner_name), coalesce(nullif(d.owner_email,''''), d.buyer_email), nullif(regexp_replace(coalesce(d.owner_whatsapp_ddi,'''') || coalesce(d.owner_whatsapp,''''), ''\D'', '''', ''g''), '''') FROM distributors d WHERE %s ORDER BY d.created_at DESC LIMIT %s OFFSET %s', w, greatest(_limit,0), greatest(_offset,0));
  ELSE
    RETURN QUERY EXECUTE format('SELECT ''lead''::text, l.id, l.nome, l.email, l.telefone_normalized FROM lia_attendances l WHERE l.merged_into IS NULL AND %s ORDER BY l.created_at DESC LIMIT %s OFFSET %s', w, greatest(_limit,0), greatest(_offset,0));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_audience_count(_def jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '25s' AS $$
DECLARE w text := public.fn_audience_where(_def); total bigint; with_email bigint; with_phone bigint;
BEGIN
  IF auth.role() NOT IN ('authenticated','service_role') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF coalesce(_def->>'source','leads') = 'distributors' THEN
    EXECUTE format('SELECT count(*), count(*) FILTER (WHERE coalesce(nullif(d.owner_email,''''), d.buyer_email) IS NOT NULL), count(*) FILTER (WHERE d.owner_whatsapp IS NOT NULL) FROM distributors d WHERE %s', w) INTO total, with_email, with_phone;
  ELSE
    EXECUTE format('SELECT count(*), count(*) FILTER (WHERE l.email IS NOT NULL AND l.email <> '''' AND coalesce(l.email_bounced,false) = false), count(*) FILTER (WHERE l.telefone_normalized IS NOT NULL) FROM lia_attendances l WHERE l.merged_into IS NULL AND %s', w) INTO total, with_email, with_phone;
  END IF;
  RETURN jsonb_build_object('total', total, 'with_email', with_email, 'with_phone', with_phone);
END $$;

-- ───────────── Enrollment helpers ─────────────
CREATE OR REPLACE FUNCTION public.fn_email_flow_enroll_audience(_flow uuid, _limit integer DEFAULT 2000)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '50s' AS $$
DECLARE f record; def jsonb; n integer;
BEGIN
  SELECT fl.*, a.definition AS adef, a.source AS asrc INTO f FROM email_flows fl JOIN email_audiences a ON a.id = fl.audience_id WHERE fl.id = _flow AND fl.status = 'active' AND fl.origin_type = 'audience';
  IF NOT FOUND THEN RETURN 0; END IF;
  def := f.adef || jsonb_build_object('source', f.asrc);
  INSERT INTO email_flow_enrollments (flow_id, contact_type, lead_id, distributor_id, nome, email, phone, dedupe_key, next_run_at)
  SELECT _flow, x.contact_type, CASE WHEN x.contact_type='lead' THEN x.contact_id END, CASE WHEN x.contact_type='distributor' THEN x.contact_id END,
         x.nome, x.email, x.phone, x.contact_type || ':' || x.contact_id, now()
  FROM public.fn_audience_resolve(def, _limit, 0) x
  ON CONFLICT (flow_id, dedupe_key) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.fn_email_flow_fire(_trigger text, _lead uuid, _ctx jsonb, _dedupe text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l record; f record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM email_flows WHERE status='active' AND origin_type='trigger' AND trigger_type=_trigger) THEN RETURN; END IF;
  SELECT id, nome, email, telefone_normalized, merged_into INTO l FROM lia_attendances WHERE id = _lead;
  IF l.merged_into IS NOT NULL THEN SELECT id, nome, email, telefone_normalized, merged_into INTO l FROM lia_attendances WHERE id = l.merged_into; END IF;
  FOR f IN SELECT * FROM email_flows WHERE status='active' AND origin_type='trigger' AND trigger_type=_trigger LOOP
    IF nullif(f.trigger_config->>'course_id','') IS NOT NULL AND (_ctx->>'course_id') IS DISTINCT FROM (f.trigger_config->>'course_id') THEN CONTINUE; END IF;
    IF nullif(f.trigger_config->>'form_name','') IS NOT NULL AND (_ctx->>'form_name') IS DISTINCT FROM (f.trigger_config->>'form_name') THEN CONTINUE; END IF;
    IF nullif(f.trigger_config->>'stage','') IS NOT NULL AND (_ctx->>'stage') IS DISTINCT FROM (f.trigger_config->>'stage') THEN CONTINUE; END IF;
    IF nullif(f.trigger_config->>'pipeline','') IS NOT NULL AND (_ctx->>'pipeline') IS DISTINCT FROM (f.trigger_config->>'pipeline') THEN CONTINUE; END IF;
    INSERT INTO email_flow_enrollments (flow_id, contact_type, lead_id, nome, email, phone, context, dedupe_key)
    VALUES (f.id, 'lead', l.id, coalesce(_ctx->>'person_name', l.nome), l.email, l.telefone_normalized, coalesce(_ctx,'{}'::jsonb), _trigger || ':' || _dedupe)
    ON CONFLICT (flow_id, dedupe_key) DO NOTHING;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_email_flow_fire failed: %', SQLERRM;
END $$;

CREATE OR REPLACE FUNCTION public.trg_email_flow_from_enrollment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.fn_email_flow_fire('course_enrolled', NEW.lead_id, jsonb_build_object('enrollment_id', NEW.id, 'course_id', NEW.course_id, 'turma_id', NEW.turma_id, 'person_name', NEW.person_name), NEW.id::text);
  ELSIF NEW.certificate_pdf_path IS NOT NULL AND NEW.certificate_pdf_path IS DISTINCT FROM OLD.certificate_pdf_path THEN
    PERFORM public.fn_email_flow_fire('certificate_generated', NEW.lead_id, jsonb_build_object('enrollment_id', NEW.id, 'course_id', NEW.course_id, 'turma_id', NEW.turma_id, 'person_name', NEW.person_name, 'certificate_pdf_path', NEW.certificate_pdf_path), NEW.id::text || ':' || NEW.certificate_pdf_path);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_email_flow_enrollment AFTER INSERT OR UPDATE OF certificate_pdf_path ON public.smartops_course_enrollments FOR EACH ROW EXECUTE FUNCTION public.trg_email_flow_from_enrollment();

CREATE OR REPLACE FUNCTION public.trg_email_flow_from_form()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    PERFORM public.fn_email_flow_fire('form_submitted', NEW.lead_id, jsonb_build_object('form_name', NEW.form_data->>'form_name', 'form_id', NEW.form_id), NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_email_flow_form AFTER INSERT ON public.lead_form_submissions FOR EACH ROW EXECUTE FUNCTION public.trg_email_flow_from_form();

CREATE OR REPLACE FUNCTION public.trg_email_flow_from_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    PERFORM public.fn_email_flow_fire('stage_changed', NEW.lead_id, jsonb_build_object('pipeline', NEW.pipeline_name, 'stage', NEW.stage_to_name, 'deal_id', NEW.deal_id), NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_email_flow_stage AFTER INSERT ON public.piperun_stage_transitions FOR EACH ROW EXECUTE FUNCTION public.trg_email_flow_from_stage();

CREATE OR REPLACE FUNCTION public.trg_email_flow_from_deal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL AND NEW.status = 'ganha' AND OLD.status IS DISTINCT FROM 'ganha' THEN
    PERFORM public.fn_email_flow_fire('deal_won', NEW.lead_id, jsonb_build_object('pipeline', NEW.pipeline_name, 'stage', NEW.stage_name, 'deal_id', NEW.piperun_deal_id), coalesce(NEW.piperun_deal_id::text, NEW.id::text));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_email_flow_deal AFTER UPDATE OF status ON public.deals FOR EACH ROW WHEN (NEW.status = 'ganha' AND OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.trg_email_flow_from_deal();

-- ───────────── Runner helpers (service role only) ─────────────
CREATE OR REPLACE FUNCTION public.fn_email_flow_try_lock(_seconds integer DEFAULT 240)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  UPDATE email_flow_runner_state SET locked_until = now() + make_interval(secs => _seconds), updated_at = now()
  WHERE id = 1 AND (locked_until IS NULL OR locked_until < now()) RETURNING true INTO ok;
  RETURN coalesce(ok,false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_email_flow_unlock()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE email_flow_runner_state SET locked_until = NULL, updated_at = now() WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_email_flow_claim(_limit integer DEFAULT 40)
RETURNS SETOF public.email_flow_enrollments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE email_flow_enrollments e SET next_run_at = now() + interval '10 minutes'
  WHERE e.id IN (
    SELECT x.id FROM email_flow_enrollments x JOIN email_flows f ON f.id = x.flow_id AND f.status = 'active'
    WHERE x.status = 'active' AND x.next_run_at <= now()
    ORDER BY x.next_run_at LIMIT _limit FOR UPDATE OF x SKIP LOCKED)
  RETURNING e.*;
END $$;

CREATE OR REPLACE FUNCTION public.fn_email_flow_exit_reason(_enr uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; r jsonb;
BEGIN
  SELECT en.*, f.exit_rules, f.trigger_type INTO e FROM email_flow_enrollments en JOIN email_flows f ON f.id = en.flow_id WHERE en.id = _enr;
  IF e.lead_id IS NULL THEN RETURN NULL; END IF;
  r := coalesce(e.exit_rules, '{}'::jsonb);
  IF coalesce((r->>'deal_won')::boolean,false) AND e.trigger_type IS DISTINCT FROM 'deal_won' AND EXISTS (
    SELECT 1 FROM deals d WHERE d.lead_id = e.lead_id AND d.status = 'ganha' AND coalesce(d.closed_at, d.piperun_updated_at) > e.started_at) THEN RETURN 'converteu (negócio ganho)'; END IF;
  IF coalesce((r->>'new_form')::boolean,false) AND EXISTS (
    SELECT 1 FROM lead_form_submissions s WHERE s.lead_id = e.lead_id AND s.submitted_at > e.started_at + interval '1 minute') THEN RETURN 'novo cadastro de formulário'; END IF;
  IF coalesce((r->>'stage_change')::boolean,false) AND EXISTS (
    SELECT 1 FROM piperun_stage_transitions t WHERE t.lead_id = e.lead_id AND t.transitioned_at > e.started_at + interval '1 minute') THEN RETURN 'mudou de etapa no funil'; END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.fn_audience_where(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_audience_resolve(jsonb, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_audience_count(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_audience_resolve(jsonb, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_audience_count(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_audience_where(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.fn_email_flow_enroll_audience(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_email_flow_enroll_audience(uuid, integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_email_flow_fire(text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_email_flow_try_lock(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_email_flow_unlock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_email_flow_claim(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_email_flow_exit_reason(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_email_flow_fire(text, uuid, jsonb, text), public.fn_email_flow_try_lock(integer), public.fn_email_flow_unlock(), public.fn_email_flow_claim(integer), public.fn_email_flow_exit_reason(uuid) TO service_role;
