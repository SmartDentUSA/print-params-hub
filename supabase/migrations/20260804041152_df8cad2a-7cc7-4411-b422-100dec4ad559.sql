-- 1. Deliverables
CREATE TABLE public.training_social_deliverables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id uuid NOT NULL REFERENCES public.smartops_course_turmas(id) ON DELETE CASCADE,
  kit_run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  account_id text,
  post_type text NOT NULL,
  caption text,
  hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_comment text,
  cta text,
  title text,
  description text,
  suggested_at timestamptz,
  suggestion_basis jsonb,
  suggestion_confidence text,
  copy_context_snapshot jsonb,
  rag_context_snapshot jsonb,
  status text NOT NULL DEFAULT 'generated',
  review_notes text,
  scheduled_post_id uuid REFERENCES public.social_scheduled_posts(id) ON DELETE SET NULL,
  agent_source text,
  version integer NOT NULL DEFAULT 1,
  approved_by uuid,
  approved_at timestamptz,
  edited_by uuid,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_social_deliverables_status_chk CHECK (status IN (
    'generated','pending_review','changes_requested','approved','scheduled',
    'publishing','published','partial','failed','cancelled'
  )),
  CONSTRAINT training_social_deliverables_confidence_chk CHECK (
    suggestion_confidence IS NULL OR suggestion_confidence IN ('high','medium','low')
  )
);

CREATE UNIQUE INDEX uq_training_social_deliverables_kit
  ON public.training_social_deliverables (turma_id, kit_run_id, platform, post_type, version);
