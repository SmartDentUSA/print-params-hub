CREATE TABLE public.event_raffles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.smartops_events(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  rules_text text,
  prizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  form_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  eligibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  draw_mode text NOT NULL DEFAULT 'system',
  public_results boolean NOT NULL DEFAULT false,
  notify_winner boolean NOT NULL DEFAULT true,
  notify_group boolean NOT NULL DEFAULT true,
  wa_instance text,
  wa_group_jid text,
  wa_group_name text,
  winner_message_template text,
  group_message_template text,
  cover_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_raffles_status_check CHECK (status IN ('draft','active','closed')),
  CONSTRAINT event_raffles_draw_mode_check CHECK (draw_mode IN ('system','manual','public_audit'))
);

GRANT SELECT ON public.event_raffles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_raffles TO authenticated;
GRANT ALL ON public.event_raffles TO service_role;
ALTER TABLE public.event_raffles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe gerencia sorteios" ON public.event_raffles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Publico le sorteio ativo" ON public.event_raffles
  FOR SELECT TO anon USING (status = 'active');

CREATE TABLE public.event_raffle_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.event_raffles(id) ON DELETE CASCADE,
  lead_id uuid,
  name text NOT NULL,
  email text,
  phone text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  tickets integer NOT NULL DEFAULT 1,
  eligible boolean NOT NULL DEFAULT true,
  disqualified_reason text,
  consent boolean NOT NULL DEFAULT false,
  seller_team_member_id uuid,
  source text NOT NULL DEFAULT 'form',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX event_raffle_entries_phone_uniq
  ON public.event_raffle_entries (raffle_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX event_raffle_entries_raffle_idx ON public.event_raffle_entries (raffle_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_raffle_entries TO authenticated;
GRANT ALL ON public.event_raffle_entries TO service_role;
ALTER TABLE public.event_raffle_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe gerencia participacoes" ON public.event_raffle_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.event_raffle_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.event_raffles(id) ON DELETE CASCADE,
  prize_id text,
  prize_title text,
  entry_id uuid REFERENCES public.event_raffle_entries(id) ON DELETE SET NULL,
  winner_name text,
  winner_phone text,
  winner_email text,
  participants_count integer NOT NULL DEFAULT 0,
  seed text,
  drawn_by uuid,
  drawn_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  notify_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_raffle_draws_raffle_idx ON public.event_raffle_draws (raffle_id, drawn_at DESC);

GRANT SELECT ON public.event_raffle_draws TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_raffle_draws TO authenticated;
GRANT ALL ON public.event_raffle_draws TO service_role;
ALTER TABLE public.event_raffle_draws ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe gerencia sorteados" ON public.event_raffle_draws
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Publico le resultado liberado" ON public.event_raffle_draws
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.event_raffles r
      WHERE r.id = event_raffle_draws.raffle_id
        AND r.status = 'active'
        AND r.public_results = true
    )
  );

CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_event_raffles_touch BEFORE UPDATE ON public.event_raffles
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();
CREATE TRIGGER trg_event_raffle_entries_touch BEFORE UPDATE ON public.event_raffle_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

CREATE OR REPLACE FUNCTION public.fn_public_raffle(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'slug', r.slug,
    'status', r.status,
    'starts_at', r.starts_at,
    'ends_at', r.ends_at,
    'rules_text', r.rules_text,
    'prizes', r.prizes,
    'form_fields', r.form_fields,
    'eligibility', r.eligibility,
    'cover_image_url', r.cover_image_url,
    'public_results', r.public_results,
    'event', jsonb_build_object(
      'id', e.id, 'name', e.name, 'location', e.location,
      'company_stand', e.company_stand, 'start_date', e.start_date, 'end_date', e.end_date
    ),
    'winners', CASE WHEN r.public_results THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('prize', d.prize_title, 'name', d.winner_name, 'drawn_at', d.drawn_at) ORDER BY d.drawn_at)
      FROM public.event_raffle_draws d WHERE d.raffle_id = r.id
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'consultants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', tm.id, 'name', tm.nome_completo) ORDER BY tm.nome_completo)
      FROM public.smartops_forms f
      JOIN public.team_members tm ON tm.id = ANY (f.event_consultant_ids)
      WHERE f.event_id = e.id AND tm.ativo = true
    ), '[]'::jsonb)
  )
  FROM public.event_raffles r
  JOIN public.smartops_events e ON e.id = r.event_id
  WHERE r.slug = p_slug AND r.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.fn_public_raffle(text) TO anon, authenticated;