CREATE INDEX idx_tsd_turma_status ON public.training_social_deliverables (turma_id, status);
CREATE INDEX idx_tsd_status_suggested ON public.training_social_deliverables (status, suggested_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_social_deliverables TO authenticated;
GRANT ALL ON public.training_social_deliverables TO service_role;

ALTER TABLE public.training_social_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tsd_select_authorized" ON public.training_social_deliverables
  FOR SELECT TO authenticated
  USING (public.can_manage_training_media(auth.uid()));

CREATE POLICY "tsd_update_authorized" ON public.training_social_deliverables
  FOR UPDATE TO authenticated
  USING (public.can_manage_training_media(auth.uid()))
  WITH CHECK (public.can_manage_training_media(auth.uid()));

CREATE POLICY "tsd_delete_authorized" ON public.training_social_deliverables
  FOR DELETE TO authenticated
  USING (public.can_manage_training_media(auth.uid()));

CREATE TRIGGER trg_tsd_updated_at
  BEFORE UPDATE ON public.training_social_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Deliverable media (metadata only — files live in Google Drive)
CREATE TABLE public.training_social_deliverable_media (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deliverable_id uuid NOT NULL REFERENCES public.training_social_deliverables(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  drive_folder_id text NOT NULL,
  drive_file_id text NOT NULL,
  drive_web_view_link text,
  generated_filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  duration_seconds numeric,
  media_role text,
  is_cover boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  superseded_by uuid REFERENCES public.training_social_deliverable_media(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tsdm_deliverable ON public.training_social_deliverable_media (deliverable_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_social_deliverable_media TO authenticated;
GRANT ALL ON public.training_social_deliverable_media TO service_role;

ALTER TABLE public.training_social_deliverable_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tsdm_select_authorized" ON public.training_social_deliverable_media
  FOR SELECT TO authenticated
  USING (public.can_manage_training_media(auth.uid()));

CREATE POLICY "tsdm_update_authorized" ON public.training_social_deliverable_media
  FOR UPDATE TO authenticated
  USING (public.can_manage_training_media(auth.uid()))
  WITH CHECK (public.can_manage_training_media(auth.uid()));

CREATE POLICY "tsdm_delete_authorized" ON public.training_social_deliverable_media
  FOR DELETE TO authenticated
  USING (public.can_manage_training_media(auth.uid()));

-- 3. Approval RPC (idempotent): creates the official scheduled post
CREATE OR REPLACE FUNCTION public.approve_training_deliverable(
  _deliverable_id uuid,
  _scheduled_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.training_social_deliverables;
  new_post_id uuid;
  final_at timestamptz;
  media_items jsonb;
BEGIN
  IF NOT public.can_manage_training_media(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: usuario sem permissao para aprovar entregas'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO d FROM public.training_social_deliverables
   WHERE id = _deliverable_id FOR UPDATE;
  IF d.id IS NULL THEN
    RAISE EXCEPTION 'deliverable_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- idempotence: already approved/scheduled → return existing post
  IF d.scheduled_post_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'deliverable_id', d.id,
      'scheduled_post_id', d.scheduled_post_id,
      'status', d.status,
      'already_scheduled', true
    );
  END IF;

  IF d.status NOT IN ('generated','pending_review','changes_requested') THEN
    RAISE EXCEPTION 'invalid_status: %', d.status USING ERRCODE = '22023';
  END IF;

  IF d.caption IS NULL OR length(btrim(d.caption)) = 0 THEN
    RAISE EXCEPTION 'caption_required' USING ERRCODE = '22023';
  END IF;

  final_at := COALESCE(_scheduled_at, d.suggested_at);
  IF final_at IS NULL THEN
    RAISE EXCEPTION 'scheduled_at_required' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_agg(
           jsonb_build_object(
             'url', m.drive_web_view_link,
             'drive_file_id', m.drive_file_id,
             'filename', m.generated_filename,
             'mime_type', m.mime_type,
             'width', m.width,
             'height', m.height,
             'duration_seconds', m.duration_seconds,
             'is_cover', m.is_cover
           ) ORDER BY m.position
         )
    INTO media_items
    FROM public.training_social_deliverable_media m
   WHERE m.deliverable_id = d.id AND m.superseded_by IS NULL;

  IF media_items IS NULL OR jsonb_array_length(media_items) = 0 THEN
    RAISE EXCEPTION 'media_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.social_scheduled_posts (
    caption, hashtags, first_comment, media_items, channels,
    scheduled_at, timezone, status, publish_now, post_type, created_by,
    per_channel_media
  ) VALUES (
    d.caption,
    d.hashtags,
    d.first_comment,
    media_items,
    jsonb_build_array(jsonb_build_object('platform', d.platform, 'account_id', d.account_id)),
    final_at,
    'America/Sao_Paulo',
    'scheduled',
    false,
    d.post_type,
    auth.uid(),
    jsonb_build_object(d.platform, media_items)
  )
  RETURNING id INTO new_post_id;

  UPDATE public.training_social_deliverables
     SET status = 'scheduled',
         scheduled_post_id = new_post_id,
         approved_by = auth.uid(),
         approved_at = now()
   WHERE id = d.id;

  INSERT INTO public.system_health_logs (event, status, details)
  VALUES (
    'training_deliverable.approved',
    'ok',
    jsonb_build_object(
      'deliverable_id', d.id,
      'turma_id', d.turma_id,
      'platform', d.platform,
      'post_type', d.post_type,
      'scheduled_post_id', new_post_id,
      'scheduled_at', final_at,
      'approved_by', auth.uid()
    )
  );

  RETURN jsonb_build_object(
    'deliverable_id', d.id,
    'scheduled_post_id', new_post_id,
    'status', 'scheduled',
    'already_scheduled', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_training_deliverable(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_training_deliverable(uuid, timestamptz) TO authenticated, service_role;

-- 4. Suggested slot RPC based on real Zernio/social metrics
CREATE OR REPLACE FUNCTION public.suggest_training_post_slot(
  _platform text,
  _format text DEFAULT NULL,
  _window_days integer DEFAULT 90
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  n integer := 0;
  used_fallback text := NULL;
  conf text;
BEGIN
  -- Tier 1: platform + format
  IF _format IS NOT NULL THEN
    SELECT count(*) INTO n
      FROM public.social_posts p
     WHERE p.platform = _platform
       AND p.format = _format
       AND p.published_at >= now() - make_interval(days => _window_days);
  END IF;

  IF _format IS NULL OR n < 5 THEN
    SELECT count(*) INTO n
      FROM public.social_posts p
     WHERE p.platform = _platform
       AND p.published_at >= now() - make_interval(days => _window_days);
    used_fallback := CASE WHEN _format IS NOT NULL THEN 'platform_only' ELSE NULL END;
    _format := NULL;
  END IF;

  IF n = 0 THEN
    RETURN jsonb_build_object(
      'platform', _platform,
      'format', _format,
      'sample_size', 0,
      'window_days', _window_days,
      'weekday', 4,
      'hour', 19,
      'confidence', 'low',
      'fallback', 'editorial_default'
    );
  END IF;

  SELECT weekday, hour, cnt INTO rec
  FROM (
    SELECT EXTRACT(DOW FROM p.published_at AT TIME ZONE 'America/Sao_Paulo')::int AS weekday,
           EXTRACT(HOUR FROM p.published_at AT TIME ZONE 'America/Sao_Paulo')::int AS hour,
           count(*) AS cnt,
           avg(
             (COALESCE(p.likes,0) + 2*COALESCE(p.comments,0) + 3*COALESCE(p.shares,0) + 3*COALESCE(p.saves,0))::numeric
             / GREATEST(COALESCE(NULLIF(p.reach,0), NULLIF(p.impressions,0), NULLIF(p.views,0), 1), 1)
           ) AS score
      FROM public.social_posts p
     WHERE p.platform = _platform
       AND (_format IS NULL OR p.format = _format)
       AND p.published_at >= now() - make_interval(days => _window_days)
     GROUP BY 1, 2
     ORDER BY score DESC NULLS LAST, cnt DESC
     LIMIT 1
  ) s;

  conf := CASE WHEN n >= 10 THEN 'high' WHEN n >= 5 THEN 'medium' ELSE 'low' END;

  RETURN jsonb_build_object(
    'platform', _platform,
    'format', _format,
    'sample_size', n,
    'window_days', _window_days,
    'weekday', COALESCE(rec.weekday, 4),
    'hour', COALESCE(rec.hour, 19),
    'confidence', conf,
    'fallback', used_fallback
  );
END;
$$;

REVOKE ALL ON FUNCTION public.suggest_training_post_slot(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suggest_training_post_slot(text, text, integer) TO authenticated, service_role;